# 56사랑 — 56공동체 웹앱

약 200명의 성도를 위한 모바일 우선 PWA입니다. 기도운동, 심방신청, 비공개 기도요청, 공지를 제공합니다.

## 핵심 기능

- 관리자 허용 명단 기반 로그인: 이름을 아이디, 등록 전화번호를 초기 비밀번호로 사용
- 회원 비밀번호 변경 및 관리자 초기화
- 첫 로그인 후 180일 rolling session 기반 자동 로그인
- 샘 정보는 허용 명단에서 관리하며, 실제 로그인한 사용자만 참여자로 집계
- 시작일 기준 1개월 동안 월~토 기도 체크
- 서울 시간 기준 오늘과 어제만 체크/취소 가능, 응답 유실 후 같은 저장 요청 재시도 지원
- 시작일부터 오늘까지의 달성률 표시
- 관리자 전체/개인/샘별 통계, 달성률 구간, 공동순위
- 날짜별 1건의 심방신청과 Google Calendar 연동 (심방 사유는 Calendar에 전달하지 않음)
- 관리자만 조회하는 비공개 기도요청과 처리 상태 관리
- 공지 초안/발행/읽음 배지 및 선택적 Web Push
- 관리자 대시보드·기도운동·심방·기도요청·공지·사용자·설정의 7개 화면
- 홈 화면 설치용 PWA 아이콘/manifest

## 기술 구성

- Next.js App Router + React + TypeScript
- Drizzle ORM + Postgres.js
- Supabase PostgreSQL
  - Project ref: `mraqwckqvxkozvzyszhv`
  - Region: `ap-northeast-2` (Seoul)
  - Private schema: `prayer_app`
- Vercel Preview 배포, 사용자 승인 후 출시
- Vitest + Playwright + GitHub Actions

## 환경변수

서버에서 다음 값이 필요합니다. 실제 값은 GitHub에 커밋하지 않습니다.

```text
DATABASE_URL=
SESSION_SECRET=
PHONE_LOOKUP_PEPPER=
ROSTER_ENCRYPTION_KEY=

# Google Calendar를 사용할 때
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY=

# Web Push를 사용할 때
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_SUBJECT=
```

- `DATABASE_URL`: Supabase **Shared Pooler / Transaction mode (6543)** 연결 문자열을 사용합니다.
- `SESSION_SECRET`: 32자 이상의 충분히 긴 임의 문자열.
- `PHONE_LOOKUP_PEPPER`: 32자 이상의 별도 임의 문자열.
- 두 암호화 키는 각각 별도로 생성한 32바이트의 Base64 값입니다. 기존 운영 키를 임의로 바꾸면 저장된 값에 접근할 수 없으므로 보존합니다.
- 사용하지 않는 Google Calendar/Web Push 선택 변수는 빈 문자열로 등록하지 말고 생략합니다. `.env.example`의 필수 값은 실제 로컬 설정에 채웁니다.
- Postgres.js는 transaction pooler 호환을 위해 `prepare: false`로 설정되어 있습니다.

## 개발 및 검증

```bash
npm ci
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

E2E는 먼저 만든 production build를 `next start`로 실행합니다. CI는 TLS를 켠 일회용 PostgreSQL 17에 마이그레이션과 가상 명단을 넣어 로그인부터 검증합니다. 로컬 DB가 없으면 DB 검사들은 건너뛰므로 이 결과를 전체 통합 검증 통과로 간주하지 않습니다.

동일한 DB 검증을 로컬에서 실행하려면 비어 있는 `localhost` 또는 `127.0.0.1`의 `prayer_e2e` DB와 테스트 전용 서버 환경변수를 준비하고, `CI=true`, `E2E_DATABASE_READY=1`로 `npx tsx scripts/seed-e2e.ts`를 실행한 뒤 E2E를 실행합니다. 시드는 원격 DB와 기존 앱 스키마가 있는 DB를 거부합니다. 운영 DB/실제 회원을 사용하지 않습니다.

세부 운영 절차는 [docs/operations.md](docs/operations.md)를 참고하세요.
