import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * 번호를 받아서 고정된 Midjourney 프롬프트에 삽입합니다
 */
export async function generateMidjourneyPrompt(number: number): Promise<string> {
  // 고정된 프롬프트 템플릿
  const prompt = `3d blender image, construction worker who lightly moves a small ${number}g stone with one hand. --ar 1:6 --sref https://s.mj.run/hz-xLHoG7ME --oref https://s.mj.run/41xbnVXeOz0`;

  return prompt;
}
