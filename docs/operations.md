# 운영 가이드 — 56사랑

이 문서는 `56사랑` 웹앱의 Preview/Production 운영 기준을 정리한다.

## 1. 서비스 구성

### Supabase

- Project: `prayer-one-month-challenge`
- Project ref: `mraqwckqvxkozvzyszhv`
- Region: `ap-northeast-2` (Seoul)
- Application schema: `prayer_app`
- 앱 데이터는 `public`이 아닌 private schema에 둔다.
- `anon` / `authenticated` 역할에는 앱 테이블 권한을 부여하지 않는다.
- 웹앱 서버만 PostgreSQL에 직접 연결한다.

### Vercel

서버 실행 위치는 `vercel.json`의 `icn1`(서울)로 고정한다. Supabase와 가까운 위치에서 실행하여 매 DB 요청의 대륙 간 왕복을 줄인다. 기존 배포에는 소급 적용되지 않으므로 변경 후 새 Preview 배포를 확인한다.

Preview와 Production에 필요한 서버 환경변수:

| 변수 | 용도 | 브라우저 노출 |
| --- | --- | --- |
| `DATABASE_URL` | Supabase Transaction Pooler PostgreSQL URL | 금지 |
| `SESSION_SECRET` | 세션 토큰 HMAC | 금지 |
| `PHONE_LOOKUP_PEPPER` | 전화번호 lookup HMAC | 금지 |
| `ROSTER_ENCRYPTION_KEY` | 관리자용 전화번호 암호화 | 금지 |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Web Push 공개키 | 공개 가능 |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Web Push 서명 비밀키 | 금지 |
| `WEB_PUSH_SUBJECT` | VAPID 연락처 식별자 | 서버 설정 |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth Web client id | 서버 사용 |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret | 금지 |
| `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` | Google refresh token AES-256-GCM 암호화 | 금지 |

비밀값은 `NEXT_PUBLIC_*` 이름으로 만들지 않는다.

환경변수 값을 GitHub, Issue, 문서, 스크린샷, 채팅에 붙여넣지 않는다.

사용하지 않는 선택 변수는 빈 문자열 대신 생략한다. 두 암호화 키는 각각 32바이트를 Base64로 인코딩한 별도 키다. `SESSION_SECRET` / `PHONE_LOOKUP_PEPPER`는 각각 최소 32자다. 이미 사용 중인 키를 임의로 재생성하지 않는다. 현재 환경변수 설치 여부는 값 조회 없이 설정 이름으로 확인한다.

---

## 2. PWA / 브랜드

- 설치 이름: `56사랑`
- 메인 제목: `56공동체`
- 부제: `성령이 하나 되게 하신 것을 힘써 지키라(엡 4:3)`
- 사용자 메뉴 순서:
  1. 기도운동
  2. 심방신청
  3. 기도요청
  4. 공지
- 한 번에 선택한 메뉴의 화면 하나만 메인 영역에 표시한다.
- 모바일에서는 왼쪽 메뉴가 드로어로 열린다.

설치 아이콘:

- `/icons/56-love-192.png`
- `/icons/56-love-512.png`
- `/icons/56-love-maskable-512.png`

---

## 3. 로그인 허용 명단 / 비밀번호

### 3.1 명단 가져오기

관리자 → **사용자 관리**에서 `56공동체.xls`를 가져온다.

- 원본 XLS는 GitHub/Vercel에 저장하지 않는다.
- 이름 끝 영문 접미사는 로그인 비교에서 제거한다.
- 실제 로그인 성공 전까지 roster에만 존재하며 기도운동 참여자로 집계하지 않는다.
- 전화번호가 없는 roster 행은 가져오되 로그인은 불가능하다.

### 3.2 로그인

- 아이디: 이름
- 초기 비밀번호: 등록된 전화번호
- 사용자가 내 정보에서 별도 비밀번호로 변경 가능
- 별도 비밀번호는 Argon2id 해시로만 저장하며 원문 복구 불가
- 관리자는 현재 비밀번호 원문을 볼 수 없다.
- 관리자는 새 비밀번호 설정 또는 전화번호 초기값으로 재설정할 수 있다.

