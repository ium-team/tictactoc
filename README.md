# TicTacToc

서버/DB 없이 동작하는 온라인 + 컴퓨터 대전 틱택토입니다.

## 기술 스택
- `HTML/CSS/Vanilla JS`
- `WebRTC P2P` (trystero `nostr` strategy, CDN import)
- 정적 호스팅: Cloudflare Pages / Netlify / Vercel 중 아무거나 가능

선택 이유:
- 별도 서버와 DB 없이도 브라우저끼리 실시간 통신 가능
- 빌드 없이 정적 파일만으로 배포 가능
- AI 대전은 브라우저 내 `minimax` 로직으로 처리

## 기능
- 빠른 대전 자동 매칭 (대기열 기반)
- 온라인 1:1 대전 (룸 코드 기반)
- 컴퓨터 대전
  - 쉬움: 랜덤
  - 어려움: 최적 플레이(minimax)
- 승패 판정 / 무승부 판정 / 리셋
- 온라인 경기 종료 후 재경기 투표
  - 둘 다 `현재 사람이랑 다시하기` 동의: 즉시 재경기
  - 그 외: 10초 뒤 연결 종료
  - 내가 `새로운 사람이랑 하기` 선택 시: 10초 뒤 자동으로 빠른 대전 재시작

## 실행
정적 파일이라 바로 실행 가능하지만, 브라우저 보안 정책 때문에 로컬 서버 실행을 권장합니다.

### 방법 1) VS Code Live Server
- `index.html` 열고 Live Server 실행

### 방법 2) Node 간단 서버
```bash
npx serve .
```

그 후 표시된 주소(예: `http://localhost:3000`)로 접속하세요.

## 배포
아래 중 하나에 프로젝트 폴더 그대로 올리면 됩니다.
- Cloudflare Pages
- Netlify
- Vercel

빌드 커맨드/출력 폴더 설정 없이 정적 사이트로 배포하면 됩니다.

## 파일 구조
- `index.html`: UI 구조
- `style.css`: 반응형 스타일
- `app.js`: 게임 로직, AI, P2P 연결
