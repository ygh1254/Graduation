# 설정 가이드

## 1️⃣ Anthropic API 키 발급

### 단계
1. https://console.anthropic.com/ 접속
2. 회원가입 또는 로그인
3. "API Keys" 메뉴로 이동
4. "Create Key" 클릭
5. API 키 복사 (sk-ant-api03-로 시작)

### 비용
- 무료 크레딧 $5 제공
- Claude 3.5 Sonnet: $3 / 1M input tokens, $15 / 1M output tokens
- 프롬프트 생성 1회당 약 $0.001-0.003

---

## 2️⃣ GoAPI 키 발급

### 단계
1. https://goapi.ai/ 접속
2. 회원가입 (이메일 또는 Google 계정)
3. 대시보드에서 "API Keys" 메뉴
4. "Create New Key" 클릭
5. API 키 복사

### 무료 체험
- 신규 가입 시 무료 크레딧 제공
- 테스트용으로 충분

### 요금제
| 모드 | 속도 | 가격 (이미지당) |
|------|------|-----------------|
| Fast | 1-2분 | $0.08 |
| Relax | 5-10분 | $0.03 |
| Turbo | 30초 | $0.12 |

---

## 3️⃣ 환경 변수 설정

### .env.local 파일 수정

프로젝트 루트의 [.env.local](graduation/.env.local) 파일을 열어서:

```bash
# Anthropic API Key (위에서 복사한 키)
ANTHROPIC_API_KEY=sk-ant-api03-여기에_실제_키_붙여넣기

# GoAPI (위에서 복사한 키)
MIDJOURNEY_API_KEY=여기에_GoAPI_키_붙여넣기
MIDJOURNEY_API_URL=https://api.goapi.ai/mj
```

### 주의사항
- `.env.local` 파일은 git에 커밋되지 않음 (`.gitignore`에 포함)
- API 키는 절대 공개하지 말 것
- 배포 시 Vercel 환경변수에 별도 설정 필요

---

## 4️⃣ 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속

---

## 5️⃣ 테스트

### 첫 이미지 생성 테스트
1. 웹 페이지 접속
2. 입력란에 입력: "귀여운 고양이가 해변에서 선글라스를 쓰고 있는 모습"
3. "✨ 이미지 생성하기" 클릭
4. 1-2분 대기
5. 결과 확인:
   - 생성된 Midjourney 프롬프트
   - 생성된 이미지

### 예상 결과
```
생성된 Midjourney 프롬프트:
A cute cat wearing sunglasses on a sunny beach, photorealistic,
golden hour lighting, detailed fur texture, ocean waves in background,
professional photography, 8k resolution --ar 16:9 --v 6
```

---

## ❓ 문제 해결

### API 키 오류
```
Error: GoAPI 설정이 필요합니다
```
→ `.env.local` 파일의 API 키 확인

### 이미지 생성 실패
```
Error: 이미지 생성 실패
```
→ GoAPI 크레딧 잔액 확인 (https://goapi.ai/dashboard)

### 타임아웃 오류
```
Error: timeout of 120000ms exceeded
```
→ 정상 (이미지 생성 시간이 오래 걸림)
→ 나중에 폴링 기능 추가 예정

### 포트 충돌
```
Error: Port 3000 is already in use
```
→ 다른 Next.js 앱 종료 또는
→ `npm run dev -- -p 3001` (다른 포트 사용)

---

## 📱 핸드폰에서 접속

### 방법 1: ngrok (추천)

```bash
# ngrok 설치
brew install ngrok

# 터널 생성
ngrok http 3000
```

생성된 URL (예: `https://abc123.ngrok-free.app`)을 핸드폰 브라우저에서 접속

### 방법 2: Vercel 배포

```bash
# Vercel CLI 설치
npm install -g vercel

# 로그인
vercel login

# 배포
vercel
```

배포 후 Vercel 대시보드에서 환경변수 설정:
- `ANTHROPIC_API_KEY`
- `MIDJOURNEY_API_KEY`
- `MIDJOURNEY_API_URL`

---

## 💰 비용 계산

### 예시: 이미지 10개 생성

**Claude (프롬프트 생성)**
- 입력: ~200 tokens × 10 = 2,000 tokens
- 출력: ~100 tokens × 10 = 1,000 tokens
- 비용: ~$0.02

**GoAPI (이미지 생성)**
- Fast 모드: $0.08 × 10 = $0.80
- Relax 모드: $0.03 × 10 = $0.30

**총 비용**: $0.32 - $0.82

무료 크레딧으로 충분히 테스트 가능!

---

## 🎯 다음 단계

프로젝트가 정상 작동하면:

1. [ ] 프롬프트 프리셋 추가
2. [ ] 이미지 갤러리 만들기
3. [ ] 폴링 기능으로 실시간 진행상태 표시
4. [ ] Vercel에 배포하기
5. [ ] 커스텀 도메인 연결

즐거운 개발 되세요! 🚀
