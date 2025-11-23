import usb from 'usb';
import iconv from 'iconv-lite';
import axios from 'axios';
import sharp from 'sharp';

const BIXOLON_VENDOR_ID = 0x1504;
const BIXOLON_PRODUCT_ID = 110;

interface Printer {
  device: usb.Device;
  interface: usb.Interface;
  endpointOut: usb.OutEndpoint;
  isOpen: boolean;
  write: (data: Buffer | Uint8Array, callback?: (error: Error | null) => void) => void;
}

let printer: Printer | null = null;

/**
 * 프린터에 연결합니다
 */
export async function connectPrinter(): Promise<boolean> {
  try {
    const devices = usb.getDeviceList();
    const device = devices.find(
      (d) =>
        d.deviceDescriptor.idVendor === BIXOLON_VENDOR_ID &&
        d.deviceDescriptor.idProduct === BIXOLON_PRODUCT_ID
    );

    if (!device) {
      console.log('BIXOLON 프린터를 찾을 수 없습니다.');
      console.log('사용 가능한 장치:', devices.map(d => ({
        vendor: d.deviceDescriptor.idVendor,
        product: d.deviceDescriptor.idProduct
      })));
      return false;
    }

    device.open();

    const iface = device.interface(0);

    if (iface.isKernelDriverActive()) {
      iface.detachKernelDriver();
    }

    iface.claim();

    const endpointOut = iface.endpoints.find(
      (endpoint) => endpoint.direction === 'out'
    ) as usb.OutEndpoint;

    if (!endpointOut) {
      throw new Error('프린터 출력 엔드포인트를 찾을 수 없습니다.');
    }

    printer = {
      device,
      interface: iface,
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
          callback?.(error as Error);
        }
      },
    };

    console.log('✅ 프린터 연결 성공!');
    return true;
  } catch (error) {
    console.error('프린터 연결 실패:', error);
    return false;
  }
}

/**
 * 프린터 상태 확인
 */
export function isPrinterConnected(): boolean {
  return printer !== null && printer.isOpen;
}

/**
 * 이미지를 인쇄합니다
 */
export async function printImage(imageUrl: string, weight: number): Promise<boolean> {
  if (!printer || !printer.isOpen) {
    console.error('프린터가 연결되지 않았습니다.');
    return false;
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
      LINE_SPACING: (n: number) => Buffer.from([0x1b, 0x33, n]),
    };

    const buffers: Buffer[] = [commands.INIT];

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

    return new Promise((resolve, reject) => {
      printer!.write(finalBuffer, (error) => {
        if (error) {
          console.error('❌ 인쇄 실패:', error);
          reject(error);
        } else {
          console.log('✅ 인쇄 완료!');
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error('인쇄 중 오류:', error);
    return false;
  }
}

/**
 * 이미지 데이터를 ESC/POS 비트맵 형식으로 변환
 */
function convertToBitmap(data: Buffer, width: number, height: number): Buffer {
  const bytesPerLine = Math.ceil(width / 8);
  const bitmap: number[] = [];

  // ESC * m nL nH d1...dk 형식
  bitmap.push(0x1b, 0x2a, 33); // ESC * 33 (24-dot double-density)

  const nL = width % 256;
  const nH = Math.floor(width / 256);
  bitmap.push(nL, nH);

  for (let y = 0; y < height; y += 24) {
    for (let x = 0; x < width; x++) {
      let byte1 = 0,
        byte2 = 0,
        byte3 = 0;

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