세션:

- HttpOnly
- Production에서 Secure
- SameSite=Lax
- 180일 rolling session

사용자 로그인 자격정보 변경/비활성화/관리자 비밀번호 재설정 시 필요한 세션을 폐기한다.

---

## 4. 기도운동 운영

관리자 → **기도운동 관리**:

- 도전 제목
- 시작일 / 종료일
- 활성화
- 참여자/샘별 통계

회원:

- 월~토가 기도 대상일
- 일요일 제외
- 오늘과 어제만 체크/취소 가능
- 모든 날짜 판정은 `Asia/Seoul`
- 체크 UI는 즉시 반영 후 서버 저장, 실패 시 해당 날짜만 되돌린다.

---

## 5. 공지 / 앱 알림 / Web Push

### 5.1 공지 운영

관리자 → **공지 관리**:

- 임시저장
- 발행
- 수정
- 삭제
- 읽음 수 / 활성 사용자 수 확인

첫 draft → published 전환에서만 새 공지 Push를 발송한다.
이미 발행된 글을 수정해도 새 공지 Push를 다시 보내지 않는다.

회원:

- published 공지만 조회
- 안 읽은 공지 수가 왼쪽 `공지` 배지에 표시
- 공지를 열면 읽음 처리

### 5.2 VAPID 키 준비

Web Push를 사용하려면 안전한 로컬 환경에서 VAPID 키 한 쌍을 만든다.
프로젝트에 `web-push`가 설치되어 있으므로 예를 들어 다음 도구를 사용할 수 있다.

```bash
npx web-push generate-vapid-keys --json
```

생성 결과 중:

- publicKey → `WEB_PUSH_VAPID_PUBLIC_KEY`
- privateKey → `WEB_PUSH_VAPID_PRIVATE_KEY`

`WEB_PUSH_SUBJECT`는 운영자 연락처를 나타내는 URI 형식(예: `mailto:...`)으로 설정한다.

**privateKey를 이 문서나 GitHub에 기록하지 않는다.**

설정 후 Vercel Preview/Production을 새로 배포한다.

### 5.3 회원 Push 권한

브라우저 첫 진입에 자동 권한 요청을 띄우지 않는다.
회원이 공지 화면에서 **새 공지 알림 받기**를 직접 눌렀을 때만 요청한다.

- 지원 기기 + 허용: Web Push + 앱 안 배지
- 거부/미지원: 앱 안 배지만 사용
- Push 장애: 공지 게시 자체는 정상 성공

iPhone/iPad는 Web Push를 지원하는 iOS/iPadOS와 홈 화면에 추가한 웹앱 조건을 충족해야 한다.

---

## 6. 기도요청 운영

회원 화면:

- 다른 사용자의 요청은 보이지 않는다.
- `중보 기도가 필요한 내용을 자유롭게 적어주세요.`
- 내용 입력 후 전송
- 성공 시 `기도요청이 전달되었습니다.`

관리자 → **기도요청 관리**:

상태:

- 접수(`received`)
- 기도중(`praying`)
- 완료(`completed`)

기도요청 본문은 민감정보로 취급한다.

- 일반 사용자에게 공개하지 않는다.
- 애플리케이션 로그에 본문을 남기지 않는다.

---

## 7. 상담 & 심방 / Google Calendar

### 7.1 Google Cloud 준비

Google Cloud Console에서:

1. Google Calendar API 활성화
2. OAuth consent screen 구성
3. OAuth Client 유형을 **Web application**으로 생성
4. Preview callback URI 등록
5. Production 도메인이 확정되면 Production callback URI 추가

Preview callback:

```text
https://prayer-one-month-challenge-git-feature-pr-b37d82-ditto0310-2413.vercel.app/api/admin/google-calendar/callback
```

Production:

```text
https://<production-domain>/api/admin/google-calendar/callback
```

Vercel 환경변수에 client id / client secret을 설치한다.
client secret은 공개하지 않는다.

