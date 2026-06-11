# TIC TAC TOC

로그인 없이 공유 링크 하나로 친구와 즐기는 프레임워크 기반 틱택토 웹앱입니다.

## 기술 스택

- React 19 + TypeScript
- Vite 8 정적 SPA 빌드
- Zustand 화면·게임 상태 관리
- React Three Fiber + Three.js 실제 3D 큐브
- Trystero WebRTC P2P 친구 대전
- Vitest 게임 도메인 테스트

Next.js와 별도 API 서버는 사용하지 않습니다. 이 제품은 검색 노출이나 서버 렌더링보다 즉시 실행되는 게임 경험과 최소 운영 비용이 중요하므로, 정적 SPA와 P2P 구성이 더 적합합니다.

## 기능

- 클래식 3×3
- 마우스·터치 회전 및 직접 선택이 가능한 3×3×3 큐브
- 돌이 3개만 유지되는 초제한 모드
- 매 턴 0.8초 스피드 모드
- 컴퓨터 연습 모드
- 공유 링크 친구 대전
- 호스트 권위형 착수·재경기·시간초과 검증
- 세 번째 참가자 관전
- 호스트 새로고침 상태 복원

## 실행

```bash
npm ci
npm run dev
```

## 검증

```bash
npm run check
```

이 명령은 타입 검사, 단위 테스트, 프로덕션 빌드, 프로덕션 의존성 보안 감사를
순서대로 실행합니다. UI와 멀티플레이 변경은
[`docs/SMOKE_TEST.md`](docs/SMOKE_TEST.md)의 관련 항목도 확인합니다.

구조와 주요 제약은 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), 에이전트 작업
규칙은 [`AGENTS.md`](AGENTS.md)에 정리되어 있습니다.

`dist/` 폴더를 Cloudflare Pages, Netlify, Vercel 등 정적 호스팅에 배포할 수 있습니다.
