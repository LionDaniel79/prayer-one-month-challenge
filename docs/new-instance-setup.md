# 새 공동체용 독립 설치 가이드 — 완전 초보자용

이 문서는 **GitHub 계정도 없고 개발 경험도 없는 사람**이 56사랑 프로그램을 자기 공동체용으로 새로 설치하는 과정을 처음부터 설명합니다.

목표는 **프로그램 코드는 복사하되, 기존 56공동체의 회원·전화번호·기도요청·심방내용·게시글·비밀키는 전혀 가져오지 않는 독립 설치**입니다.

## 시작 전에 준비할 것

- Windows 10/11 또는 macOS가 설치된 **PC/Mac 한 대**를 준비합니다. 스마트폰만으로 전체 설치하는 것은 권장하지 않습니다.
- 이메일을 받을 수 있어야 합니다.
- Google Calendar를 쓸 예정이면 운영에 사용할 Google 계정을 하나 정해 둡니다.
- 비밀번호와 비밀키를 저장할 **비밀번호 관리자** 또는 안전한 개인 저장공간을 준비합니다.
- 서비스 가입에 사용하는 GitHub/Supabase/Vercel 계정은 가능하면 **실제 운영 책임자 명의**로 통일합니다.
- Supabase/Vercel의 무료 플랜 제공 여부와 한도는 각 서비스의 현재 화면을 확인하세요.

> 이 앱은 새 설치마다 별도의 DB와 비밀키가 필요합니다. 기존 56사랑 운영자의 비밀값을 받아서 쓰는 방식으로 설치하지 않습니다.

---

## 먼저 알아둘 말 6개

처음 보는 단어가 많아도 아래 정도만 이해하면 됩니다.

- **GitHub**: 프로그램 소스 파일을 보관하는 인터넷 저장소입니다.
- **Repository(리포지토리/저장소)**: GitHub 안의 프로그램 한 묶음입니다.
- **Fork(포크)**: 다른 사람의 GitHub 프로그램을 **내 GitHub 계정으로 복사**하는 기능입니다. 원본을 망가뜨리지 않고 내 복사본을 운영할 수 있습니다.
- **Supabase**: 회원, 기도체크, 심방, 게시판 같은 데이터를 저장하는 데이터베이스 서비스입니다.
- **Vercel**: GitHub의 프로그램을 인터넷에서 실제 웹사이트로 실행해 주는 서비스입니다.
- **Google Cloud**: Google Calendar 연동을 사용할 때 필요한 서비스입니다. Calendar를 쓰지 않으면 나중에 건너뛸 수 있습니다.

이 프로그램에서 로그인은 Supabase Auth를 쓰지 않습니다. **Supabase의 Authentication 메뉴에 회원을 만들 필요가 없습니다.** 앱 자체의 명단 로그인 방식을 사용합니다.

---

# 전체 순서 한눈에 보기

처음 설치할 때는 아래 순서대로 진행하면 됩니다.

1. GitHub 계정 만들기
2. 원본 56사랑 저장소를 내 GitHub로 Fork
3. GitHub Desktop과 Node.js 설치
4. 내 Fork를 컴퓨터로 내려받기
5. Supabase 가입 및 새 프로젝트 만들기
6. 새 데이터베이스에 56사랑 테이블 만들기
7. 새 비밀키 만들기
8. 첫 관리자 계정 만들기
9. Vercel 가입 및 GitHub 저장소 연결
10. Vercel 환경변수 등록 후 첫 배포
11. 실제 사이트 로그인 확인
12. 실제 성도 명단과 샘리더·마을장 등록
13. 기도운동·심방·목양지 기본 운영 설정
14. 필요하면 Google Calendar 연결
15. 자기 공동체 이름·아이콘으로 변경 후 운영 시작

**중요:** 기존 56공동체의 DB 주소나 비밀키를 복사하지 않습니다.

---

# 1. GitHub 계정 만들기

GitHub 공식 가입 안내:
https://docs.github.com/ko/account-and-profile/how-tos/account-management/creating-an-account-on-github

가입 페이지:
https://github.com/signup

## 가장 쉬운 방법

1. 위 가입 페이지를 엽니다.
2. 화면에 **Continue with Google**이 보이면 Google 계정으로 가입하는 것이 편합니다.
3. 또는 이메일 주소와 비밀번호를 입력해서 새 계정을 만듭니다.
4. GitHub에서 보낸 이메일을 열어 **이메일 인증**을 완료합니다.
5. GitHub에 다시 로그인합니다.

GitHub는 이메일 인증을 하지 않으면 저장소 생성 같은 기본 기능이 제한될 수 있습니다.

## 계정 보안

가능하면 GitHub의 2단계 인증(2FA)도 켜는 것을 권장합니다.

절대 다른 사람의 GitHub 계정을 빌려 쓰지 말고, **실제 운영 책임자의 계정**으로 만드세요.

---

# 2. 56사랑 저장소를 내 계정으로 Fork하기

원본 저장소:
https://github.com/LionDaniel79/prayer-one-month-challenge

GitHub 공식 Fork 안내:
https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo

## 화면에서 하는 순서

1. GitHub에 로그인합니다.
2. 위 원본 저장소 주소를 엽니다.
3. 화면 오른쪽 위의 **Fork** 버튼을 누릅니다.
4. **Owner**는 방금 만든 내 GitHub 계정을 선택합니다.
5. **Repository name**은 그대로 두어도 됩니다.
   - 기본값: `prayer-one-month-challenge`
   - 원하면 예: `my-church-community`처럼 바꿔도 됩니다.
