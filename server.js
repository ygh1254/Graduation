const express = require('express');
const cors = require('cors');
const usb = require('usb');
const axios = require('axios');
const sharp = require('sharp');
const iconv = require('iconv-lite');
const app = express();

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST'],  // POST 메서드 허용
    allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
// app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

let printer = null;
const BIXOLON_VENDOR_ID = 0x1504;  // 5380의 16진수 값
const BIXOLON_PRODUCT_ID = 110;    // Add this line

async function connectPrinter() {
    try {
        // BIXOLON 프린터 찾기
        const devices = usb.getDeviceList();
        const device = devices.find(d => 
            d.deviceDescriptor.idVendor === BIXOLON_VENDOR_ID && 
            d.deviceDescriptor.idProduct === BIXOLON_PRODUCT_ID
        );
        
        if (!device) {
            console.log('사용 가능한 USB 장치들:', usb.getDeviceList());
            throw new Error('BIXOLON 프린터를 찾을 수 없습니다.');
        }

        device.open();
        
        // 프린터의 첫 번째 인터페이스를 찾습니다
        const interface = device.interface(0);
        
        // 커널 드라이버를 분리해야 할 수 있습니다
        if (interface.isKernelDriverActive()) {
            interface.detachKernelDriver();
        }
        
        interface.claim();

        // 엔드포인트 찾기
        const endpointOut = interface.endpoints.find(endpoint => 
            endpoint.direction === 'out'
        );

        if (!endpointOut) {
            throw new Error('프린터 출력 엔드포인트를 찾을 수 없습니다.');
        }

        printer = {
            device,
            interface,
            endpointOut,
            isOpen: true,
            write: (data, callback) => {
                try {
                    endpointOut.transfer(Buffer.from(data), (error) => {
                        if (error) {
                            console.error('전송 오류:', error);
                            callback?.(error);
                        } else {
                            callback?.(null);
                        }
                    });
                } catch (error) {
                    console.error('전송 오류:', error);
                    callback?.(error);
                }
            }
        };

        console.log('프린터 연결 성공!');
        return true;
    } catch (error) {
        console.error('프린터 연결 실패:', error);
        return false;
    }
}

// 서버 시작 시 프린터 연결
connectPrinter();

// 프린터 상태 확인
app.get('/printer-status', async (req, res) => {
    try {
        const devices = usb.getDeviceList();
        const printerDevice = devices.find(d => d.deviceDescriptor.idVendor === BIXOLON_VENDOR_ID);
        
        res.json({
            connected: printer !== null && printer.isOpen,
            deviceFound: !!printerDevice,
            availableDevices: devices.map(d => ({
                vendorId: d.deviceDescriptor.idVendor,
                productId: d.deviceDescriptor.idProduct
            })),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 인쇄 요청 처리
app.post('/print', async (req, res) => {
    console.log('📨 POST /print 요청 도착');
    console.log('📩 요청 받은 데이터:', req.body);

    const { imageUrl, weight } = req.body;

    if (!imageUrl || !weight) {
        return res.status(400).json({
            success: false,
            error: '이미지 URL과 무게가 필요합니다.'
        });
    }

    if (!printer || !printer.isOpen) {
        console.log('⚠️ 프린터 연결 시도 중...');
        const connected = await connectPrinter();
        if (!connected) {
            return res.status(500).json({
                success: false,
                error: '프린터 연결 실패'
            });
        }
    }

    try {
        console.log('🖨️ 이미지 인쇄 시작:', imageUrl);

        // 이미지 다운로드
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
        });

        // 이미지를 프린터에 맞게 변환 (58mm 너비, 384픽셀)
        const imageBuffer = await sharp(response.data)
            .resize(384, null, {
                fit: 'inside',
                withoutEnlargement: false,
            })
            .grayscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { data, info } = imageBuffer;

        // ESC/POS 명령어
        const commands = {
            INIT: Buffer.from([0x1b, 0x40]),
            CENTER: Buffer.from([0x1b, 0x61, 0x01]),
            LEFT: Buffer.from([0x1b, 0x61, 0x00]),
            BOLD_ON: Buffer.from([0x1b, 0x45, 0x01]),
            BOLD_OFF: Buffer.from([0x1b, 0x45, 0x00]),
            CUT: Buffer.from([0x1b, 0x69]),
            NEWLINE: Buffer.from([0x0a]),
        };

        const buffers = [commands.INIT];

        // 헤더
        buffers.push(
            commands.CENTER,
            commands.BOLD_ON,
            iconv.encode('건설 작업자\n', 'cp949'),
            commands.BOLD_OFF,
            commands.NEWLINE,
            commands.LEFT,
            iconv.encode(`무게: ${weight}g\n`, 'cp949'),
            iconv.encode('----------------------------------------\n', 'cp949'),
            commands.NEWLINE
        );

        // 이미지 데이터를 ESC/POS 비트맵 형식으로 변환
        const bitmap = convertToBitmap(data, info.width, info.height);
        buffers.push(bitmap);

        // 푸터
        buffers.push(
            commands.NEWLINE,
            commands.NEWLINE,
            iconv.encode('----------------------------------------\n', 'cp949'),
            commands.CENTER,
            iconv.encode('Midjourney 생성 이미지\n', 'cp949'),
            commands.NEWLINE,
            commands.NEWLINE,
            commands.NEWLINE,
            commands.CUT
        );

        const finalBuffer = Buffer.concat(buffers);

        // 프린터로 전송
        printer.write(finalBuffer, (error) => {
            if (error) {
                console.error('❌ 인쇄 실패:', error);
                return res.status(500).json({
                    success: false,
                    error: '인쇄 실패: ' + error.message
                });
            } else {
                console.log('✅ 인쇄 완료!');
                return res.json({
                    success: true,
                    message: '인쇄가 완료되었습니다.'
                });
            }
        });

    } catch (error) {
        console.error('❌ 인쇄 처리 중 오류:', error);
        res.status(500).json({
            success: false,
            error: '인쇄 실패: ' + error.message
        });
    }
});

// 이미지 데이터를 ESC/POS 비트맵 형식으로 변환
function convertToBitmap(data, width, height) {
    const bitmap = [];

    // ESC * m nL nH d1...dk 형식
    bitmap.push(0x1b, 0x2a, 33); // ESC * 33 (24-dot double-density)

    const nL = width % 256;
    const nH = Math.floor(width / 256);
    bitmap.push(nL, nH);

    for (let y = 0; y < height; y += 24) {
        for (let x = 0; x < width; x++) {
            let byte1 = 0, byte2 = 0, byte3 = 0;

            for (let k = 0; k < 8; k++) {
                const pixelY = y + k;
                if (pixelY < height) {
                    const pixel = data[pixelY * width + x];
                    if (pixel < 128) byte1 |= 1 << (7 - k);
                }
            }

            for (let k = 0; k < 8; k++) {
                const pixelY = y + k + 8;
                if (pixelY < height) {
                    const pixel = data[pixelY * width + x];
                    if (pixel < 128) byte2 |= 1 << (7 - k);
                }
            }

            for (let k = 0; k < 8; k++) {
                const pixelY = y + k + 16;
                if (pixelY < height) {
                    const pixel = data[pixelY * width + x];
                    if (pixel < 128) byte3 |= 1 << (7 - k);
                }
            }

            bitmap.push(byte1, byte2, byte3);
        }
        bitmap.push(0x0a); // 줄바꿈
    }

    return Buffer.from(bitmap);
}

app.listen(3001, () => {
    console.log('프린터 서버가 http://localhost:3001 에서 실행 중입니다.');
});