# 새 인스턴스 출시 체크리스트 — 초보자용

이 체크리스트는 [새 공동체용 독립 설치 가이드](new-instance-setup.md)를 순서대로 진행한 뒤 사용합니다.

## 계정과 저장소

- [ ] 내 이름/운영 책임자 명의의 GitHub 계정을 만들었다.
- [ ] GitHub 이메일 인증을 완료했다.
- [ ] 원본 저장소 `LionDaniel79/prayer-one-month-challenge`를 내 계정으로 Fork했다.
- [ ] Fork 주소가 `https://github.com/내아이디/...` 형태인지 확인했다.
- [ ] Fork의 Actions 탭에서 GitHub Actions를 활성화했다.
- [ ] GitHub Desktop에 내 GitHub 계정으로 로그인했다.
- [ ] 내 Fork를 컴퓨터에 Clone했다.
- [ ] Node.js 22.x를 설치했고 `node -v`가 동작한다.
- [ ] 프로젝트 폴더에서 `npm ci`가 성공했다.

## 원본과 완전 분리

- [ ] 원본 56공동체 `DATABASE_URL`을 사용하지 않는다.
- [ ] 원본 회원 명단/전화번호/기도요청/심방/게시글 데이터를 복사하지 않았다.
- [ ] `SESSION_SECRET`, `PHONE_LOOKUP_PEPPER`, `ROSTER_ENCRYPTION_KEY`를 새로 만들었다.
- [ ] 실제 회원 데이터나 비밀값을 GitHub 코드/README/Issue에 넣지 않았다.

## Supabase

- [ ] 내 계정으로 Supabase에 가입/로그인했다.
- [ ] 내 Organization을 만들거나 선택했다.
- [ ] 기존 56사랑과 다른 **새 Supabase 프로젝트**를 만들었다.
- [ ] 새 DB 비밀번호를 안전하게 보관했다.
- [ ] 가능하면 한국과 가까운 리전을 선택했다.
- [ ] Connect 화면에서 Transaction pooler `DATABASE_URL`을 가져왔다.
- [ ] SQL Editor에서 `to_regnamespace('prayer_app')` 결과가 처음에는 null임을 확인했다.
- [ ] `fresh-install.sql`을 만들어 새 DB에 적용했다.
- [ ] `prayer_app` schema와 커뮤니티·목양지·리더 연결을 포함한 최신 마이그레이션 테이블이 존재한다.
- [ ] anon/authenticated에 `prayer_app` schema 사용 권한이 없다.
- [ ] Security Advisor에서 새 ERROR/WARN이 없는지 확인했다.
- [ ] 운영 DB에 `scripts/seed-e2e.ts`를 실행하지 않았다.

## 첫 관리자

- [ ] 필수 앱 비밀값 4개를 준비했다.
- [ ] bootstrap 명령 실행 시 터미널 환경변수로 값을 전달했다.
- [ ] `npm run admin:bootstrap`에서 `Bootstrap administrator created.`를 확인했다.
- [ ] bootstrap용 네 환경변수를 Vercel에 등록하지 않았다.
- [ ] 로컬 `http://localhost:3000`에서 첫 관리자 로그인이 된다.

## Vercel 가입과 배포

- [ ] 내 계정으로 Vercel에 가입했다.
- [ ] 가능하면 **Continue with GitHub**로 GitHub 계정을 연결했다.
- [ ] Vercel GitHub App이 내 Fork에 접근하도록 허용했다.
- [ ] Add New → Project에서 내 Fork를 Import했다.
- [ ] Framework가 Next.js로 인식되는지 확인했다.
- [ ] 필수 환경변수 4개를 Production에 등록했다.
- [ ] Preview를 사용할 경우 Preview 환경에도 필요한 값을 등록했다.
- [ ] Production 배포가 Ready/성공 상태다.
- [ ] 배포된 `*.vercel.app` 주소를 저장했다.
- [ ] `/api/health`가 `status: ok`, `database: ok`를 반환한다.
- [ ] 배포된 사이트에서 첫 관리자 로그인이 된다.

## GitHub 자동 공개검사

- [ ] Fork → Settings → Secrets and variables → Actions → Variables로 들어갔다.
- [ ] `PUBLIC_APP_URL`에 **내 Vercel 주소**를 등록했다.
- [ ] Actions → Public App Smoke → Run workflow를 실행해 내 주소를 검사했다.
- [ ] DB URL, 비밀번호, 암호화 키는 GitHub Variables에 넣지 않았다.

## 실제 명단과 기본 운영 설정