6. **Copy the DEFAULT branch only**가 보이면 체크한 상태로 두는 것을 권장합니다.
7. **Create fork**를 누릅니다.
8. 잠시 후 주소가 다음처럼 바뀌면 성공입니다.

```text
https://github.com/내아이디/prayer-one-month-challenge
```

이제부터는 **내 Fork가 내 프로그램 원본**입니다. 여기에서 수정해도 기존 56사랑 프로그램에는 영향을 주지 않습니다.

> 주의: 원본 저장소가 공개 저장소이므로 Fork도 공개 코드로 운영되는 형태입니다. 회원 데이터와 비밀키는 코드에 넣지 않기 때문에 실제 개인정보가 공개되는 구조는 아닙니다.

## 2-1. Fork 직후 GitHub Actions 켜기

공개 저장소를 Fork한 경우 GitHub Actions 워크플로가 기본적으로 바로 실행되지 않을 수 있습니다. 이 앱은 자동 테스트를 위해 GitHub Actions를 사용하므로 한 번 켜 둡니다.

1. **내 Fork 저장소**로 이동합니다.
2. 위쪽 **Actions** 탭을 누릅니다.
3. 경고 화면과 함께 **I understand my workflows, go ahead and enable them** 버튼이 보이면 누릅니다.
4. 왼쪽에 `CI`, `Public App Smoke` 같은 워크플로 이름이 보이면 준비된 것입니다.

이 버튼이 보이지 않고 Actions 목록이 바로 보이면 이미 활성화된 상태입니다.

GitHub 공식 안내:
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflows-in-forked-repositories

---

# 3. 컴퓨터에 필요한 프로그램 설치

완전 초보자는 Git 명령어 대신 **GitHub Desktop**을 사용하는 것을 권장합니다.

## 3-1. GitHub Desktop 설치

다운로드:
https://desktop.github.com/

1. GitHub Desktop을 설치합니다.
2. 실행합니다.
3. **Sign in to GitHub.com**을 눌러 방금 만든 GitHub 계정으로 로그인합니다.

## 3-2. Node.js 22 설치

이 프로그램은 Node.js 22.x를 사용합니다.

다운로드:
https://nodejs.org/en/download

설치 후 Windows라면 PowerShell, Mac이라면 Terminal을 열고 아래를 입력합니다.

```bash
node -v
npm -v
```

`node -v` 결과가 `v22...` 형태면 됩니다.

---

# 4. 내 Fork를 컴퓨터로 내려받기

GitHub Desktop에서:

1. **File → Clone repository**를 누릅니다.
2. **GitHub.com** 탭에서 내 Fork를 찾습니다.
3. `내아이디/prayer-one-month-challenge`를 선택합니다.
4. **Local path**는 기억하기 쉬운 폴더를 선택합니다.
5. **Clone**을 누릅니다.

완료되면 GitHub Desktop에서 **Show in Explorer** 또는 **Show in Finder**로 실제 폴더를 열 수 있습니다.

## 터미널 열기

GitHub Desktop에서 저장소가 선택된 상태에서:

- Windows: **Repository → Open in Command Prompt** 또는 터미널 열기 메뉴
- Mac: **Repository → Open in Terminal**

메뉴 이름은 운영체제에 따라 조금 다를 수 있습니다.

터미널에서 다음을 실행합니다.

```bash
npm ci
```

오류 없이 끝나면 프로그램 실행에 필요한 패키지가 설치된 것입니다.

---

# 5. Supabase 가입하기

Supabase:
https://supabase.com/

Dashboard:
https://supabase.com/dashboard

Supabase 공식 새 프로젝트 안내:
https://supabase.com/docs/guides/getting-started

## 가입 순서

1. Supabase 사이트에서 **Start your project**, **Sign in** 또는 비슷한 버튼을 누릅니다.
2. 로그인 화면이 나오면 사용할 계정으로 가입합니다.
3. GitHub 계정으로 로그인하는 선택지가 보이면 방금 만든 GitHub 계정을 사용하면 관리가 편합니다.
4. 처음 가입하면 **Organization**을 만들라는 화면이 나올 수 있습니다.
5. Organization 이름은 공동체나 교회 이름으로 정해도 됩니다.
6. 요금제 선택이 나오면 화면의 현재 가격과 한도를 확인합니다.
   - 테스트 단계에서는 무료 플랜이 제공되는 경우 그 플랜으로 시작할 수 있습니다.
   - 요금과 용량 한도는 Supabase 정책에 따라 바뀔 수 있습니다.

---

# 6. Supabase 새 프로젝트 만들기

Supabase Dashboard에서:

1. **New project**를 누릅니다.
2. Organization을 선택합니다.
3. **Project name**에 알아보기 쉬운 이름을 입력합니다.
   - 예: `my-church-community`
4. **Database Password**를 만듭니다.
5. 이 비밀번호는 따로 안전하게 보관합니다.
   - GitHub에 쓰지 않습니다.
   - 카카오톡/문자로 공유하지 않는 것을 권장합니다.
6. Region은 가능하면 **Seoul / Northeast Asia / 한국과 가까운 지역**을 선택합니다.
7. **Create new project**를 누릅니다.
8. 데이터베이스 준비가 끝날 때까지 기다립니다.

## 정상 확인

프로젝트 Dashboard가 열리고 왼쪽에 **SQL Editor**, **Table Editor** 등의 메뉴가 보이면 생성된 것입니다.

---

# 7. DATABASE_URL 가져오기

앱 서버가 Supabase 데이터베이스에 연결하기 위한 주소입니다.

Supabase 프로젝트 Dashboard에서:

1. 화면 위쪽의 **Connect** 버튼을 찾습니다.
2. 연결 방식 중 **Transaction pooler** 또는 serverless에 적합한 pooler 연결을 선택합니다.
3. PostgreSQL 연결 문자열을 복사합니다.
4. 필요하면 프로젝트 생성 때 만든 DB 비밀번호를 입력하여 완성합니다.

형태는 대략 다음과 비슷합니다.

```text
postgresql://사용자:비밀번호@호스트:포트/postgres
```

이 전체 문자열이 `DATABASE_URL`입니다.

**주의:** 이 값은 비밀정보입니다. GitHub README, Issue, 코드에 붙여넣지 마세요.

DB 비밀번호에 `&`, `#`, `?`, 공백 같은 특수문자가 있으면 URL 인코딩 문제를 피하기 위해 Supabase Dashboard가 제공하는 연결 문자열을 그대로 사용하는 것이 안전합니다.

Supabase 공식 연결 안내:
https://supabase.com/docs/guides/database/connecting-to-postgres

---

# 8. 새 데이터베이스가 비어 있는지 확인

Supabase 왼쪽 메뉴에서 **SQL Editor**를 누릅니다.

1. **New query**를 누릅니다.
2. 아래 SQL을 붙여넣습니다.

```sql
select to_regnamespace('prayer_app') as existing_schema;
```

3. **Run**을 누릅니다.

결과가 `null`이면 새 설치용 DB가 맞습니다.

`prayer_app`이 나온다면 이미 이 프로그램용 테이블이 존재하는 DB입니다. **그 상태에서는 다음 단계로 진행하지 말고 DB가 새 프로젝트가 맞는지 확인합니다.**

---

# 9. 프로그램용 DB 테이블 만들기

이 단계에서 저장소의 `drizzle` 폴더 안 SQL 파일을 순서대로 합쳐 새 Supabase DB에 적용합니다.

## Windows PowerShell

프로젝트 폴더에서 PowerShell을 열고:

```powershell
Get-ChildItem .\drizzle\*.sql |
  Sort-Object Name |
  Get-Content |
  Set-Content .\fresh-install.sql -Encoding utf8
```

## Mac Terminal

프로젝트 폴더에서:

```bash
cat $(find drizzle -maxdepth 1 -type f -name '*.sql' | sort) > fresh-install.sql
```

그러면 프로젝트 폴더에 `fresh-install.sql` 파일이 생깁니다.

이 파일은 `.gitignore`에 등록되어 있으므로 정상적인 상태라면 GitHub에 올라가지 않습니다.

## Supabase에 적용

1. `fresh-install.sql`을 메모장이나 텍스트 편집기로 엽니다.
2. 내용을 전부 복사합니다.
3. Supabase → **SQL Editor → New query**
4. 전체 내용을 붙여넣습니다.
5. **Run**을 누릅니다.
6. 빨간 오류가 없는지 확인합니다.

오류가 나면 같은 SQL을 반복 실행하지 말고 먼저 오류 원인을 확인합니다.

## 보안 확인

SQL Editor에서 다음을 실행합니다.

```sql
select count(*) as app_tables
from pg_tables
where schemaname = 'prayer_app';

select
  has_schema_privilege('anon', 'prayer_app', 'usage') as anon_schema_usage,
  has_schema_privilege('authenticated', 'prayer_app', 'usage') as authenticated_schema_usage;
```

아래 두 값은 `false`여야 합니다.

- `anon_schema_usage`
- `authenticated_schema_usage`

이 프로그램은 브라우저가 DB를 직접 읽는 구조가 아니라 Vercel 서버가 private `prayer_app` 스키마를 사용하는 구조입니다.

---

# 10. 새 비밀키 만들기

**다른 56사랑 설치본의 비밀키를 복사하면 안 됩니다.** 새 설치마다 새 값이 필요합니다.

터미널에서 아래 명령을 실행합니다.

## SESSION_SECRET 만들기

```bash
node -e "const c=require('crypto'); console.log(c.randomBytes(48).toString('base64url'))"
```

출력된 값을 안전한 곳에 임시 저장합니다.

## PHONE_LOOKUP_PEPPER 만들기

같은 명령을 **한 번 더** 실행합니다.

```bash
node -e "const c=require('crypto'); console.log(c.randomBytes(48).toString('base64url'))"
```

첫 번째와 두 번째 값은 서로 달라야 합니다.

## ROSTER_ENCRYPTION_KEY 만들기

```bash
node -e "const c=require('crypto'); console.log(c.randomBytes(32).toString('base64'))"
```

이 값도 별도로 저장합니다.

정리:

```text
DATABASE_URL=Supabase에서 복사한 값
SESSION_SECRET=첫 번째 새 비밀값
PHONE_LOOKUP_PEPPER=두 번째 새 비밀값
ROSTER_ENCRYPTION_KEY=32바이트 Base64 새 키
```

비밀값은 GitHub 코드, README, Issue, 공개 문서에 넣지 않습니다.

---

# 11. 로컬용 .env.local 만들기

프로젝트 최상위 폴더에서 `.env.example`을 복사해서 `.env.local`이라는 파일을 만듭니다.

내용:

```text
DATABASE_URL=<새 Supabase Transaction pooler URL>
SESSION_SECRET=<새 값>
PHONE_LOOKUP_PEPPER=<새 값>
ROSTER_ENCRYPTION_KEY=<새 값>
```

`.env.local`은 GitHub에 올라가지 않도록 이미 제외되어 있습니다.

**Windows 주의:** 메모장에서 저장할 때 파일이 `.env.local.txt`가 되면 안 됩니다. 파일 탐색기에서 **파일 확장명 표시**를 켠 뒤 정확히 `.env.local`인지 확인하세요.