### 7.2 Google token 암호화 키

별도 32-byte random key를 base64로 만든다.

예:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

출력값을 `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`에 설치한다.
이 키는 `ROSTER_ENCRYPTION_KEY`와 반드시 별도로 사용한다.

### 7.3 관리자 연결

관리자 → **설정** → Google Calendar:

1. `Google Calendar 연결`
2. 관리자 Google 계정 OAuth 승인
3. 쓰기 가능한 Calendar 목록 로드
4. 운영 Calendar 1개 선택
5. 저장

앱은 Calendar 목록 읽기 + 이벤트 읽기/쓰기 범위만 사용한다.

Google refresh token은 브라우저에 보내지 않고 서버에서 AES-256-GCM으로 암호화해 저장한다.

### 7.4 심방 신청 가능 날짜

날짜 전체가 다음 중 하나면 신청 불가:

- 운영 Google Calendar에 해당 날짜와 겹치는 일정이 하나라도 있음
- 이미 취소되지 않은 심방 신청이 있음
- 관리자가 해당 특정 날짜를 비활성화
- 관리자가 해당 요일을 반복 비활성화
- Google Calendar 확인 실패

Calendar 조회 장애 시 예약 가능으로 추정하지 않고 **fail-closed** 한다.

### 7.5 심방 신청

회원은 활성 날짜를 선택하고 입력:

- 개인심방 / 샘심방
- 참석자 명단
- 장소
- 희망 시간
- 심방 요청 이유

안내:

`신청한 내용을 확인 후 유선으로 확정합니다.`

회원 버튼:

`확정`

회원의 확정 버튼은 제출 확정의 의미이며 DB 상태는 `requested`로 생성된다.

Google Calendar에는 종일 일정 생성:

- 신청자
- 심방 유형
- 장소
- 희망 시간
- 참석자 명단

**심방 요청 이유는 Google Calendar에 보내지 않는다.**

관리자 → **심방 신청 관리**:

- 수정
- 유선확정 완료
- 완료
- 취소
- Google 동기화 상태 확인

---

## 8. 관리자 대시보드

관리자 메뉴:

1. 대시보드
2. 기도운동 관리
3. 심방 신청 관리
4. 기도요청 관리
5. 공지 관리
6. 사용자 관리
7. 설정

대시보드는 민감 본문을 보여주지 않고 다음 요약만 보여준다.

- 기도운동 참여 / 오늘 완료
- 대기 심방 신청
- 이번 주 확정 심방
- 미처리 기도요청
- 최근 공지
- 최근 활동의 안전한 요약

각 카드는 해당 관리 화면으로 이동한다.

---

## 9. DB 보안 / Advisor

현재 앱의 민감 테이블은 private `prayer_app` schema에 있으며 서버 API로만 접근한다.

배포 전/스키마 변경 후:

1. Supabase Security Advisor 확인
2. Performance Advisor 확인
3. 민감 테이블의 anon/authenticated grant 여부 확인
4. 마이그레이션 적용 여부 확인

2026-09-26 검증:

- Security Advisor: **0 findings**
- Performance Advisor: INFO 수준의 FK covering index / unused index 권고만 존재
- INFO 권고는 실제 운영 쿼리와 데이터량을 관찰한 후 최적화한다.

Performance remediation reference:

```text
https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
```

---

## 10. 장애 대응

### 로그인 장애

1. roster에 사용자 존재 여부
2. 로그인 허용(`is_active`) 여부
3. 이름 정규화/초기 전화번호 또는 변경 비밀번호 확인
4. 로그인 rate-limit 차단 여부
5. 세션 폐기 후 재로그인

### 기도 체크 장애

1. 활성 challenge
2. 기간
3. Asia/Seoul 기준 오늘/어제
4. 일요일 여부

### 공지 Push 장애

1. 공지 자체가 published인지
2. VAPID 환경변수 존재 여부
3. 회원 브라우저의 Notification 권한
4. Service Worker / Push 지원 여부
5. 앱 안 unread 배지는 정상인지

