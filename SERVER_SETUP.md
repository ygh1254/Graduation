# 프린트 서버 설정 가이드

## 1. 프로젝트 파일 복사
새 서버 컴퓨터로 다음 파일들만 복사:
- `server.js`
- `package.json`
- `.env.local` (환경 변수 파일, 새로 생성 가능)

## 2. 서버 컴퓨터에서 설치
```bash
npm install express cors axios sharp
```

## 3. 프린터 연결 및 드라이버 설치
- BIXOLON SRP-330II 프린터를 USB로 연결
- macOS 시스템 환경설정 → 프린터 및 스캐너에서 프린터 추가
- 프린터 이름이 `BIXOLON_SRP_330II`인지 확인 (다르면 server.js 수정)

## 4. 프린터 이름 확인
```bash
lpstat -p
```

## 5. 서버 실행
```bash
node server.js
```
→ http://localhost:3001 에서 실행됨

## 6. 외부 접근 설정 (2가지 방법)

### 방법 A: ngrok 사용 (간편, 외부 네트워크 접근)
```bash
# ngrok 설치
brew install ngrok

# ngrok 인증 (한 번만)
ngrok config add-authtoken YOUR_AUTHTOKEN

# 터널 시작
ngrok http 3001
```
→ 생성된 URL (예: https://xxxx.ngrok-free.app)을 Vercel 환경 변수에 설정

### 방법 B: 로컬 네트워크 IP 사용 (같은 Wi-Fi만)
```bash
# 서버 컴퓨터의 IP 주소 확인
ifconfig | grep "inet " | grep -v 127.0.0.1
```
→ 예: 192.168.1.100

서버 실행 시 모든 네트워크 인터페이스에서 listen하도록 수정:
`server.js` 마지막 줄을
```javascript
app.listen(3001, '0.0.0.0', () => {
    console.log('프린터 서버가 http://0.0.0.0:3001 에서 실행 중입니다.');
});
```
로 변경

Vercel 환경 변수:
```
NEXT_PUBLIC_PRINT_SERVER_URL=http://192.168.1.100:3001
```

## 7. Vercel 환경 변수 업데이트
Vercel 대시보드 → Settings → Environment Variables:
```
NEXT_PUBLIC_PRINT_SERVER_URL=https://xxxx.ngrok-free.app
```
(또는 로컬 IP 사용 시 http://192.168.1.100:3001)

저장 후 재배포!

## 8. 테스트
서버 컴퓨터에서:
```bash
curl http://localhost:3001/printer-status
```

다른 컴퓨터에서:
```bash
curl http://서버IP:3001/printer-status
```

## 주의사항
- ngrok: 무료 플랜은 세션이 끊기면 URL 변경됨 (유료는 고정 URL)
- 로컬 IP: 같은 Wi-Fi만 접근 가능, IP 주소 변경될 수 있음
- 방화벽: 3001 포트가 열려있어야 함