---

# 12. 첫 관리자 계정 만들기

이 앱은 처음부터 공개 회원가입을 받지 않습니다. 따라서 첫 관리자 계정을 한 번 만들어야 합니다.

**주의:** `npm run admin:bootstrap`은 `.env.local`을 자동으로 읽지 않기 때문에 아래처럼 터미널 환경변수로 직접 전달합니다.

## Windows PowerShell

```powershell
$env:DATABASE_URL='<새 Supabase Transaction pooler URL>'
$env:SESSION_SECRET='<새 SESSION_SECRET>'
$env:PHONE_LOOKUP_PEPPER='<새 PHONE_LOOKUP_PEPPER>'
$env:ROSTER_ENCRYPTION_KEY='<새 ROSTER_ENCRYPTION_KEY>'
$env:BOOTSTRAP_ADMIN_NAME='관리자이름'
$env:BOOTSTRAP_ADMIN_PHONE='01012345678'
$env:BOOTSTRAP_SAM_NAME='관리자소속샘'
$env:BOOTSTRAP_SAM_LEADER='샘리더이름'

npm run admin:bootstrap
```

## Mac Terminal

```bash
export DATABASE_URL='<새 Supabase Transaction pooler URL>'
export SESSION_SECRET='<새 SESSION_SECRET>'
export PHONE_LOOKUP_PEPPER='<새 PHONE_LOOKUP_PEPPER>'
export ROSTER_ENCRYPTION_KEY='<새 ROSTER_ENCRYPTION_KEY>'
export BOOTSTRAP_ADMIN_NAME='관리자이름'
export BOOTSTRAP_ADMIN_PHONE='01012345678'
export BOOTSTRAP_SAM_NAME='관리자소속샘'
export BOOTSTRAP_SAM_LEADER='샘리더이름'

npm run admin:bootstrap
```

다음 문구가 나오면 성공입니다.

```text
Bootstrap administrator created.
```

첫 로그인:

- 아이디: 관리자 이름
- 초기 비밀번호: 관리자 전화번호

성공 후 bootstrap 전용 값은 터미널을 닫아 제거합니다.

**다음 네 값은 Vercel 환경변수로 넣지 않습니다.**

```text
BOOTSTRAP_ADMIN_NAME
BOOTSTRAP_ADMIN_PHONE
BOOTSTRAP_SAM_NAME
BOOTSTRAP_SAM_LEADER
```

---

# 13. 컴퓨터에서 먼저 실행해 보기

프로젝트 폴더의 터미널에서:

```bash
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:3000
```

첫 관리자 이름과 전화번호로 로그인해 봅니다.

확인할 것:

- 로그인 성공
- 관리자 메뉴 진입
- 사용자 관리 화면 열림
- 기도운동 관리 화면 열림
- 심방 신청 관리 화면 열림
- 커뮤니티 관리 화면 열림
- 목양지 관리 화면 열림
- 공지 관리 화면 열림

종료하려면 터미널에서 `Ctrl + C`를 누릅니다.

---

# 14. Vercel 가입하기

Vercel 가입:
https://vercel.com/signup

Vercel 공식 Git 배포 안내:
https://vercel.com/docs/git

## 가장 쉬운 가입 방법

1. Vercel 가입 페이지를 엽니다.
2. **Continue with GitHub**를 선택하는 것을 권장합니다.
3. GitHub 로그인/승인 화면이 나오면 허용합니다.
4. Vercel Dashboard가 열리면 가입 완료입니다.

Vercel이 GitHub 저장소 접근 권한을 요청할 수 있습니다.

가능하면 **내 Fork 저장소만 접근 허용**해도 됩니다.

---

# 15. Vercel에 내 Fork 연결하기

Vercel Dashboard에서:

1. **Add New…**를 누릅니다.
2. **Project**를 선택합니다.
3. GitHub 저장소 목록에서 내 Fork를 찾습니다.
4. 오른쪽의 **Import**를 누릅니다.

내 저장소가 보이지 않으면:

1. Vercel의 GitHub 연결 설정에서 **Configure GitHub App** 또는 저장소 권한 관리 메뉴를 엽니다.
2. 내 Fork 저장소에 Vercel 접근 권한을 허용합니다.
3. Vercel의 New Project 화면으로 돌아옵니다.

Vercel 공식 문서상 개인 GitHub 저장소를 새 Vercel 프로젝트로 연결하려면 해당 저장소의 소유자 권한이 필요합니다. Fork를 자기 계정에 만들었다면 보통 이 조건을 만족합니다.

---

# 16. Vercel 환경변수 등록하기

Import 후 배포 설정 화면에서 **Environment Variables** 영역을 찾습니다.

아래 네 개를 각각 추가합니다.

```text
DATABASE_URL
SESSION_SECRET
PHONE_LOOKUP_PEPPER
ROSTER_ENCRYPTION_KEY
```

각 이름에 앞에서 만든 값을 넣습니다.

예:

- Name: `DATABASE_URL`
- Value: Supabase Transaction pooler URL

그다음 나머지 세 개도 같은 방식으로 추가합니다.

## 중요한 보안 규칙

- 이 비밀값들은 GitHub Actions의 일반 Variables에 넣지 않습니다.
- README에 넣지 않습니다.
- `NEXT_PUBLIC_`으로 시작하는 이름을 사용하지 않습니다.
- Vercel의 **Environment Variables**에만 넣습니다.

Framework가 자동으로 **Next.js**로 인식되면 그대로 둡니다.

Root Directory도 저장소 최상위 폴더라면 바꾸지 않습니다.

