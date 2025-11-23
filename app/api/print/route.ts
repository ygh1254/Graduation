import { NextRequest, NextResponse } from 'next/server';
import { upscaleImage } from '@/lib/midjourney';
import { connectPrinter, isPrinterConnected, printImage } from '@/lib/printer';

export async function POST(request: NextRequest) {
  try {
    const { messageId, weight } = await request.json();

    if (!messageId || !weight) {
      return NextResponse.json(
        { success: false, error: '메시지 ID와 무게가 필요합니다.' },
        { status: 400 }
      );
    }

    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) {
      return NextResponse.json(
        { success: false, error: 'Discord 채널 ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    console.log('🖨️ 인쇄 요청:', { messageId, weight });

    // 프린터 연결 확인
    if (!isPrinterConnected()) {
      console.log('프린터 연결 시도 중...');
      const connected = await connectPrinter();
      if (!connected) {
        return NextResponse.json(
          { success: false, error: '프린터 연결 실패' },
          { status: 500 }
        );
      }
    }

    // U2 이미지 업스케일
    console.log('U2 이미지 업스케일 시작...');
    const upscaleResult = await upscaleImage(messageId, channelId);

    if (!upscaleResult.success || !upscaleResult.imageUrl) {
      return NextResponse.json(
        { success: false, error: '업스케일 실패: ' + upscaleResult.error },
        { status: 500 }
      );
    }

    // 이미지 인쇄
    console.log('이미지 인쇄 시작...');
    const printSuccess = await printImage(upscaleResult.imageUrl, weight);

    if (printSuccess) {
      return NextResponse.json({
        success: true,
        message: '인쇄가 완료되었습니다.',
        imageUrl: upscaleResult.imageUrl,
      });
    } else {
      return NextResponse.json(
        { success: false, error: '인쇄 실패' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('인쇄 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
