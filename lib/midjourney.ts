import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface MidjourneyResponse {
  success: boolean;
  messageId?: string;
  imageUrl?: string;
  error?: string;
}

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const MIDJOURNEY_BOT_ID = '936929561302675456'; // 공식 Midjourney Bot ID

/**
 * Discord API를 직접 호출하여 Midjourney 봇에게 /imagine 명령어를 실행합니다
 * Interaction API를 사용하여 슬래시 커맨드 실행
 */
export async function generateImage(prompt: string): Promise<MidjourneyResponse> {
  try {
    const token = process.env.DISCORD_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_ID;

    if (!token || !channelId) {
      throw new Error('Discord 설정이 필요합니다. .env.local 파일을 확인하세요.');
    }

    console.log('Discord API를 통해 Midjourney 이미지 생성 요청:', prompt);
    console.log('채널 ID:', channelId);

    // 1. Midjourney 봇의 명령어 ID를 하드코딩 (공식 봇의 /imagine 명령어 ID)
    // 이 ID는 Midjourney 공식 봇의 전역 명령어 ID입니다
    const IMAGINE_COMMAND_ID = '938956540159881230';
    const IMAGINE_COMMAND_VERSION = '1237876415471554623';

    // 2. Interaction으로 /imagine 명령어 실행
    try {
      await axios.post(
        `${DISCORD_API_BASE}/interactions`,
        {
          type: 2, // APPLICATION_COMMAND
          application_id: MIDJOURNEY_BOT_ID,
          guild_id: null, // DM이므로 null
          channel_id: channelId,
          session_id: generateSessionId(),
          data: {
            version: IMAGINE_COMMAND_VERSION,
            id: IMAGINE_COMMAND_ID,
            name: 'imagine',
            type: 1,
            options: [
              {
                type: 3, // STRING
                name: 'prompt',
                value: prompt,
              },
            ],
            application_command: {
              id: IMAGINE_COMMAND_ID,
              application_id: MIDJOURNEY_BOT_ID,
              version: IMAGINE_COMMAND_VERSION,
              type: 1,
              name: 'imagine',
              description: 'Create images with Midjourney',
              dm_permission: true,
              contexts: [0, 1, 2],
              integration_types: [0],
              options: [
                {
                  type: 3,
                  name: 'prompt',
                  description: 'The prompt to imagine',
                  required: true,
                },
              ],
            },
            attachments: [],
          },
          nonce: generateNonce(),
        },
        {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ /imagine 명령어 Interaction 전송 완료');
    } catch (interactionError) {
      if (axios.isAxiosError(interactionError)) {
        console.error('Interaction 실패:', interactionError.response?.data);
      }
      throw new Error('Midjourney 명령어 실행 실패');
    }

    // 3. 현재 시간을 기록 (이 시간 이후의 이미지만 가져옴)
    const requestTime = Date.now();
    console.log('요청 시간:', new Date(requestTime).toISOString());

    // 4. 메시지 폴링하여 이미지 URL 가져오기
    const result = await pollForImage(channelId, token, requestTime);

    if (result) {
      return {
        success: true,
        imageUrl: result.imageUrl,
        messageId: result.messageId,
      };
    }

    return {
      success: false,
      error: '이미지 생성 타임아웃',
    };
  } catch (error) {
    console.error('Discord API 오류:', error);

    if (axios.isAxiosError(error)) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('에러 상세:', error.response?.data);
      return {
        success: false,
        error: `Discord API 오류 (${error.response?.status}): ${errorMsg}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

/**
 * Discord 세션 ID 생성 (랜덤 32자 hex)
 */
function generateSessionId(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Discord Nonce 생성 (타임스탬프 기반)
 */
function generateNonce(): string {
  return (BigInt(Date.now()) * BigInt(4194304)).toString();
}

/**
 * 채널에서 Midjourney 봇의 응답을 폴링하여 이미지 URL을 가져옵니다
 * @param channelId Discord 채널 ID
 * @param token Discord 토큰
 * @param requestTime 요청 시간 (밀리초) - 이 시간 이후의 메시지만 확인
 */
async function pollForImage(
  channelId: string,
  token: string,
  requestTime: number
): Promise<{ imageUrl: string; messageId: string } | null> {
  const maxAttempts = 60; // 최대 5분 (5초 * 60)
  const pollInterval = 5000; // 5초

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      // 최근 메시지 가져오기
      const messagesResponse = await axios.get(
        `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=10`,
        {
          headers: {
            Authorization: token,
          },
        }
      );

      const messages = messagesResponse.data;

      // Midjourney 봇의 메시지 찾기 (요청 시간 이후의 메시지만)
      for (const message of messages) {
        // Discord 메시지 타임스탬프를 밀리초로 변환
        const messageTime = new Date(message.timestamp).getTime();

        // 요청 시간 이전 메시지는 무시
        if (messageTime < requestTime) {
          continue;
        }

        if (message.author.id === MIDJOURNEY_BOT_ID) {
          // 진행 중 메시지 확인
          if (message.content && message.content.includes('%')) {
            const progressMatch = message.content.match(/\((\d+)%\)/);
            if (progressMatch) {
              console.log(`🔄 생성 진행률: ${progressMatch[1]}%`);
            }
          }

          // 첨부 파일에서 이미지 URL 찾기
          if (message.attachments && message.attachments.length > 0) {
            const imageAttachment = message.attachments.find((att: any) =>
              att.content_type?.startsWith('image/')
            );

            if (imageAttachment) {
              // Midjourney는 완료 메시지에 U1, U2, U3, U4 버튼이 포함됨
              // components가 있고 버튼이 있으면 최종 이미지임
              const hasButtons = message.components && message.components.length > 0;

              if (hasButtons) {
                console.log('✅ 최종 고해상도 이미지 생성 완료:', imageAttachment.url);
                console.log('메시지 시간:', new Date(message.timestamp).toISOString());
                return { imageUrl: imageAttachment.url, messageId: message.id };
              } else {
                console.log('⏳ 저해상도 프리뷰 발견, 최종 이미지 대기 중...');
              }
            }
          }
        }
      }

      console.log(`⏳ 이미지 대기 중... (${i + 1}/${maxAttempts})`);
    } catch (error) {
      console.error('메시지 폴링 오류:', error);
    }
  }

  return null;
}

/**
 * 이미지 URL을 다운로드하여 로컬에 저장합니다
 */
export async function downloadImage(imageUrl: string, filename: string): Promise<string> {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });

    const imagesDir = path.join(process.cwd(), 'public', 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const filepath = path.join(imagesDir, filename);
    fs.writeFileSync(filepath, response.data);

    return `/images/${filename}`;
  } catch (error) {
    console.error('이미지 다운로드 오류:', error);
    throw new Error('이미지 저장 실패');
  }
}

/**
 * U2 버튼을 클릭하여 2번 이미지를 업스케일합니다
 */
export async function upscaleImage(
  messageId: string,
  channelId: string
): Promise<MidjourneyResponse> {
  try {
    const token = process.env.DISCORD_TOKEN;

    if (!token || !channelId) {
      throw new Error('Discord 설정이 필요합니다.');
    }

    console.log('U2 업스케일 요청 시작');

    // 실제 메시지에서 U2 버튼의 custom_id를 가져와야 함
    const messagesResponse = await axios.get(
      `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=20`,
      {
        headers: {
          Authorization: token,
        },
      }
    );

    const messages = messagesResponse.data;
    let buttonCustomId: string | null = null;

    // 해당 messageId를 가진 메시지 찾기
    for (const message of messages) {
      if (message.id === messageId && message.components) {
        // U2 버튼 찾기 (components 안에서)
        for (const row of message.components) {
          if (row.components) {
            for (const button of row.components) {
              // U2 버튼 찾기 (label이 "U2"인 버튼)
              if (button.label === 'U2') {
                buttonCustomId = button.custom_id;
                console.log('✅ U2 버튼 custom_id 발견:', buttonCustomId);
                break;
              }
            }
          }
          if (buttonCustomId) break;
        }
      }
      if (buttonCustomId) break;
    }

    if (!buttonCustomId) {
      throw new Error('U2 버튼을 찾을 수 없습니다.');
    }

    // U2 버튼 클릭 - 하지만 Discord Interaction API는 사용자 토큰으로 직접 호출 불가
    // 대신 메시지 직접 전송 방식 사용
    try {
      const interactionResponse = await axios.post(
        `${DISCORD_API_BASE}/interactions`,
        {
          type: 3, // MESSAGE_COMPONENT
          application_id: MIDJOURNEY_BOT_ID,
          channel_id: channelId,
          message_id: messageId,
          session_id: generateSessionId(),
          data: {
            component_type: 2, // BUTTON
            custom_id: buttonCustomId,
          },
          nonce: generateNonce(),
        },
        {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ U2 업스케일 Interaction 응답:', interactionResponse.status);
    } catch (interactionError) {
      if (axios.isAxiosError(interactionError)) {
        console.error('❌ Interaction 오류:', interactionError.response?.data);
        // 400 오류가 나도 계속 진행 (메시지는 이미 전송되었을 수 있음)
      }
    }

    console.log('✅ U2 업스케일 요청 완료, 폴링 시작');

    // 업스케일 이미지 폴링
    const requestTime = Date.now();
    const imageUrl = await pollForUpscaledImage(channelId, token, requestTime);

    if (imageUrl) {
      return {
        success: true,
        imageUrl,
      };
    }

    return {
      success: false,
      error: '업스케일 타임아웃',
    };
  } catch (error) {
    console.error('업스케일 오류:', error);
    if (axios.isAxiosError(error)) {
      console.error('에러 상세:', error.response?.data);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : '업스케일 실패',
    };
  }
}

/**
 * 업스케일된 이미지를 폴링합니다
 */
async function pollForUpscaledImage(
  channelId: string,
  token: string,
  requestTime: number
): Promise<string | null> {
  const maxAttempts = 60;
  const pollInterval = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      const messagesResponse = await axios.get(
        `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=10`,
        {
          headers: {
            Authorization: token,
          },
        }
      );

      const messages = messagesResponse.data;

      for (const message of messages) {
        const messageTime = new Date(message.timestamp).getTime();

        // 요청 시간 1초 전부터 허용 (타이밍 이슈 방지)
        if (messageTime < requestTime - 1000) {
          continue;
        }

        if (message.author.id === MIDJOURNEY_BOT_ID) {
          // 진행률 표시
          if (message.content && message.content.includes('%')) {
            const progressMatch = message.content.match(/\((\d+)%\)/);
            if (progressMatch) {
              console.log(`🔄 업스케일 진행률: ${progressMatch[1]}%`);
            }
          }

          // 업스케일된 이미지 찾기
          if (message.attachments && message.attachments.length > 0) {
            const imageAttachment = message.attachments.find((att: any) =>
              att.content_type?.startsWith('image/')
            );

            if (imageAttachment) {
              console.log('📊 발견된 이미지:', {
                width: imageAttachment.width,
                height: imageAttachment.height,
                url: imageAttachment.url,
                messageTime: new Date(messageTime).toISOString(),
              });

              // 업스케일된 이미지는 해상도가 높음 (1024px 이상)
              // 또는 버튼이 Vary 등으로 변경됨
              if (imageAttachment.width > 1024) {
                console.log('✅ 업스케일 이미지 생성 완료 (고해상도):', imageAttachment.url);
                return imageAttachment.url;
              }

              // Vary, Zoom 등의 버튼이 있는 메시지도 업스케일 완료
              const hasUpscaleButtons = message.components && message.components.some((row: any) =>
                row.components && row.components.some((btn: any) =>
                  btn.label && (btn.label.includes('Vary') || btn.label.includes('Zoom'))
                )
              );

              if (hasUpscaleButtons) {
                console.log('✅ 업스케일 이미지 생성 완료 (Vary 버튼 확인):', imageAttachment.url);
                return imageAttachment.url;
              }
            }
          }
        }
      }

      console.log(`⏳ 업스케일 대기 중... (${i + 1}/${maxAttempts})`);
    } catch (error) {
      console.error('업스케일 폴링 오류:', error);
    }
  }

  return null;
}
