# 새 공동체용 독립 설치 가이드

이 문서는 56사랑 코드를 **다른 공동체가 별도 서비스로 운영**하기 위한 설치 절차입니다. 목표는 코드만 재사용하고 기존 56공동체의 회원·기도요청·심방·게시글·비밀키를 전혀 공유하지 않는 것입니다.

## 0. 원칙

새 설치는 반드시 다음 항목을 새로 만듭니다.

- GitHub 저장소 또는 Fork
- Supabase 프로젝트와 PostgreSQL 데이터
- `SESSION_SECRET`, `PHONE_LOOKUP_PEPPER`, `ROSTER_ENCRYPTION_KEY`
- Vercel 프로젝트
- Google Calendar를 쓸 경우 Google OAuth Client와 `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`

**기존 운영 DB의 `DATABASE_URL`이나 기존 암호화 키를 복사하지 마세요.** 암호화 키와 DB를 섞으면 개인정보 분리 원칙이 깨지고, 키가 맞지 않으면 기존 암호화 데이터를 읽을 수도 없습니다.

## 1. GitHub 저장소 준비

원본 저장소를 Fork하거나 새 저장소로 복사합니다. 기본 브랜치는 `main`을 사용합니다.

로컬 준비:

```bash
git clone <새 저장소 URL>
cd <저장소 폴더>
npm ci
```

Node.js 22.x를 사용합니다.

## 2. 새 Supabase 프로젝트 생성

Supabase에서 **새 프로젝트**를 만듭니다. Vercel 함수가 서울(`icn1`)에서 실행되므로 가능하면 Supabase도 서울 리전을 사용합니다.

현재 Supabase 연결 안내:
https://supabase.com/docs/guides/database/connecting-to-postgres

새 프로젝트에서 두 종류의 연결을 구분합니다.

- 앱 실행용 `DATABASE_URL`: Vercel 같은 serverless 환경에서는 Dashboard의 **Connect → Transaction pooler** 연결 문자열을 사용합니다.
- 초기 SQL 적용: Supabase Dashboard의 **SQL Editor**를 사용하는 것이 가장 단순합니다.

DB 비밀번호에 `&`, `#`, `?`, 공백 같은 문자가 있으면 연결 문자열에서 URL 인코딩이 필요합니다. Dashboard가 제공하는 문자열을 직접 복사하세요.

## 3. 새 DB에 마이그레이션 적용

이 절차는 **새 Supabase 프로젝트 전용**입니다. 기존 운영 DB에 다시 실행하지 마세요.

먼저 SQL Editor에서 아래 쿼리를 실행합니다.

```sql
select to_regnamespace('prayer_app') as existing_schema;
```

결과가 `null`이어야 새 설치입니다. 이미 `prayer_app`이 존재하면 중지하고 해당 DB가 새 프로젝트가 맞는지 확인합니다.

로컬에서 모든 마이그레이션을 파일명 순서대로 하나로 합칩니다.

macOS/Linux:

```bash
cat $(find drizzle -maxdepth 1 -type f -name '*.sql' | sort) > fresh-install.sql
```

PowerShell:

```powershell
Get-ChildItem .\drizzle\*.sql |
  Sort-Object Name |
  Get-Content |
  Set-Content .\fresh-install.sql -Encoding utf8
```

생성된 `fresh-install.sql`의 내용을 새 Supabase 프로젝트의 SQL Editor에서 한 번 실행합니다. 오류가 발생하면 다음 파일로 넘어가지 말고 원인을 먼저 해결합니다.

적용 확인:

```sql
select count(*) as app_tables
from pg_tables
where schemaname = 'prayer_app';

select
  has_schema_privilege('anon', 'prayer_app', 'usage') as anon_schema_usage,
  has_schema_privilege('authenticated', 'prayer_app', 'usage') as authenticated_schema_usage;
```

두 schema usage 값은 `false`여야 합니다. 앱은 Supabase 브라우저 API가 아니라 서버의 PostgreSQL 연결을 통해 private `prayer_app` 스키마에 접근합니다.

## 4. 새 비밀값 생성

비밀값은 로컬 터미널에서 생성하고 GitHub·채팅·문서에 기록하지 않습니다.

