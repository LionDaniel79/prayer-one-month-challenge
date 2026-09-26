# 기도운동 1달 도전

약 200명의 성도가 휴대폰에서 한 달 동안 월~토 기도 완료를 기록하는 모바일 우선 PWA입니다.

## 핵심 기능

- 이름을 아이디, 전화번호를 비밀번호로 사용하는 간단한 로그인
- 첫 로그인 후 180일 rolling session 기반 자동 로그인
- 최초 등록 시 샘 이름 또는 샘리더 이름으로 샘 검색/선택
- 시작일 기준 1개월 동안 월~토 기도 체크
- 오늘과 어제만 체크/취소 가능
- 시작일부터 오늘까지의 달성률 표시
- 관리자 전체/개인/샘별 통계, 달성률 구간, 공동순위
- 샘·사용자·도전 기간 관리
- 홈 화면 설치용 PWA 아이콘/manifest

## 기술 구성

- Next.js App Router + React + TypeScript
- Drizzle ORM + Postgres.js
- Supabase PostgreSQL
  - Project ref: `mraqwckqvxkozvzyszhv`
  - Region: `ap-northeast-2` (Seoul)
  - Private schema: `prayer_app`
- Vercel 배포 예정
- Vitest + Playwright + GitHub Actions

## 환경변수

서버에서 다음 값이 필요합니다. 실제 값은 GitHub에 커밋하지 않습니다.

```text
DATABASE_URL=
SESSION_SECRET=
PHONE_LOOKUP_PEPPER=
```

- `DATABASE_URL`: Supabase **Shared Pooler / Transaction mode (6543)** 연결 문자열을 사용합니다.
- `SESSION_SECRET`: 32자 이상의 충분히 긴 임의 문자열.
- `PHONE_LOOKUP_PEPPER`: 32자 이상의 별도 임의 문자열.
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

세부 운영 절차는 [docs/operations.md](docs/operations.md)를 참고하세요.