---

# 17. 첫 Vercel 배포

환경변수 네 개를 모두 넣은 뒤:

1. **Deploy**를 누릅니다.
2. 빌드가 진행됩니다.
3. **Ready** 또는 성공 화면이 나오면 배포된 것입니다.
4. Vercel이 만들어 준 `*.vercel.app` 주소를 엽니다.

예:

```text
https://내프로젝트.vercel.app
```

이 주소가 현재 내 서비스 주소입니다.

Vercel은 GitHub의 production branch(보통 `main`)가 바뀌면 Production 배포를 자동으로 만들 수 있습니다.

---

# 18. 배포된 사이트 확인

브라우저에서 다음을 확인합니다.

## 로그인 화면

```text
https://내주소.vercel.app/login
```

## DB 상태

```text
https://내주소.vercel.app/api/health
```

정상이라면 JSON 안에 다음과 비슷한 내용이 나옵니다.

```text
status: ok
database: ok
```

그다음 첫 관리자 계정으로 로그인합니다.

---

# 19. GitHub 자동 공개검사 주소 등록

이 단계는 권장사항입니다. 설정하면 GitHub가 배포 주소의 기본 상태를 자동 검사합니다.

내 Fork의 GitHub 페이지에서:

1. **Settings**를 누릅니다.
2. 왼쪽 메뉴에서 **Secrets and variables**를 엽니다.
3. **Actions**를 누릅니다.
4. 위쪽에서 **Variables** 탭을 선택합니다.
5. **New repository variable**을 누릅니다.
6. 이름에 다음을 입력합니다.

```text
PUBLIC_APP_URL
```

7. Value에는 내 Vercel 주소를 입력합니다.

예:

```text
https://내프로젝트.vercel.app
```

8. 저장합니다.
9. Fork 저장소의 **Actions** 탭으로 이동합니다.
10. 왼쪽에서 **Public App Smoke**를 선택합니다.
11. **Run workflow → Run workflow**를 눌러 새 주소를 즉시 검사할 수 있습니다.

브랜드 이름을 바꾼 경우 다음 변수도 선택적으로 추가할 수 있습니다.

```text
PUBLIC_APP_NAME
PUBLIC_APP_HEADING
PUBLIC_RELEASE_MARKER
```

**PUBLIC_APP_URL에는 비밀정보가 없습니다.** 반대로 DB 비밀번호나 암호화 키는 이 Variables 화면에 넣지 않습니다.

---

# 20. 실제 성도 명단 넣기

이제 배포된 앱에서 첫 관리자 계정으로 로그인합니다.

관리자 → **사용자 관리**로 이동합니다.

1. 성도 명단 XLS/XLSX를 준비합니다.
2. 화면의 **엑셀 예제 다운로드**가 있으면 먼저 예제 형식을 확인합니다.
3. 실제 명단을 가져옵니다.
4. 첫 관리자 이름/전화번호도 명단에 포함시키는 것을 권장합니다.
5. 샘 리더 명단은 별도 메뉴/가져오기 기능으로 등록합니다.

## 20-1. 샘리더와 마을장 연결 확인

성도 명단을 가져온 뒤에는 **관리자 → 사용자 관리 → 샘 리더 관리**에서 실제 사람과 리더 역할이 정확히 연결되었는지 확인합니다.

### 샘리더

1. 샘과 리더 이름을 등록합니다.
2. 성도 명단에서 같은 이름이 한 명이고 그 사람이 해당 샘 소속이면 자동 연결됩니다.
3. 같은 이름이 여러 명이면 **동명이인 확인**이 표시됩니다.
4. 이때 이름·마을·샘·전화번호 뒤 4자리를 보고 정확한 사람 한 명을 선택합니다.
5. 샘리더는 **그 샘에 소속된 성도만** 지정할 수 있습니다.

### 마을장

같은 화면의 **마을장 등록**에서 다음처럼 입력합니다.

```text
마을장: 3마을장
이름: 홍길동
```

- 이름이 한 명이면 자동 연결됩니다.
- 동명이인이면 이름·마을·샘·전화번호 뒤 4자리를 보고 정확한 사람을 선택합니다.
- **마을장은 본인의 실제 소속 마을이나 샘과 관계없이 다른 마을을 담당할 수 있습니다.**
- 예를 들어 본인은 4마을 4-1샘 소속이어도 `3마을장`으로 지정할 수 있습니다.
- 마을장 권한은 본인의 소속 마을이 아니라 **등록한 담당 마을**에 적용됩니다.
- 따라서 3마을장으로 지정된 사람은 3마을의 샘에 목양지를 제출할 수 있지만, 본인이 4마을 소속이라는 이유만으로 4마을 전체 권한이 생기지는 않습니다.

샘리더와 마을장은 한 번 정확한 성도와 연결되면 내부적으로 성도 명단의 고유 ID를 사용합니다. 나중에 같은 이름의 성도가 추가되어도 기존 권한이 다른 사람에게 넘어가지 않습니다.

화면에 다음 상태가 보이면 저장 전에 확인합니다.

- **동명이인 확인 필요**: 같은 이름의 후보가 여러 명이므로 관리자가 한 명을 선택해야 함
- **명단 확인 필요**: 입력한 이름과 성도 명단이 맞지 않아 아직 권한이 연결되지 않음
- **기존 연결 확인 필요**: 예전에 연결된 성도가 삭제·비활성화되는 등 다시 확인이 필요한 상태

회원에게는 이름과 등록된 전화번호를 초기 로그인 정보로 안내합니다.

---

# 21. 기도운동·심방·목양지 기본 설정

