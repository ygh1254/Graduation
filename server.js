const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
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

const PRINTER_NAME = 'BIXOLON SRP-330II';

// 프린터 상태 확인
app.get('/printer-status', async (req, res) => {
    exec('lpstat -p', (error, stdout, stderr) => {
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

    const { imageUrl, weight } = req.body;

    if (!imageUrl || !weight) {
        console.log('❌ 검증 실패 - imageUrl:', imageUrl, 'weight:', weight);
        return res.status(400).json({
            success: false,
            error: '이미지 URL과 무게가 필요합니다.'
        });
    }

    try {
        console.log('🖨️ 이미지 다운로드 시작:', imageUrl);

        // 이미지 다운로드
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
        });

        // 임시 파일 경로 생성
        const tempDir = '/tmp';
        const tempFile = path.join(tempDir, `print-${Date.now()}.png`);

        console.log('🖼️ 이미지 처리 및 저장 중:', tempFile);

        // 이미지를 프린터에 맞게 변환 (58mm 너비, 384픽셀)
        await sharp(response.data)
            .resize(384, null, {
                fit: 'inside',
                withoutEnlargement: false,
            })
            .grayscale()
            .toFile(tempFile);

        console.log('🖨️ 시스템 프린트 명령 실행 중...');

        // macOS lp 명령어로 프린트 (시스템 드라이버 사용)
        exec(`lp -d "${PRINTER_NAME}" "${tempFile}"`, (error, stdout, stderr) => {
            // 임시 파일 삭제
            try {
                fs.unlinkSync(tempFile);
                console.log('🗑️ 임시 파일 삭제 완료');
            } catch (unlinkError) {
                console.error('임시 파일 삭제 실패:', unlinkError);
            }

            if (error) {
                console.error('❌ 프린트 실패:', error);
                console.error('stderr:', stderr);
                return res.status(500).json({
                    success: false,
                    error: '프린트 실패: ' + error.message
                });
            }

            console.log('✅ 프린트 완료!');
            console.log('stdout:', stdout);

            return res.json({
                success: true,
                message: '인쇄가 완료되었습니다.'
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

app.listen(3001, () => {
    console.log('프린터 서버가 http://localhost:3001 에서 실행 중입니다.');
    console.log('시스템 프린트 드라이버 사용: ' + PRINTER_NAME);
});