Push 장애 때문에 공지 게시를 실패 처리하지 않는다.

### 심방 장애

1. Google Calendar 연결 여부
2. 운영 Calendar 선택 여부
3. Google OAuth 권한/refresh token
4. 해당 날짜의 기존 Google 일정
5. 특정 날짜/요일 차단
6. 기존 활성 심방 신청
7. Calendar sync status

Google 조회가 실패하면 날짜 신청을 막는 것이 정상 동작이다.

### 로딩 지연 / 응답 중단

- Runtime Logs에서 실제 함수 실행 지역이 `icn1`인지 확인한다. 요청 수신 지역과 함수 실행 지역은 다를 수 있다.
- DB는 인스턴스당 최대 5개 연결을 사용한다. 연결/대기열 획득은 5초, 서버 쿼리는 8초, 클라이언트 쿼리 대기는 10초로 제한한다. 실패한 트랜잭션의 연결은 폐기한다. Fluid Compute에서는 `attachDatabasePool`로 유휴 연결을 정리한다.
- 월간 일정은 Google 일정과 세 가지 DB 조건을 동시에 조회한다. 조회 묶음은 8초를 넘으면 신청을 차단한다. Google 읽기 요청은 5초/페이지, 전체 페이지 조회는 8초이며 자동 재시도를 하지 않는다.
- OAuth access token은 프로세스 안에서 SDK 만료 정책에 따라 재사용한다. 연결/토큰 변경과 해제 여부는 매번 DB에서 확인하고, 일정 자체는 캐시하지 않는다.
- 화면은 25초가 지나도 응답이 없으면 대기를 끝낸다. 캘린더는 `다시 확인`으로 재조회한다. 기도요청은 입력을 보존하고 관리자에게 접수 여부 확인을 안내한다. POST를 자동 재전송하지 않는다.
- 쿼리 본문, 기도/심방 내용, 전화번호, 토큰을 로그에 추가하지 않는다. 운영 DB에서 지연 주입 테스트를 실행하지 않는다.

---

## 11. 배포 전 체크리스트

### 공통

- [ ] 전체 `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Supabase Security Advisor 0 critical/error
- [ ] Preview Vercel deployment Ready

### 회원 화면

- [ ] 설치 이름이 `56사랑`
- [ ] 아이콘 확인
- [ ] `56공동체` / 지정 성구 확인
- [ ] 메뉴 순서: 기도운동 → 심방신청 → 기도요청 → 공지
- [ ] 메뉴를 누르면 해당 화면 **하나만** 표시
- [ ] 모바일 드로어 확인
- [ ] 기도운동 체크/달성률 확인
- [ ] 기도요청 전송 확인
- [ ] 공지 목록/상세/unread 배지 확인

### Push

- [ ] VAPID 환경변수 설치
- [ ] 지원 브라우저에서 알림 허용
- [ ] 테스트 공지 발행
- [ ] Push 수신
- [ ] Push 클릭 시 해당 공지 이동

### Google Calendar / 심방

- [ ] Google Calendar API 활성화
- [ ] OAuth callback URI Preview/Production 등록
- [ ] Google 환경변수 설치
- [ ] 관리자 설정에서 계정 연결
- [ ] 운영 Calendar 1개 선택
- [ ] 기존 Google 일정 날짜 비활성 확인
- [ ] 특정 날짜 차단/해제 확인
- [ ] 반복 요일 차단 확인
- [ ] 빈 날짜 심방 신청
- [ ] Google 종일 일정 생성
- [ ] Calendar 설명에 신청자/장소/희망시간/참석자 확인
- [ ] 심방 요청 이유가 Calendar에 없는지 확인
- [ ] 관리자 유선확정/수정/완료/취소 동기화 확인

### 관리자

- [ ] 대시보드 요약 확인
- [ ] 공지 작성/수정/삭제
- [ ] 기도요청 상태 변경
- [ ] 심방 관리
- [ ] 사용자 XLS import/추가/수정/선택삭제
- [ ] 비밀번호 새 값 설정/전화번호 초기화

---

## 12. 출시 원칙

- Preview에서 사용자 승인 전 `main` 병합 금지
- Google/VAPID secret을 저장소에 추가하지 않음
- 상담/심방 사유, 기도요청 본문, 전화번호, refresh token을 로그에 출력하지 않음
- 실데이터를 이용한 테스트가 필요할 경우 최소한으로 사용하고 테스트 후 정리

## 13. 통합 검증 실행과 2026-09-27 최초 확인 범위

`npm ci` → `npm test` → `npm run lint` → `npm run build` → `npm run test:e2e` 순서로 실행한다. E2E는 production build를 `http://localhost:3000`의 `next start`로 구동한다. 개발 서버를 재사용하지 않는다. 숫자 loopback 주소는 Playwright의 API 클라이언트가 Secure 세션 쿠키를 보내지 않으므로 사용하지 않는다. 실제 Production의 Secure 쿠키 옵션은 유지한다.

