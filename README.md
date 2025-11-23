# 건설 작업자 이미지 생성기 (Graduation)

무게(1-100g)를 선택하면 작업자가 돌을 드는 3D Blender 이미지를 생성하는 웹 애플리케이션입니다.

## 📋 전체 플로우

```
사용자 입력 (1-100g 드롭다운)
    ↓
고정된 프롬프트에 무게 삽입
    ↓
Discord를 통해 공식 Midjourney 봇으로 이미지 생성
    ↓
이미지 저장 (public/images/)
    ↓
결과 표시 (웹 페이지)
```

## 🚀 시작하기

### 1. Midjourney 구독 확인

**필수 요구사항:**
- Midjourney 유료 구독 (Basic, Standard, Pro 중 하나)
  - 구독: https://www.midjourney.com/account
- Discord 계정 (Midjourney와 연결된 계정)

### 2. Discord 설정

#### Step 1: Discord 개발자 모드 활성화

1. Discord 앱 실행
2. 설정(⚙️) → 고급 → **개발자 모드** 활성화

#### Step 2: Discord 서버 및 채널 ID 얻기

1. Midjourney 봇이 있는 Discord 서버 선택
2. 서버 이름 **우클릭** → **ID 복사** (서버 ID)
3. Midjourney를 사용할 채널(예: #general) **우클릭** → **ID 복사** (채널 ID)

#### Step 3: Discord 토큰 얻기

**방법 1: 사용자 토큰 (권장 - 간단)**

1. Discord 웹 브라우저 버전 접속: https://discord.com/app
2. `F12` 또는 `Cmd+Option+I`로 개발자 도구 열기
3. **Console** 탭 선택
4. 다음 코드 입력 후 엔터:

```javascript
window.webpackChunkdiscord_app.push([
  [Math.random()],
  {},
  req => {
    if (!req.c) return;
    for (const m of Object.keys(req.c)
      .map(x => req.c[x].exports)
      .filter(x => x)) {
      if (m.default && m.default.getToken !== undefined) {
        return m.default.getToken();
      }
      if (m.getToken !== undefined) {
        return m.getToken();
      }
    }
  },
]);
```

5. 복사된 토큰 저장 (매우 중요한 정보이므로 절대 공유하지 마세요!)

**방법 2: Discord Bot 생성 (고급)**

1. https://discord.com/developers/applications 접속
2. **New Application** 클릭
3. Bot 생성 및 토큰 복사
4. Bot을 서버에 초대

⚠️ **보안 주의**: Discord 토큰은 절대 공개하거나 공유하지 마세요!

### 3. 환경 변수 설정

`.env.local` 파일을 수정하세요:

```bash
# Anthropic API Key (Claude API) - 선택사항
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Discord Midjourney 설정
DISCORD_SERVER_ID=1234567890123456789  # Step 2에서 복사한 서버 ID
DISCORD_CHANNEL_ID=9876543210987654321  # Step 2에서 복사한 채널 ID
DISCORD_TOKEN=your_discord_token_here   # Step 3에서 얻은 토큰
```

### 4. 의존성 설치

```bash
npm install
```

### 5. 개발 서버 실행

```bash
npm run dev
```

로컬: http://localhost:3000

### 6. 사용 방법

1. 웹 페이지에서 돌의 무게 선택 (1-100g)
2. **Generate** 버튼 클릭
3. 약 1-2분 대기 (Midjourney 이미지 생성 중)
4. 생성된 이미지 확인

## 📱 다른 네트워크에서 접속하기

### 방법 1: ngrok (테스트용)

```bash
# ngrok 설치
brew install ngrok

# 터널 생성
ngrok http 3000
```

생성된 URL을 핸드폰에서 접속

### 방법 2: Vercel 배포 (프로덕션)

```bash
# Vercel CLI 설치
npm install -g vercel

# 배포
vercel

# 환경변수 설정 (Vercel 대시보드에서)
# - DISCORD_SERVER_ID
# - DISCORD_CHANNEL_ID
# - DISCORD_TOKEN
```

## 🛠️ Discord Midjourney 설정 가이드

### 작동 원리

이 프로젝트는 Discord의 공식 Midjourney 봇과 직접 통신합니다:
1. `midjourney` npm 패키지 사용
2. Discord API를 통해 `/imagine` 명령어 실행
3. WebSocket으로 실시간 진행 상태 모니터링
4. 완료된 이미지 URL 자동 수신

### 장점

✅ **공식 Midjourney 사용** - 서드파티 API 없음
✅ **추가 비용 없음** - Midjourney 구독료만 필요
✅ **안정적** - 공식 Discord 봇 사용
✅ **모든 기능 지원** - Upscale, Variation 등

### 제한사항

⚠️ Discord 사용자 토큰 사용 시 Discord ToS 위반 가능성
⚠️ 과도한 사용 시 계정 제한 가능
⚠️ 개인 프로젝트/테스트 용도로만 사용 권장

### 대안

프로덕션 환경에서는 공식 Midjourney API 사용 권장:
- https://docs.midjourney.com/
- 별도 API 키 및 비용 필요

## 📁 프로젝트 구조

```
graduation/
├── app/
│   ├── page.tsx              # Next.js React UI (드롭다운)
│   └── api/
│       └── generate/
│           └── route.ts      # API 엔드포인트
├── lib/
│   ├── claude.ts             # 프롬프트 생성 로직
│   └── midjourney.ts         # Discord Midjourney 통합
├── public/
│   └── images/               # 생성된 이미지 저장
├── web.html                  # 정적 HTML 버전
├── style.css                 # 스타일시트
└── .env.local                # 환경 변수 (Discord 설정)
```

## 🔧 주요 파일 설명

### `lib/claude.ts`
- `generateMidjourneyPrompt()`: 무게를 프롬프트에 삽입
- 고정 프롬프트: `3d blender image, construction worker who lightly moves a small {number}g stone with one hand. --ar 1:1 --sref https://s.mj.run/hz-xLHoG7ME --oref https://s.mj.run/41xbnVXeOz0`

### `lib/midjourney.ts`
- `generateImage()`: Discord를 통해 Midjourney `/imagine` 실행
- `downloadImage()`: 생성된 이미지 다운로드 및 저장
- `upscaleImage()`: U1~U4 업스케일
- `createVariation()`: V1~V4 변형 생성

### `app/api/generate/route.ts`
- POST 요청 처리
- 프롬프트 생성 → Midjourney 호출 → 이미지 저장

## 💡 사용 예시

1. 드롭다운에서 "50g" 선택
2. Generate 버튼 클릭
3. 프롬프트: `3d blender image, construction worker who lightly moves a small 50g stone with one hand. --ar 1:1 --sref ... --oref ...`
4. Discord Midjourney 봇이 이미지 생성 (약 60초)
5. 이미지가 `/public/images/`에 저장되고 화면에 표시

## ⚠️ 주의사항

1. **Discord 토큰 보안**: `.env.local` 파일은 절대 git에 커밋하지 마세요
2. **Midjourney 구독**: 유료 구독이 필요합니다 (약 $10/월부터)
3. **생성 시간**: 이미지 생성에 1-2분 소요
4. **Discord ToS**: 사용자 토큰 사용은 Discord 서비스 약관 위반 가능성
5. **Rate Limit**: Discord/Midjourney 제한에 주의

## 🐛 문제 해결

### "Discord 설정이 필요합니다" 오류
→ `.env.local`에 `DISCORD_SERVER_ID`, `DISCORD_CHANNEL_ID`, `DISCORD_TOKEN` 확인

### "토큰이 유효하지 않습니다" 오류
→ Discord 토큰 재발급 (Step 3 반복)

### 이미지 생성 타임아웃
→ Midjourney 서버 혼잡 또는 구독 만료 확인

### "Midjourney 봇을 찾을 수 없습니다"
→ 해당 Discord 서버에 Midjourney 봇이 있는지 확인

## 🔜 향후 개선 사항

- [ ] 실시간 생성 진행 상태 표시
- [ ] 업스케일(U1-U4) 및 변형(V1-V4) UI 추가
- [ ] 생성 히스토리 및 갤러리
- [ ] 이미지 다운로드 버튼
- [ ] 공식 Midjourney API 통합 옵션

## 📝 라이센스

MIT

---

**참고 자료:**
- Midjourney 공식: https://www.midjourney.com/
- Discord 개발자: https://discord.com/developers
- midjourney npm: https://www.npmjs.com/package/midjourney
