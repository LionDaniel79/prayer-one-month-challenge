# 56사랑 — 56공동체 웹앱

성도를 위한 모바일 우선 PWA입니다. 회원 메뉴는 **기도운동 → 심방신청 → 기도요청 → 커뮤니티 → 공지** 순서입니다.

## 주요 기능

- 관리자 허용 명단 기반 이름/초기 전화번호 비밀번호 로그인, 비밀번호 변경·초기화, 180일 rolling session.
- 기도운동: 시작일부터 달력상 1개월, 월~토, 서울 기준 오늘·어제만 체크/취소. 실제 참여자 기준 통계와 공동순위.
- 심방신청: 날짜별 1건, 관리자 신청 기간·날짜 예외, 별도 샘 리더 관리, Google Calendar 연동. 비공개 심방 사유는 Calendar에 전달하지 않습니다.
- 비공개 기도요청: 회원 작성, 관리자 조회·상태 관리·삭제.
- 커뮤니티: 폴더별 목록형 게시판·검색·페이지, 회원 글쓰기, 본인 게시글/댓글 수정·삭제, 관리자 폴더 생성·이름 변경·게시글 이동·삭제.
- 첨부파일: 최대 2개, 파일당 6MB(6,291,456바이트). 인증된 분할 업로드·다운로드, 해시 검증, 실패 시 재시도. 미완료 글은 다른 회원에게 공개하지 않습니다.
- 좋아요: 게시글마다 회원당 1개, 재클릭 취소, 목록/상세 개수 및 본인 상태 유지. 요청 중복과 응답 유실 재시도로 수가 늘거나 반전되지 않습니다.
- 공지: 관리자 초안·발행·읽음 집계, 이미지 1장(최대 3MB), 회원 메뉴의 읽지 않은 공지 `!` 표시. 기기 알림 권한 없이 앱 내 표시를 사용합니다.
- 관리자 대시보드·기도운동·심방·기도요청·커뮤니티·공지·사용자·설정의 8개 화면.

## 기술 구성

Next.js App Router / React / TypeScript, Drizzle ORM + node-postgres Pool, Supabase PostgreSQL의 비공개 `prayer_app` 스키마, Vercel 서울 함수 배포, Vitest·Playwright·GitHub Actions를 사용합니다. 마이그레이션/검사 스크립트 일부는 Postgres.js를 사용합니다.

커뮤니티 파일은 기존 서버 전용 DB 연결로 저장하며 공개 저장소나 새로운 비밀값이 필요하지 않습니다. 512KiB 단위 전송으로 Vercel 단일 요청/응답 크기 제한보다 작게 유지합니다. 파일은 DB 용량을 사용하므로 [커뮤니티 운영 안내](docs/community-operations.md)의 용량 점검이 필요합니다.

## 환경변수

실제 값은 저장소나 채팅에 올리지 않습니다. 기존 운영 비밀값을 보존합니다.

```text
DATABASE_URL=
SESSION_SECRET=
PHONE_LOOKUP_PEPPER=
ROSTER_ENCRYPTION_KEY=

# Google Calendar
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY=

# 기존 Web Push 연동을 별도 사용하는 경우에만
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_SUBJECT=
```

`DATABASE_URL`은 Supabase pooler 연결 문자열입니다. 세션/전화번호 검색 비밀값은 각각 32자 이상, 두 암호화 키는 서로 다른 32바이트 Base64 값입니다. 사용하지 않는 선택 변수는 빈 문자열로 등록하지 말고 생략합니다. 기존 암호화 키를 변경하면 저장된 정보에 접근할 수 없으므로 임의로 교체하지 않습니다.

## 개발·검증

```bash
npm ci
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

E2E는 배포용 빌드를 `next start`로 실행합니다. CI는 TLS 일회용 PostgreSQL 17에 모든 마이그레이션과 가상 명단을 넣어 로그인부터 검사합니다. DB 검사에는 원격 DB나 실제 회원을 사용하지 않습니다. 로컬 DB 없이 건너뛴 결과를 전체 검증 통과로 간주하지 않습니다.

전체 운영 절차는 [운영 가이드](docs/operations.md), 이번 기능은 [설계](docs/superpowers/specs/2026-09-28-community-board-design.md) 및 [검증 기록](docs/superpowers/execution/2026-09-28-community-board.md)에 있습니다. 기존 공유 Preview에 통합 배포하며 `main` 병합 여부는 별도로 기록합니다.
