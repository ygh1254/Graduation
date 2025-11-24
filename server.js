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
const PRINTER_NAME = 'BIXOLON_SRP_330II';

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
        width = 832,                    // 기본값: 832px (71mm @ 300 DPI)
        maintainAspectRatio = true,     // 기본값: 비율 유지
        quality = 90,                   // 기본값: 90% 품질
        grayscale = true                // 기본값: 흑백 변환
    } = req.body;

    if (!imageUrl || !weight) {
        console.log('❌ 검증 실패 - imageUrl:', imageUrl, 'weight:', weight);
        return res.status(400).json({
            success: false,
            error: '이미지 URL과 무게가 필요합니다.'
        });
    }

    try {
        console.log('🖨️ 이미지 다운로드 시작:', imageUrl);
        console.log('⚙️ 인쇄 설정:', { width, maintainAspectRatio, quality, grayscale });

        // 이미지 다운로드
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
        });

        // 임시 파일 경로 생성 (OS별)
        const tempDir = isWindows ? (process.env.TEMP || 'C:\\Windows\\Temp') : '/tmp';
        const tempFile = path.join(tempDir, `print-${Date.now()}.png`);

        console.log('🖼️ 이미지 처리 및 저장 중:', tempFile);

        // Sharp 이미지 처리 파이프라인 구성
        let sharpPipeline = sharp(response.data)
            .resize(width, null, {
                fit: maintainAspectRatio ? 'inside' : 'fill',
                withoutEnlargement: false,
            });

        // 흑백 변환 옵션
        if (grayscale) {
            sharpPipeline = sharpPipeline.grayscale();
        }

        // PNG 품질 설정 및 파일 저장
        await sharpPipeline
            .png({ quality: quality, compressionLevel: 6 })
            .toFile(tempFile);

        console.log('🖨️ 시스템 프린트 명령 실행 중...');

        // OS별 프린트 명령어
        let printCommand;
        if (isWindows) {
            // Windows: PowerShell로 프린트
            printCommand = `powershell -Command "Start-Process -FilePath '${tempFile}' -Verb Print -WindowStyle Hidden"`;
        } else {
            // macOS/Linux: lp 명령어로 프린트
            // 용지 크기: 71mm x 426mm (2.8 x 16.77 inches)
            printCommand = `lp -d "${PRINTER_NAME}" -o fit-to-page -o media=Custom.71x426mm "${tempFile}"`;
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