const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const os = require('os');
const app = express();

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST'],  // POST 메서드 허용
    allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// OS 감지
const isWindows = os.platform() === 'win32';
const PRINTER_NAME = 'BIXOLON SRP-330II';

// 프린터 상태 확인 (OS별 명령어)
app.get('/printer-status', async (req, res) => {
    const command = isWindows
        ? 'powershell -Command "Get-Printer | Select-Object Name, PrinterStatus"'
        : 'lpstat -p';

    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({
                connected: false,
                error: error.message
            });
        }

        const printerConnected = stdout.includes(PRINTER_NAME);
        res.json({
            connected: printerConnected,
            printers: stdout
        });
    });
});

// 인쇄 요청 처리 (시스템 프린트 드라이버 사용)
app.post('/print', async (req, res) => {
    console.log('📨 POST /print 요청 도착');
    console.log('📩 요청 받은 데이터:', req.body);

    const {
        imageUrl,
        weight,
        widthMm = 71,                   // 기본값: 71mm (영수증 용지 표준 폭)
        maintainAspectRatio = true,     // 기본값: 비율 유지
        quality = 90,                   // 기본값: 90% 품질
        grayscale = true                // 기본값: 흑백 변환
    } = req.body;

    // width를 밀리미터 그대로 사용 (Sharp resize 안 함, 프린터가 직접 처리)
    const width = widthMm;

    if (!imageUrl || !weight) {
        console.log('❌ 검증 실패 - imageUrl:', imageUrl, 'weight:', weight);
        return res.status(400).json({
            success: false,
            error: '이미지 URL과 무게가 필요합니다.'
        });
    }

    try {
        console.log('🖨️ 이미지 다운로드 시작:', imageUrl);
        console.log('⚙️ 인쇄 설정:', { widthMm, width, maintainAspectRatio, quality, grayscale });

        // 이미지 다운로드
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
        });

        // 임시 파일 경로 생성 (OS별)
        const tempDir = isWindows ? (process.env.TEMP || 'C:\\Windows\\Temp') : '/tmp';
        const tempFile = path.join(tempDir, `print-${Date.now()}.png`);

        console.log('🖼️ 이미지 처리 및 저장 중:', tempFile);

        // Sharp 이미지 처리 파이프라인 구성 (리사이즈 없이 원본 크기 유지)
        let sharpPipeline = sharp(response.data);

        // 흑백 변환 옵션
        if (grayscale) {
            sharpPipeline = sharpPipeline.grayscale();
        }

        // PNG 품질 설정 및 파일 저장 (원본 크기 그대로)
        await sharpPipeline
            .png({ quality: quality, compressionLevel: 6 })
            .toFile(tempFile);

        console.log('🖨️ 시스템 프린트 명령 실행 중...');

        // OS별 프린트 명령어
        let printCommand;
        if (isWindows) {
            // Windows: PowerShell로 프린터에 이미지 전송 (원본 크기 유지, 71mm 폭으로 출력)
            // 용지 폭을 71mm로 설정하여 프린터가 자동으로 스케일링
            const escapedPath = tempFile.replace(/\\/g, '\\\\');
            // 100분의 1인치 단위로 71mm = 279 (71mm / 25.4mm * 100)
            const widthIn100thInch = Math.round(widthMm / 25.4 * 100);
            printCommand = `powershell -Command "Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Printing; $img = [System.Drawing.Image]::FromFile('${escapedPath}'); $printDoc = New-Object System.Drawing.Printing.PrintDocument; $printDoc.PrinterSettings.PrinterName = '${PRINTER_NAME}'; $printDoc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0); $printDoc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('Custom', ${widthIn100thInch}, 1600); $printDoc.add_PrintPage({ param($sender, $ev); $aspectRatio = $img.Height / $img.Width; $printWidth = ${widthIn100thInch}; $printHeight = $printWidth * $aspectRatio; $ev.Graphics.DrawImage($img, 0, 0, $printWidth, $printHeight); $ev.HasMorePages = $false }); $printDoc.Print(); $img.Dispose()"`;
        } else {
            // macOS/Linux: lp 명령어로 프린트
            // 용지 크기는 동적으로 설정 (widthMm x 자동 높이)
            printCommand = `lp -d "${PRINTER_NAME}" -o fit-to-page -o media=Custom.${widthMm}x426mm "${tempFile}"`;
        }
        console.log('🖨️ 실행 명령:', printCommand);

        exec(printCommand, (error, stdout, stderr) => {
            // 임시 파일 삭제 (Windows는 지연 후 삭제)
            const deleteDelay = isWindows ? 5000 : 0;
            setTimeout(() => {
                try {
                    fs.unlinkSync(tempFile);
                    console.log('🗑️ 임시 파일 삭제 완료');
                } catch (unlinkError) {
                    console.error('임시 파일 삭제 실패:', unlinkError);
                }
            }, deleteDelay);

            if (error) {
                console.error('❌ 프린트 실패:', error);
                console.error('stderr:', stderr);
                return res.status(500).json({
                    success: false,
                    error: '프린트 실패: ' + error.message
                });
            }

            console.log('✅ 프린트 명령 전송 완료!');
            console.log('stdout:', stdout);

            return res.json({
                success: true,
                message: '인쇄가 시작되었습니다.'
            });
        });

    } catch (error) {
        console.error('❌ 인쇄 처리 중 오류:', error);
        res.status(500).json({
            success: false,
            error: '인쇄 실패: ' + error.message
        });
    }
});

app.listen(3001, '0.0.0.0', () => {
    console.log('프린터 서버가 http://0.0.0.0:3001 에서 실행 중입니다.');
    console.log('플랫폼: ' + (isWindows ? 'Windows' : 'macOS/Linux'));
    console.log('시스템 프린트 드라이버 사용: ' + PRINTER_NAME);
    console.log('로컬 네트워크에서 접근 가능 (같은 Wi-Fi 필요)');
});