- [ ] 실제 성도 XLS/XLSX를 사용자 관리에서 가져왔다.
- [ ] 첫 관리자 이름/전화번호도 명단에 포함했다.
- [ ] 사용자 관리 → 샘 리더 관리에서 샘리더 명단을 등록했다.
- [ ] 이름이 한 명인 샘리더/마을장은 자동 연결되는지 확인했다.
- [ ] 동명이인은 이름·마을·샘·전화번호 뒤 4자리를 보고 정확한 성도를 선택했다.
- [ ] 샘리더는 해당 샘 소속 성도만 지정되도록 확인했다.
- [ ] 필요한 마을장을 등록했고, 마을장은 본인 소속과 관계없이 담당 마을을 지정할 수 있음을 확인했다.
- [ ] 마을장에게는 본인 소속 마을이 아니라 등록한 담당 마을의 목양지 제출 권한만 부여되는지 확인했다.
- [ ] 기도운동 제목/기간/활성 상태를 설정했다.
- [ ] 심방 신청 기간과 가능일을 설정했다.
- [ ] 목양지 관리에서 올해/내년 중 제출 요청 월을 선택해 저장했다.
- [ ] 커뮤니티 기본 폴더를 확인했다.
- [ ] 공지 작성 화면을 확인했다.

## 기능 확인

- [ ] 사용자 로그인/로그아웃이 된다.
- [ ] 기도운동 체크/취소가 된다.
- [ ] 심방 신청 화면이 열린다.
- [ ] 기도요청이 일반 회원끼리 노출되지 않는다.
- [ ] 커뮤니티 폴더/글/댓글/좋아요가 된다.
- [ ] 첨부파일 최대 2개·파일당 6MB 제한이 동작한다.
- [ ] 사진 첨부가 본문보다 먼저 표시된다.
- [ ] 공지와 공지 이미지가 표시된다.
- [ ] 관리자·샘리더·마을장에게만 회원 화면의 **목양지** 탭이 보인다.
- [ ] 목양지는 사진/파일/직접입력 중 한 가지 방법만 제출해도 완료된다.
- [ ] 직접입력 양식이 샘모임 → 나눔/기도제목 → 샘소식 → 샘리더 기도제목 → 기타 순서인지 확인했다.
- [ ] 이번 기간 샘모임 없음을 선택하면 이유를 작성해야 한다.
- [ ] 본인이 제출한 목양지를 열어 수정·삭제할 수 있다.
- [ ] 관리자는 목양지 관리에서 전체 제출본을 수정·삭제할 수 있다.
- [ ] 마을장은 담당 마을에 제출할 수 있지만 다른 사람이 제출한 목양지 본문은 볼 수 없다.
- [ ] 관리자 화면과 회원 화면의 권한 분리가 유지된다.

## Google Calendar를 사용할 때만

- [ ] Google 계정이 준비되어 있다.
- [ ] Google Cloud 프로젝트를 새로 만들었다.
- [ ] Google Calendar API를 Enable했다.
- [ ] Google Auth platform의 Branding/Audience를 설정했다.
- [ ] Data Access에 `calendar.events`와 `calendar.calendarlist.readonly` 두 범위를 등록했다.
- [ ] 필요한 경우 실제 관리자 Google 계정을 Test user로 추가했다.
- [ ] 장기 운영이라면 External OAuth 앱을 Testing 상태로 방치하지 않았고, 필요한 Production/검증 절차를 확인했다.
- [ ] OAuth Client를 **Web application**으로 만들었다.
- [ ] Production callback URI를 정확히 등록했다.
- [ ] 새 `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`를 만들었다.
- [ ] Vercel **Production** 환경에 Google 환경변수 3개를 모두 등록하고 재배포했다.
- [ ] Google Calendar 연결 버튼이 보이지 않으면 Production 환경변수 누락 여부를 먼저 확인했다.
- [ ] 연결 후 `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`를 임의로 바꾸지 않았다.
- [ ] 관리자 → 심방 신청 관리의 **맨 아래 Google Calendar 영역**에서 Google 계정을 연결했다.
- [ ] 운영 Calendar를 선택했다.
- [ ] 심방 일정 생성/수정/취소가 실제 Calendar와 동기화된다.
- [ ] 심방 요청 이유가 Google Calendar 설명에 포함되지 않는다.

## 브랜딩

- [ ] 공동체 이름/PWA 이름을 결정했다.
- [ ] 필요하면 `56사랑`, `56공동체`, 성구, 아이콘을 교체했다.
- [ ] 변경 후 `npm test`, `npm run lint`, `npm run build`가 성공한다.
- [ ] GitHub Desktop으로 변경사항을 Commit/Push했다.
- [ ] Vercel 새 배포가 성공했다.
- [ ] 실제 휴대폰에서 홈 화면 설치 이름과 아이콘을 확인했다.

모든 항목을 확인한 뒤 실제 사용자를 초대합니다.