관리자 화면에서:

## 기도운동 관리

- 제목
- 시작일
- 종료일
- 활성화 상태

를 설정합니다.

## 심방 신청 관리

- 신청 가능 기간
- 특정 날짜 예외
- 반복 요일 차단

을 필요에 맞게 설정합니다.

## 목양지 관리

관리자 → **목양지 관리**에서 제출을 요청할 달을 설정합니다.

1. 올해 또는 내년을 선택합니다.
2. 가로로 나열된 **1~12월** 중 제출을 받을 달을 누릅니다.
3. 잘못 선택했으면 같은 달을 다시 눌러 취소합니다.
4. **제출 요청 저장**을 누릅니다.

주별 요청이나 별도 시작일·마감일은 없습니다. 예를 들어 10월을 선택했다면 서울 시간 기준 **10월 1일부터 10월 31일까지** 제출할 수 있습니다.

회원 화면의 **목양지** 탭은 관리자·샘리더·마을장에게만 보입니다.

- 샘리더: 본인이 맡은 샘에 제출
- 마을장: 본인 소속과 관계없이 **담당 마을의 샘**에 제출
- 관리자: 전체 제출 현황을 관리

제출 방법은 세 가지 중 **하나만 사용해도 완료**입니다.

1. 사진으로 제출
2. 파일로 제출
3. 화면의 칸에 직접 입력

사진/파일은 최대 2개, 파일당 6MiB입니다. 직접 입력 양식은 **샘모임 → 나눔/기도제목 → 샘소식 → 샘리더 기도제목 → 기타** 순서이며, 상담/심방 요청 항목은 없습니다. 일반 입력칸은 비워도 제출할 수 있지만 **이번 기간 샘모임 없음**을 선택했다면 이유를 적어야 합니다.

해당 달에 그 샘의 완료된 목양지가 한 건 이상 있으면 샘리더에게 보이던 미제출 `!`가 사라집니다.

제출 후에는 **내가 제출한 목양지**에서 본인 제출본을 열어 수정·삭제할 수 있습니다. 관리자는 **관리자 → 목양지 관리**에서 전체 완료본을 열어 수정·삭제할 수 있습니다. 마을장은 담당 마을에 제출할 수 있지만 다른 사람이 제출한 목양지 본문을 읽는 권한은 없습니다.

Google Calendar를 아직 연결하지 않았다면 다음 단계에서 연결합니다.

---

# 22. Google 계정이 없다면 만들기 — Calendar 사용 시만

Google Calendar 연동을 사용하지 않을 경우 **22~27단계는 건너뛰어도 됩니다.**

Google 계정 만들기 공식 안내:
https://support.google.com/accounts/answer/27441?hl=ko

Google 계정 생성 페이지:
https://accounts.google.com/signup

1. **계정 만들기**를 선택합니다.
2. 개인용 또는 운영 목적에 맞는 계정을 선택합니다.
3. 이름, 이메일/사용자 이름, 비밀번호를 설정합니다.
4. 화면의 인증 절차를 완료합니다.
5. 복구 이메일/전화번호도 설정하는 것을 권장합니다.

이미 Gmail, YouTube, Google Calendar를 사용하는 계정이 있다면 새 Google 계정을 만들 필요가 없습니다.

운영 Calendar 소유 계정을 사용하는 것이 관리하기 편합니다.

---

# 23. Google Cloud 프로젝트 만들기

Google Cloud Console:
https://console.cloud.google.com/

1. Google 계정으로 로그인합니다.
2. 화면 위쪽의 **프로젝트 선택** 영역을 누릅니다.
3. **New Project / 새 프로젝트**를 누릅니다.
4. Project name을 입력합니다.
   - 예: `my-church-56-community`
5. **Create**를 누릅니다.
6. 생성된 프로젝트를 선택합니다.

---

# 24. Google Calendar API 켜기

Google Calendar API 공식 안내:
https://developers.google.com/workspace/calendar/api/quickstart/nodejs

Google Cloud Console에서:

1. 왼쪽 메뉴 또는 검색에서 **APIs & Services**를 찾습니다.
2. **Library** 또는 API 라이브러리를 엽니다.
3. `Google Calendar API`를 검색합니다.
4. Google Calendar API를 선택합니다.
5. **Enable**을 누릅니다.

> Google Cloud는 별도 아이디를 새로 만드는 서비스가 아니라 앞 단계의 Google 계정으로 로그인해 사용하는 관리 콘솔입니다. 화면에서 결제 계정 연결을 요구하는 경우에는 Google이 표시하는 현재 안내를 따르세요.

---

# 25. Google OAuth 동의화면 설정

현재 Google Cloud에서는 **Google Auth platform** 메뉴에서 OAuth 설정을 관리합니다.

1. Google Cloud Console에서 **Google Auth platform**을 엽니다.
2. 처음이라면 **Get Started**를 누릅니다.
3. **Branding**에서 앱 이름과 지원 이메일을 입력합니다.
4. **Audience**를 설정합니다.
   - 개인 Google 계정 중심이면 보통 External 방식입니다.
   - Google Workspace 조직 전용이고 Internal 선택이 가능한 경우 조직 정책에 맞게 선택합니다.
5. 테스트 단계라면 실제 연동할 관리자 Google 계정을 **Test users**에 추가합니다.
6. **Data Access**에서 **Add or remove scopes**를 눌러 이 앱이 실제로 사용하는 아래 두 Calendar 권한을 추가합니다.

```text
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.calendarlist.readonly
```

- `calendar.events`: 일정 조회/생성/수정/삭제
- `calendar.calendarlist.readonly`: 연결한 계정의 Calendar 목록 읽기