세션/전화번호 검색 비밀값:

```bash
node -e "const c=require('crypto'); console.log(c.randomBytes(48).toString('base64url'))"
```

위 명령을 **두 번** 실행해 서로 다른 값을 만듭니다.

- 첫 번째 → `SESSION_SECRET`
- 두 번째 → `PHONE_LOOKUP_PEPPER`

32바이트 Base64 암호화 키:

```bash
node -e "const c=require('crypto'); console.log(c.randomBytes(32).toString('base64'))"
```

- 첫 번째 → `ROSTER_ENCRYPTION_KEY`
- Google Calendar를 사용할 때 한 번 더 생성 → `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`

두 암호화 키는 같은 값을 재사용하지 않습니다.

로컬 개발용 `.env.local` 예:

```text
DATABASE_URL=<새 Supabase Transaction pooler URL>
SESSION_SECRET=<새 값>
PHONE_LOOKUP_PEPPER=<새 값>
ROSTER_ENCRYPTION_KEY=<새 32-byte Base64 값>
```

`.env.local`은 커밋하지 않습니다.

## 5. 첫 관리자 계정 생성

DB 마이그레이션과 필수 환경변수 설정 후 첫 관리자만 로컬 bootstrap 명령으로 만듭니다.

`.env.local`에 잠시 추가:

```text
BOOTSTRAP_ADMIN_NAME=관리자이름
BOOTSTRAP_ADMIN_PHONE=01012345678
BOOTSTRAP_SAM_NAME=관리자소속샘
BOOTSTRAP_SAM_LEADER=샘리더이름
```

실행:

```bash
npm run admin:bootstrap
```

`Bootstrap administrator created.`가 나오면 성공입니다. 첫 관리자는 이름과 전화번호를 초기 비밀번호로 사용해 로그인합니다.

성공 후 `BOOTSTRAP_ADMIN_*`, `BOOTSTRAP_SAM_*` 네 값은 `.env.local`에서 제거합니다. **Vercel 환경변수로 등록하지 않습니다.**

이후 실제 성도 명단은 관리자 → 사용자 관리에서 XLS/XLSX로 가져옵니다. 첫 관리자 이름/전화번호도 명단에 포함시키는 것을 권장합니다.

## 6. 로컬 검증

최소 검증:

```bash
npm test
npm run lint
npm run build
```

로컬 서버:

```bash
npm run dev
```

확인:

- 첫 관리자 로그인
- 사용자 관리 접근
- 기도운동 관리 화면
- 커뮤니티 폴더 관리
- 공지 관리

E2E는 실제 운영 DB가 아니라 CI용 일회용 DB를 전제로 설계되어 있으므로 운영 Supabase에 `scripts/seed-e2e.ts`를 실행하지 않습니다.

## 7. Vercel에 새 프로젝트 배포

Vercel → Add New Project → 새 GitHub 저장소 Import 순서로 연결합니다.

현재 Vercel 안내:
https://vercel.com/docs/deployments/git

`vercel.json`이 함수 리전을 서울 `icn1`로 지정합니다. Project Settings → Environment Variables에 **Production과 Preview 각각 필요한 범위**로 다음 값을 설정합니다.

필수:

```text
DATABASE_URL
SESSION_SECRET
PHONE_LOOKUP_PEPPER
ROSTER_ENCRYPTION_KEY
```

