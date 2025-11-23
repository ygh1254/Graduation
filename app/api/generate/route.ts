import { NextRequest, NextResponse } from 'next/server';
import { generateMidjourneyPrompt } from '@/lib/claude';
import { generateImage, downloadImage, upscaleImage } from '@/lib/midjourney';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { number } = body;

    if (!number || number < 1 || number > 100) {
      return NextResponse.json(
        { success: false, error: '1-100 사이의 번호를 선택해주세요' },
        { status: 400 }
      );
    }

    console.log('선택된 번호:', number);

    // 1단계: 번호를 사용하여 Midjourney 프롬프트 생성
    console.log('프롬프트 생성 중...');
    const midjourneyPrompt = await generateMidjourneyPrompt(number);
    console.log('생성된 프롬프트:', midjourneyPrompt);

    // 2단계: Midjourney API로 이미지 생성 (4장 그리드)
    console.log('Midjourney API로 이미지 생성 중...');
    const imageResult = await generateImage(midjourneyPrompt);

    if (!imageResult.success) {
      return NextResponse.json({
        success: false,
        prompt: midjourneyPrompt,
        error: `이미지 생성 실패: ${imageResult.error}`,
      });
    }

    // 3단계: U2 업스케일 (2번 이미지 고해상도로 업스케일)
    console.log('U2 업스케일 시작 (2번 이미지)...');
    const channelId = process.env.DISCORD_CHANNEL_ID;

    if (!channelId || !imageResult.messageId) {
      return NextResponse.json({
        success: false,
        error: 'Discord 채널 ID 또는 메시지 ID가 없습니다.',
      });
    }

    const upscaleResult = await upscaleImage(imageResult.messageId, channelId);

    if (!upscaleResult.success || !upscaleResult.imageUrl) {
      return NextResponse.json({
        success: false,
        prompt: midjourneyPrompt,
        error: `업스케일 실패: ${upscaleResult.error}`,
      });
    }

    console.log('✅ U2 업스케일 완료:', upscaleResult.imageUrl);

    return NextResponse.json({
      success: true,
      prompt: midjourneyPrompt,
      imageUrl: upscaleResult.imageUrl, // U2 업스케일된 고해상도 이미지 URL
      messageId: imageResult.messageId,
    });
  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
      },
      { status: 500 }
    );
  }
}
