import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data } = body;

    // 여기서 받은 데이터를 처리합니다
    console.log('받은 데이터:', data);

    // 데이터를 파일에 저장하거나 DB에 저장할 수 있습니다
    // 예: fs.appendFileSync('data.txt', data + '\n');

    // 응답 반환
    return NextResponse.json({
      success: true,
      message: `데이터를 성공적으로 받았습니다: "${data}"`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('오류:', error);
    return NextResponse.json(
      { success: false, message: '데이터 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