Google Calendar를 사용할 경우 추가:

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY
```

선택 Web Push:

```text
WEB_PUSH_VAPID_PUBLIC_KEY
WEB_PUSH_VAPID_PRIVATE_KEY
WEB_PUSH_SUBJECT
```

환경변수를 변경하면 새 배포를 실행합니다. `NEXT_PUBLIC_*` 이름으로 비밀값을 만들지 않습니다.

## 8. Google Calendar 사용 시

Google Calendar를 사용하지 않으면 이 단계는 건너뜁니다.

Google Cloud에서:

1. Google Calendar API 활성화
2. OAuth consent screen 구성
3. OAuth Client를 **Web application**으로 생성
4. 새 Production 주소의 callback 등록

Callback:

```text
https://<새-서비스-도메인>/api/admin/google-calendar/callback
```

Preview에서도 Google 연동을 시험하려면 Preview 주소 callback도 별도로 등록합니다.

Vercel에 Google 환경변수를 넣은 후 재배포하고 관리자 → 설정에서 Google 계정을 연결한 뒤 실제 사용할 Calendar를 선택합니다.

Google OAuth secret과 refresh token은 다른 운영자에게 공유하지 않습니다.

## 9. GitHub 공개 스모크 테스트 연결

이 저장소의 `.github/workflows/public-preview-smoke.yml`은 더 이상 원본 56사랑 주소를 하드코딩하지 않습니다.

새 저장소의 GitHub → Settings → Secrets and variables → Actions → Variables에 다음 repository variable을 만듭니다.

필수:

```text
PUBLIC_APP_URL=https://<검증할-배포-도메인>
```

브랜딩을 바꿨다면 선택:

```text
PUBLIC_APP_NAME=<PWA 이름>
PUBLIC_APP_HEADING=<로그인 화면 제목>
PUBLIC_RELEASE_MARKER=<community-release.json의 release 값>
```

`PUBLIC_APP_URL`을 설정하지 않으면 공개 스모크 단계는 원본 앱을 대신 검사하지 않고 안내만 출력하고 종료합니다.

## 10. 공동체 이름과 아이콘 바꾸기

기본 브랜드를 그대로 쓰지 않을 경우 먼저 다음 문자열 위치를 찾습니다.

```bash
git grep -nE '56사랑|56공동체|엡 4:3|56-heart'
```

주요 파일:

- `app/layout.tsx`: 브라우저/PWA metadata와 iOS 이름
- `app/manifest.ts`: 설치 이름·아이콘
- `components/app/MemberShell.tsx`: 앱 헤더와 사이드바
- `app/login/page.tsx`: 로그인 화면
- `public/icons/`: 설치 아이콘

브랜드를 바꾸면 관련 테스트의 기대 문구도 함께 수정하고 `npm test && npm run build`를 다시 실행합니다.

## 11. 최초 운영 설정

정식 서비스에 들어가기 전에 관리자 화면에서 다음을 준비합니다.

- 실제 사용자 명단 가져오기
- 샘 리더 명단 등록
- 기도운동 제목/기간/활성 상태 설정
- 심방 신청 기간과 가능일 설정
- Google Calendar 사용 시 연결과 운영 Calendar 선택
- 공지/커뮤니티 폴더 확인

실제 사용자 데이터로 시험해야 할 경우 최소한으로 사용하고 시험 자료는 정리합니다.

## 12. 복사하면 안 되는 것

다른 공동체로 이전할 때 다음 값/데이터는 원본에서 가져가지 않습니다.

- 기존 Supabase DB와 DB 비밀번호
- 기존 회원 명단/전화번호/기도요청/심방 사유/커뮤니티 자료
- 기존 `SESSION_SECRET`, `PHONE_LOOKUP_PEPPER`
- 기존 `ROSTER_ENCRYPTION_KEY`
- 기존 Google OAuth Client Secret과 Google token 암호화 키
- 기존 VAPID Private Key
- 기존 Vercel 프로젝트의 비밀 환경변수

같은 조직이 **기존 데이터까지 공식 승계**해야 하는 별도 이전 작업은 이 가이드의 범위가 아닙니다. 그 경우 데이터 처리 책임과 암호화 키 이전을 별도로 검토해야 합니다.

## 13. 설치 완료 기준

아래가 모두 되면 독립 설치가 완료된 것입니다.

- 새 GitHub 저장소의 `main`에서 빌드 성공
- 새 Supabase에 `prayer_app` 테이블 생성
- anon/authenticated가 private schema를 직접 사용하지 못함
- 새 Vercel Production 주소의 `/api/health`가 DB 정상 반환
- 첫 관리자 로그인 성공
- 자기 공동체의 사용자 명단 등록 가능
- 커뮤니티 글/댓글/좋아요와 첨부파일 동작
- 공지 이미지 동작
- Google Calendar 사용 시 새 OAuth Client로 연결 성공

문제가 있으면 [운영 가이드](operations.md)의 장애 대응을 함께 확인합니다.