필요 이상으로 넓은 `https://www.googleapis.com/auth/calendar` 전체 권한을 임의로 추가하지 않습니다.

## Testing 상태를 그대로 운영하지 않기

개인 Gmail 계정 등 **External** Audience에서 OAuth 앱의 Publishing status가 **Testing**이면, Calendar 같은 사용자 데이터 권한을 사용하는 refresh token은 일반적으로 **7일 후 만료**됩니다. 테스트 단계에서는 괜찮지만 실제 운영에서는 일주일마다 다시 연결해야 하는 문제가 생길 수 있습니다.

장기 운영 전에는 Google Auth platform의 **Audience / Publishing status**를 확인하고 필요한 경우 **In production**으로 전환합니다. Calendar 권한은 민감한 사용자 데이터 범위로 분류될 수 있어 Google의 앱 검증이 요구될 수 있습니다. 화면에 Verification 안내가 나오면 Google의 현재 검증 절차를 완료하세요.

Google Workspace 조직 내부에서만 쓰고 **Internal** Audience를 사용할 수 있는 경우에는 조직 정책에 따라 절차가 다를 수 있습니다.

Google 공식 OAuth 정책:
https://developers.google.com/identity/protocols/oauth2

Google Calendar 권한 안내:
https://developers.google.com/workspace/calendar/api/auth

---

# 26. Google OAuth Client 만들기

Google 공식 OAuth Client 안내:
https://developers.google.com/workspace/guides/create-credentials

Google Cloud Console에서:

1. **Google Auth platform → Clients**로 이동합니다.
2. **Create Client**를 누릅니다.
3. Application type은 **Web application**을 선택합니다.
4. 이름을 입력합니다.
   - 예: `56사랑 Production`
5. **Authorized redirect URIs**에 아래 주소를 추가합니다.

```text
https://내프로덕션주소.vercel.app/api/admin/google-calendar/callback
```

커스텀 도메인을 쓴다면 그 도메인 callback도 등록합니다.

Preview 주소에서도 연동 시험을 할 경우 Preview callback을 추가할 수 있습니다.

6. **Create**를 누릅니다.
7. 만들어진 **Client ID**와 **Client Secret**을 안전하게 보관합니다.

---

# 27. Google용 암호화 키 만들고 Vercel에 등록

터미널에서:

```bash
node -e "const c=require('crypto'); console.log(c.randomBytes(32).toString('base64'))"
```

새 값을 하나 만듭니다.

이 값은:

```text
GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY
```

입니다.