DB 통합 검증에는 별도 일회용 PostgreSQL 17, TLS, 가상 명단을 사용한다. `scripts/seed-e2e.ts`는 `CI=true`, `E2E_DATABASE_READY=1`, 로컬 `prayer_e2e` DB를 요구하고, 앱 스키마가 이미 있으면 거부한다. 전체 검증을 재실행할 때 새 DB를 준비한다. 운영 Supabase에는 시드를 실행하지 않는다. DB 설정 없이 건너뛴 검사는 완료 근거로 삼지 않는다.

이번 로컬 검증: 단위 검사 226개, 브라우저 검사 13개 모두 통과, 건너뜀 0. 빌드 통과, lint 오류 0 / 기존 경고 2. 포함 범위는 실제 로그인/보안 세션/로그아웃, 기도 저장 응답 유실과 재시도, 공지 비공개 초안/읽음 유지, 비공개 기도요청, 모든 관리자 HTTP 핸들러의 권한, 7개 관리자 화면, 360px 회원/관리자 메뉴, Calendar 설정 오류와 미연결 심방 차단이다.

운영 Supabase 읽기 전용 확인: Security Advisor 0건, `anon` / `authenticated`의 `prayer_app` 스키마 사용 권한 없음 및 명시적 테이블 권한 0건. Calendar 연결/선택, Push 구독은 각각 0건이다. 운영 데이터와 스키마는 변경하지 않았다.

현재 Vercel 커넥터는 `ditto0310-2413` 프로젝트 범위에 조회 권한이 없어 403을 반환한다. GitHub의 Vercel 배포 상태와 공개 Preview 접근은 별도로 확인할 수 있지만, 비공개 빌드 로그/환경변수 설치 여부는 이 연결로 확정할 수 없다. 이 범위에 접근 가능한 계정으로 Vercel 연결을 다시 인증해야 한다.

출시 전 사용자 확인:

1. Vercel의 해당 프로젝트 범위 접근을 복구하고 기존 서버 환경변수의 설치 여부를 확인한다. 비밀값을 채팅에 보내지 않는다.
2. Google Cloud Calendar API/OAuth Web client와 실제 Preview/Production callback URI를 설정한 뒤, 앱 관리자 설정에서 직접 Google 계정 승인 및 쓰기 가능한 캘린더 선택을 완료한다.
3. 승인된 테스트 일정으로 심방 생성/수정/취소와 사유 비전송을 확인한다. 지원 휴대폰에서 알림 수신을 허용하고 Web Push를 확인한다.
4. 실제 모바일 화면을 검토하고 별도로 출시를 승인한다. 그 전에는 PR #1을 병합하지 않는다.

## 14. 2026-09-27 성능 개선 검증

최초 통합 확인 이후 사용자가 Google 연결을 진행했고, 로그인된 브라우저로 Vercel Runtime Logs를 확인할 수 있었다. 300초 후 실패하는 요청과 미국 함수/서울 DB의 지역 차이를 확인했다. 코드 수정과 재현 근거는 [성능 검증 기록](superpowers/execution/2026-09-27-performance.md)에 정리한다.

