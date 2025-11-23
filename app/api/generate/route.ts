import { NextRequest, NextResponse } from 'next/server';
import { generateMidjourneyPrompt } from '@/lib/claude';
import { generateImage, downloadImage } from '@/lib/midjourney';

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

    // 2단계: Midjourney API로 이미지 생성
    console.log('Midjourney API로 이미지 생성 중...');
    const imageResult = await generateImage(midjourneyPrompt);

    if (!imageResult.success) {
      return NextResponse.json({
        success: true, // 프롬프트는 생성됨
        prompt: midjourneyPrompt,
        error: `이미지 생성 실패: ${imageResult.error}`,
      });
    }

    // 3단계: 이미지 다운로드 및 저장
    let localImagePath: string | undefined;
    if (imageResult.imageUrl) {
      try {
        const filename = `${Date.now()}.png`;
        localImagePath = await downloadImage(imageResult.imageUrl, filename);
        console.log('이미지 저장 완료:', localImagePath);
      } catch (error) {
        console.error('이미지 저장 실패:', error);
        // 이미지 저장 실패해도 원본 URL은 반환
      }
    }

    return NextResponse.json({
      success: true,
      prompt: midjourneyPrompt,
      imageUrl: localImagePath || imageResult.imageUrl,
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