Vercel → 내 프로젝트 → **Settings → Environment Variables**에서 아래 세 개를 추가합니다.

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY
```

저장한 뒤 새 Production 배포를 실행합니다.

그리고 앱에서:

1. 관리자 로그인
2. **관리자 → 심방 신청 관리**
3. 화면을 맨 아래까지 내려 **Google Calendar** 영역을 찾습니다.
4. **Google Calendar 연결**을 누릅니다.
5. Google 계정에서 권한을 승인합니다.
6. 실제 사용할 Calendar를 선택합니다.
7. 저장합니다.

> 별도의 **설정** 메뉴는 없습니다. Google Calendar 관리는 **심방 신청 관리 화면의 가장 아래**에 있습니다.

세 Google 환경변수 중 하나라도 Production에 없거나 형식이 잘못되면 연결 버튼이 보이지 않을 수 있습니다. 반드시 **Vercel Production 환경**에 세 값을 모두 등록한 뒤 재배포하세요.

한 번 Calendar 연결을 사용하기 시작한 뒤에는 `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`를 임의로 바꾸지 않습니다. 기존 refresh token을 읽을 수 없게 될 수 있습니다.

---

# 28. 자기 공동체 이름과 아이콘으로 바꾸기

기본 설치 상태에서는 이름이 `56사랑`, 제목이 `56공동체`로 되어 있습니다.

바꾸고 싶다면 아래 문자열을 저장소에서 찾습니다.

```bash
git grep -nE '56사랑|56공동체|엡 4:3|56-heart'
```

주요 파일:

- `app/layout.tsx`: 브라우저 제목, PWA 이름, iPhone 이름
- `app/manifest.ts`: 설치 이름과 아이콘
- `components/app/MemberShell.tsx`: 사이드바와 상단 제목
- `app/login/page.tsx`: 로그인 화면
- `public/icons/`: 홈 화면 아이콘

초보자가 직접 코드 수정이 어렵다면 이 단계는 개발 가능한 사람에게 부탁하고, **이름/성구/아이콘만 변경해 달라고 요청**하면 됩니다.

브랜딩 변경 후에는:

```bash
npm test
npm run lint
npm run build
```

를 실행해 오류가 없는지 확인합니다.

---

# 29. GitHub에 수정사항 올리는 가장 쉬운 방법

GitHub Desktop을 사용하는 경우:

1. 변경한 파일을 저장합니다.
2. GitHub Desktop을 엽니다.
3. 왼쪽에 변경 파일 목록이 나타나는지 확인합니다.
4. 아래 **Summary**에 변경 설명을 입력합니다.
   - 예: `우리 공동체 이름으로 변경`
5. **Commit to main** 또는 현재 브랜치에 Commit합니다.
6. 위쪽 **Push origin**을 누릅니다.

Vercel이 GitHub와 연결되어 있으면 `main`에 올라간 변경사항은 새 배포를 자동으로 만들 수 있습니다.

---

# 30. 설치 후 운영자가 반드시 할 설정

정식 서비스 시작 전에 관리자 화면에서 확인합니다.

- 실제 성도 명단 가져오기
- 샘리더 등록 및 동명이인/명단 확인 상태 정리
- 필요한 경우 마을장 등록 및 담당 마을 지정
- 기도운동 기간 및 활성 상태 설정
- 심방 신청 기간/가능일 설정
- 목양지 제출 요청 월 설정
- 샘리더·마을장 계정에서 목양지 탭과 제출 대상 확인
- Google Calendar 사용 시 **심방 신청 관리 맨 아래**에서 계정 연결 및 Calendar 선택
- 공지 작성 테스트
- 커뮤니티 폴더 확인
- 실제 휴대폰에서 로그인과 PWA 설치 확인

---

# 31. 절대 복사하면 안 되는 것

다른 공동체에 새로 설치할 때 **원본 56공동체에서 아래 항목을 가져가면 안 됩니다.**

- 기존 Supabase 프로젝트
- 기존 `DATABASE_URL`
- 기존 DB 비밀번호
- 기존 회원 명단과 전화번호
- 기존 기도요청/심방 사유/게시판 데이터
- 기존 `SESSION_SECRET`
- 기존 `PHONE_LOOKUP_PEPPER`
- 기존 `ROSTER_ENCRYPTION_KEY`
- 기존 Google OAuth Client Secret
- 기존 `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`
- 기존 VAPID Private Key
- 기존 Vercel 프로젝트의 비밀 환경변수

**코드만 Fork하고 데이터와 비밀값은 새로 만든다**고 기억하면 됩니다.

---

# 32. 자주 막히는 문제

## GitHub에서 Fork 버튼이 안 보임

- GitHub 로그인이 되어 있는지 확인합니다.
- 원본 주소가 맞는지 확인합니다.
- 다시 원본 저장소 첫 화면으로 이동합니다.

## Vercel에서 내 저장소가 안 보임

- Vercel이 GitHub 계정과 연결되어 있는지 확인합니다.
- Vercel GitHub App이 내 Fork 저장소에 접근할 수 있는지 확인합니다.
- 개인 저장소라면 내가 Owner인지 확인합니다.

## Vercel 배포에서 환경변수 오류

필수 네 개가 모두 있는지 확인합니다.

```text
DATABASE_URL
SESSION_SECRET
PHONE_LOOKUP_PEPPER
ROSTER_ENCRYPTION_KEY
```

빈 문자열로 등록하지 않습니다.

## DATABASE_URL 오류

- Supabase의 Connect 화면에서 **Transaction pooler** URL을 다시 복사합니다.
- DB 비밀번호가 맞는지 확인합니다.
- 비밀번호에 특수문자가 있으면 URL 인코딩 문제를 확인합니다.

## 첫 관리자 생성 실패

- 새 DB 마이그레이션이 적용됐는지 확인합니다.
- 터미널에 필수 환경변수를 실제로 입력했는지 확인합니다.
- 이미 관리자가 존재하면 bootstrap 명령은 다시 만들지 않습니다.

## 로그인은 되는데 Google Calendar가 안 됨

Google Calendar 설정은 **관리자 → 심방 신청 관리 → 화면 맨 아래**에 있습니다. 별도의 설정 메뉴는 없습니다.

연결 버튼 자체가 보이지 않으면 먼저 Vercel의 **Production** 환경에 아래 세 값이 모두 있는지 확인합니다.

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY
```

그다음 아래를 확인합니다.

- Google Calendar API가 Enable 상태인지 확인합니다.
- OAuth Client가 Web application인지 확인합니다.
- callback URI가 현재 Production 주소와 정확히 같은지 확인합니다.
- 환경변수 추가·수정 뒤 Production을 다시 배포했는지 확인합니다.
- 기존 설치를 옮기는 경우 token encryption key를 새 값으로 바꾸지 않았는지 확인합니다.

---

# 33. 하지 말아야 할 것

- 운영 Supabase에 `scripts/seed-e2e.ts`를 실행하지 않습니다.
- 비밀값을 GitHub Issue나 README에 올리지 않습니다.
- 다른 공동체의 `DATABASE_URL`을 재사용하지 않습니다.
- 암호화 키를 임의로 나중에 바꾸지 않습니다.
- 실제 회원 전화번호를 테스트 자료로 공개 저장소에 넣지 않습니다.

---

# 34. 설치 완료 기준

아래가 모두 되면 독립 설치가 끝난 것입니다.

- 내 GitHub 계정에 Fork가 존재함
- 새 Supabase 프로젝트가 존재함
- `prayer_app` 스키마가 생성됨
- anon/authenticated가 private schema를 직접 사용하지 못함
- 첫 관리자 생성 성공
- 새 Vercel 프로젝트가 Ready
- `/api/health`에서 DB 정상 확인
- 첫 관리자 로그인 성공
- 자기 공동체 성도 명단 등록 가능
- 샘리더·마을장 연결 확인 가능
- 동명이인은 관리자 선택 후 정확한 성도 ID에 연결됨
- 마을장은 본인 소속과 무관하게 담당 마을 지정 가능
- 기도운동 동작
- 기도요청 비공개 동작
- 커뮤니티 글/댓글/좋아요/첨부 동작
- 목양지 월별 요청·제출·본인 수정/삭제·관리자 관리 동작
- 공지 및 공지 이미지 동작
- Google Calendar를 쓰는 경우 **심방 신청 관리 맨 아래**에서 새 OAuth Client로 연결 성공

설치 후에는 [새 인스턴스 출시 체크리스트](new-instance-checklist.md)를 한 번 더 확인하세요.

운영 중 문제가 생기면 [운영 가이드](operations.md)의 장애 대응도 참고합니다.