성능 수정의 로컬 검증: 단위 237개 + 별도 일회용 DB 검사 3개 + Playwright 15개 통과. lint 오류 0/기존 경고 2, production build 성공. CI에서는 DB 시드 이후 `tests/db/connection-resilience.test.ts`를 추가로 실행한다. 운영 사용자 내용을 이용한 전송/일정 생성은 실행하지 않았다.

## 15. 관리자 설정과 별도 리더 명단

- 성도 명단과 샘 리더 명단은 별도로 가져온다. 관리자 → 설정 → 샘 리더 관리에서 `마을 / 마을장 / 샘 / 샘리더` 열의 XLS/XLSX를 받으며, 마을 병합 셀도 지원한다. 일정의 리더는 `샘리더` 열을 사용한다. 직분은 제거하고 이름의 A/B/C 구분자는 유지한다. 가져오지 않은 샘과 기존 회원 명단은 보존한다.
- 심방 제목은 샘심방 `1-2샘 심방(샘)`, 개인심방 `1-2샘 심방` 형식이다. 설명에 `리더: 이름`을 넣고, 미등록은 `리더: 미등록`으로 표시한다. 비공개 요청 사유는 전달하지 않는다. 새 일정 및 이후 수정/확정/완료부터 적용하며 기존 일정을 일괄 수정하지 않는다.
- 특정 날짜 활성화는 반복 비활성 요일과 Google 일정 차단을 예외로 연다. 이미 심방이 있는 날짜, 지난 날짜, Calendar 조회 장애는 열리지 않는다. 동일 날짜를 다시 비활성화하면 기존 예외를 교체한다. `설정 해제`는 반복 요일/Google 일정에 따른 기본 정책으로 되돌린다.
- 심방 `신청 삭제`는 Google event ID가 있으면 Google 일정부터 삭제하고 앱 기록을 삭제한다. Google 삭제 실패 시 기록을 보존한다. 이미 삭제된 일정의 410만 성공으로 인정하고 권한 문제일 수 있는 404는 실패를 유지한다. 초기 일정 생성 중에는 취소·삭제를 거부한다.
- 기도요청 삭제는 관리자만 가능하며 본문과 상태를 함께 제거한다. 기도운동 참여자 삭제는 현재 도전의 명단·순위·샘별 통계·첫 화면 통계에서만 제외한다. 로그인 자격, 성도 명단, 개인 체크인은 유지한다. 다음 도전에는 이전 도전의 제외가 적용되지 않는다.
- 기도 달력은 일요일부터 표시한다. 기도 체크 허용일은 기존대로 서울 기준 오늘/어제의 월~토이다. 저장이 지연되면 25초 내 버튼을 풀고 결과 미확인을 알린다. 재시도는 같은 체크/취소 상태를 명시한다.

필수 DB 변경은 `drizzle/20260927041054_visit_admin_controls.sql`이다. 기존 차단일은 비활성 상태를 유지하고, 참여자 제외 테이블은 RLS와 공개 역할 권한 회수로 보호한다. 실제 리더 명단과 운영 비밀값은 저장소에 넣지 않는다.


## 16. 심방 신청의 선택 입력

참석자 명단·장소·희망 시간·심방 요청 이유는 모두 선택 입력이다. 날짜를 선택하면 아무 항목을 입력하지 않아도 `신청`할 수 있다. 요청은 기존처럼 신청 상태로 접수되고 관리자가 유선으로 확정한다. 관리자 수정에서도 일부 항목만 보완할 수 있으며, 빈 문자열을 저장하므로 DB 변경은 필요하지 않다. 날짜·유형·로그인·글자 수 제한 및 중복 일정 차단은 유지한다.

검증: 단위 301개, 별도 TLS DB 검사 3개, Playwright 25개 통과. 개인/샘심방의 모든 항목 공란 전송, 실제 API의 빈 입력 검증, 360px 화면, 응답 중단 시 25초 후 버튼 복구를 포함한다. lint 오류 0/기존 경고 2, production build 성공. 실제 운영 심방은 생성하지 않았다.
