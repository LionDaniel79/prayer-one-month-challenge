# 56사랑 커뮤니티 허브 확장 설계

작성일: 2026-09-24

이 문서는 기존 기도운동 앱을 **56공동체 통합 웹앱 "56사랑"**으로 확장하는 설계다.

기존 다음 설계는 그대로 유지한다.

- `2026-09-22-prayer-one-month-challenge-design.md`
- `2026-09-23-roster-auth-optimistic-checkin-design.md`

즉, 기존 명단 기반 로그인, 비밀번호 변경/초기화, 관리자 권한, 기도 체크 데이터와 규칙은 유지하고 이번 설계가 새 사용자 메뉴, 공지, 심방신청, 기도요청, Google Calendar 연동, Web Push, 관리자 통합 대시보드를 추가한다.

---

## 1. 목표

1. 앱 브랜드를 `56사랑`으로 변경한다.
2. 로그인 후 사용자 화면을 하나의 공통 앱 셸로 만들고 왼쪽 메뉴 4개를 제공한다.
3. 메뉴 순서는 반드시 다음과 같다.
   1. 기도운동
   2. 심방신청
   3. 기도요청
   4. 공지
4. 기존 기도운동 기능은 데이터와 규칙을 보존한 채 `기도운동` 메뉴 아래에서 계속 사용한다.
5. 관리자가 작성하는 목록형 공지 게시판과 앱 내 새글 알림, 가능한 기기의 Web Push 알림을 제공한다.
6. Google Calendar 1개와 연동한 날짜 단위 상담&심방 신청 기능을 제공한다.
7. 사용자는 기도요청을 비공개로 작성할 수 있고 관리자는 요청을 확인/관리할 수 있다.
8. 관리자 화면을 전체 요약 대시보드 + 기능별 관리 화면으로 재구성한다.
9. 데스크톱과 모바일 PWA에서 모두 자연스럽게 사용할 수 있어야 한다.

---

## 2. 브랜드와 공통 앱 셸

### 2.1 앱 브랜드

PWA 설치 이름:

- `name`: `56사랑`
- `short_name`: `56사랑`

웹앱 상단 브랜드:

- 큰 제목: `56공동체`
- 부제: `성령이 하나 되게 하신 것을 힘써 지키라(엡 4:3)`

기존 `기도운동 1달 도전`은 앱 전체 이름이 아니라 기도운동 기능의 제목/도전명으로만 남길 수 있다.

### 2.2 아이콘

새 PWA 전용 아이콘 세트를 만든다.

필수 자산:

- 192×192
- 512×512
- 512×512 maskable
- Apple touch icon

시각 방향:

- `56사랑`을 상징하는 심플한 하트/십자가 계열
- 작은 홈 화면 아이콘에서도 식별 가능한 굵은 형태
- 기존 기도운동 단일 기능 아이콘보다 "공동체 앱"으로 보이도록 변경

### 2.3 사용자 레이아웃

데스크톱:

- 왼쪽 고정 사이드바
- 오른쪽 메인 콘텐츠
- 상단 메인 콘텐츠에 `56공동체` / 말씀 부제 표시
- 사이드바 하단에 `내 정보`, `로그아웃`
- 관리자 계정에는 `관리자` 링크 추가

모바일:

- 동일한 메뉴 순서를 유지
- 왼쪽에서 열리는 드로어/사이드 메뉴
- 메뉴가 닫혀 있을 때 메인 콘텐츠 폭을 최대한 확보
- 터치 타깃은 최소 44px 수준으로 유지

공지 메뉴에는 안 읽은 공지 수를 숫자 배지로 표시한다.

---

## 3. 사용자 라우팅

로그인 사용자 기준:

- `/` — 기도운동
- `/visits` — 심방신청
- `/prayer-requests` — 기도요청
- `/notices` — 공지 목록
- `/notices/[id]` — 공지 상세
- `/profile` — 내 정보

모든 사용자 라우트는 기존 세션 인증을 요구한다.

관리자:

- `/admin` — 통합 대시보드
- `/admin/prayer` — 기도운동 관리
- `/admin/visits` — 심방 신청 관리
- `/admin/prayer-requests` — 기도요청 관리
- `/admin/notices` — 공지 관리
- `/admin/users` — 사용자/로그인 허용 명단 관리
- `/admin/settings` — Google Calendar, 휴무일/요일, 알림 등 설정

모든 관리자 라우트는 현재의 `role=admin` 검사를 통과해야 한다.

---

## 4. 공지

### 4.1 사용자 화면

공지 화면은 목록형 게시판이다.

목록 항목:

- 제목
- 작성일
- `NEW` 표시
- 읽음/안읽음 상태

정렬:

- 최신 발행 공지 우선

사용자가 공지 상세를 열면 해당 공지를 읽음 처리한다.

일반 사용자는 공지를 작성/수정/삭제할 수 없다.

### 4.2 관리자 기능

관리자는 다음을 할 수 있다.

- 새 공지 작성
- 임시저장
- 발행
- 수정
- 삭제
- 발행 일시 확인
- 읽은 사용자 수/전체 대상 사용자 수 확인

공지 필드:

- 제목
- 본문
- 상태: `draft | published`
- 작성 관리자
- 생성일
- 수정일
- 발행일

공지 수정은 기존 읽음 기록을 유지한다. 새 공지로 다시 알리고 싶다면 새 공지를 작성한다.

### 4.3 앱 내 새글 알림

필수 동작:

- 사용자의 안 읽은 `published` 공지 수를 계산한다.
- 사이드바 공지 메뉴에 숫자 배지 표시
- 공지를 읽으면 배지 수 즉시 감소
- 로그아웃/재로그인 후에도 읽음 상태 유지

`NEW` 표시는 안 읽은 상태를 중심으로 표시하고, 시간 기준 보조 표시를 사용할 수 있다.

---

## 5. Web Push

### 5.1 지원 범위

앱 내 공지 알림은 모든 환경에서 필수다.

Web Push는 지원 가능한 환경에서 추가 제공한다.

- Android Chrome 계열
- 데스크톱 Push 지원 브라우저
- iOS/iPadOS 16.4+에서 홈 화면에 설치된 PWA

지원하지 않거나 사용자가 권한을 거부해도 공지 사용 자체에는 영향이 없다.

### 5.2 권한 UX

브라우저 첫 진입에서 자동 권한 팝업을 띄우지 않는다.

사용자가 명시적으로 누르는 `새 공지 알림 받기` 버튼을 제공한다.

흐름:

1. 지원 여부 확인
2. Notification 권한 요청
3. Service Worker 등록
4. PushSubscription 생성
5. 서버에 사용자+기기 구독 저장
6. 이후 공지 발행 시 Push 발송

권한 거부/차단 시 앱 내 알림만 사용한다.

### 5.3 Push 동작

공지 발행 시:

1. 공지 DB commit
2. 발행 성공 응답은 Push 성공 여부와 분리
3. 구독자들에게 Push 발송
4. Push 실패가 공지 발행을 취소하지 않음
5. 404/410 등 만료 구독은 제거

payload 최소 정보:

- 공지 id
- 제목
- 짧은 본문 preview
- 이동 URL: `/notices/[id]`

알림 클릭 시 해당 공지 상세로 이동한다.

OS 앱 아이콘 badge API는 지원 브라우저에서 best-effort로 사용할 수 있으나 필수 성공 조건은 아니다.

### 5.4 환경 변수

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`

private key는 절대 클라이언트 번들/GitHub에 포함하지 않는다.

---

## 6. 기도요청

### 6.1 사용자 화면

사용자에게는 목록을 보여주지 않는다.

화면 구성:

- 제목: `기도 요청`
- 안내문구: `중보 기도가 필요한 내용을 자유롭게 적어주세요.`
- 큰 입력 textarea
- `전송` 버튼

제출 성공 메시지:

- `기도요청이 전달되었습니다.`

다른 사용자의 요청은 절대 조회할 수 없다.

본인 요청 목록도 이번 범위에서는 표시하지 않는다.

### 6.2 관리자 기능

관리자 목록 필드:

- 요청자
- 요청일
- 내용 preview
- 상태

상태:

- `received` — 접수
- `praying` — 기도중
- `completed` — 완료

관리자는 상세에서 전체 내용과 요청자 정보를 확인하고 상태를 변경한다.

기도요청 내용은 일반 사용자에게 공개되는 게시판 데이터가 아니다.

---

## 7. 상담&심방 신청

메뉴 표시명은 `심방신청`으로 한다.

### 7.1 기본 UI

화면 왼쪽/중앙:

- 월 달력
- 이전/다음 달 이동

날짜 상태:

- 신청 가능
- 이미 일정 있음
- 다른 심방 신청 있음
- 관리자 특정 날짜 비활성
- 관리자 반복 요일 비활성
- Google Calendar 확인 실패

신청 불가 날짜는 클릭할 수 없게 표시한다.

활성 날짜를 누르면 오른쪽 사이드 패널이 열린다.

모바일에서는 오른쪽 패널 대신 화면 하단 sheet 또는 전체 폭 panel로 전환할 수 있다.

### 7.2 신청 입력

입력 필드:

- 심방 유형
  - 개인심방
  - 샘심방
- 신청자: 로그인 사용자에서 자동 기록, 읽기전용
- 참석자 명단
- 장소
- 희망 시간
- 심방 요청 이유

중복된 `참석자 명단` / `참여자 명단` 요구는 하나의 `참석자 명단` 필드로 통합한다.

안내문구:

- `신청한 내용을 확인 후 유선으로 확정합니다.`

사용자 최종 버튼:

- `확정`

이 버튼은 "신청 내용 확정 제출"의 의미다.
DB 상태는 아직 관리자 유선확정 전이므로 `requested`로 생성한다.

### 7.3 상태

심방 신청 상태:

- `requested` — 신청됨 / 관리자 확인 전
- `confirmed` — 유선확정 완료
- `completed` — 심방 완료
- `cancelled` — 취소

내부 연동 오류를 추적할 필요가 있으면 별도 sync 상태를 둔다.

- `pending`
- `synced`
- `failed`

사용자에게 `failed` 상태의 예약을 성공처럼 보이지 않게 한다.

### 7.4 날짜 단위 정책

시간 슬롯 예약은 하지 않는다.

한 날짜에 심방 신청은 최대 1건이다.

다음 중 하나라도 해당하면 날짜 전체가 비활성이다.

1. 선택한 Google Calendar에 해당 날짜와 겹치는 취소되지 않은 일정이 1개 이상 존재
2. DB에 취소되지 않은 심방 신청이 이미 존재
3. 관리자가 특정 날짜를 비활성화
4. 관리자가 해당 요일을 반복 비활성화
5. Google Calendar availability 조회 실패

Google Calendar 일정이 시간 일정인지 종일 일정인지와 관계없이 Asia/Seoul 기준 해당 날짜와 겹치면 그 날짜를 막는다.

이 규칙은 사용자의 "해당 날짜에 Google Calendar 일정이 하나라도 있으면 비활성" 요구를 그대로 적용한다.

### 7.5 동시 신청

달력 표시 이후 다른 일정이 생길 수 있으므로 제출 시 서버에서 반드시 다시 검증한다.

제출 서버 흐름:

1. 로그인/입력 검증
2. 관리자 blocked date/weekday 재검증
3. Google Calendar 일정 재조회
4. DB 중복 예약 검증
5. DB에 신청 생성
6. Google Calendar 일정 생성
7. Google event id를 신청에 저장
8. 성공 반환

DB에는 날짜별 활성 신청 중복을 막는 제약을 둔다.

동시에 두 사용자가 같은 날짜를 신청하면 한 요청만 성공해야 한다.

Google API와 Postgres를 하나의 원자적 transaction으로 만들 수 없으므로 보상 처리한다.

- DB 생성 후 Google 일정 생성 실패 → 신청을 취소/삭제하여 사용자에게 예약 성공을 노출하지 않음
- Google 일정은 생성됐는데 DB event id 저장 실패 → 생성한 Google event를 즉시 삭제 시도하고 오류 기록
- 복구 실패는 관리자에서 확인 가능한 운영 오류로 남김

### 7.6 Google Calendar 일정 내용

신청 성공 시 선택된 운영 캘린더에 **종일 일정**을 생성한다.

일정 제목 예:

- `[56사랑 심방] 홍길동 - 개인심방`

Google Calendar 설명:

- 신청자
- 심방 유형
- 장소
- 희망 시간
- 참석자 명단

`심방 요청 이유`는 민감한 상담 정보일 수 있으므로 Google Calendar에 넣지 않는다.
심방 요청 이유는 앱 DB와 관리자 화면에서만 관리한다.

관리자가 장소/희망시간/참석자 등 Calendar에 포함되는 정보를 수정하면 Google 일정 설명도 동기화한다.

관리자가 `유선확정 완료` 처리하면:

- 앱 상태 `confirmed`
- Google 일정 제목/설명에 `확정` 표시를 반영할 수 있다.

취소 시 Google event도 삭제/취소한다.

---

## 8. Google Calendar 연결

### 8.1 연결 방식

ChatGPT 계정 연결이 아니라 배포된 `56사랑` 웹앱 자체가 Google OAuth를 사용한다.

관리자 설정 화면:

1. `Google Calendar 연결`
2. 관리자 Google 계정 OAuth
3. 연결된 계정의 Calendar 목록 조회
4. 운영에 사용할 Calendar 1개 선택
5. 저장

선택 후 관리자 화면에는:

- 연결된 Google 계정 식별 정보(필요 최소)
- 선택된 Calendar 이름
- 연결 상태
- 마지막 availability 동기화/조회 상태
- `연결 해제`
- `캘린더 변경`

을 보여준다.

### 8.2 OAuth 범위

최소 권한 원칙을 적용한다.

필요 범위:

- Calendar 목록 읽기
- 선택 Calendar 이벤트 읽기/쓰기

Google OAuth `state`는 관리자 세션과 연결된 nonce로 검증하여 CSRF를 방지한다.

offline access refresh token을 사용한다.

### 8.3 토큰 저장

Google refresh token을 평문으로 DB에 저장하지 않는다.

별도 서버 전용 AES-256-GCM 키를 사용한다.

환경변수:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI` 또는 앱 base URL에서 안전하게 계산
- `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`

Roster 전화번호 암호화 키와 Google token 암호화 키는 분리한다.

access token은 가능한 한 장기 저장하지 않고 refresh token으로 필요 시 발급한다.

### 8.4 실패 정책

Google Calendar가 연결되어 있지 않으면 심방 신청 기능에 명확한 안내를 표시하고 예약을 막는다.

Google API timeout/권한 만료/쿼터 오류 등으로 일정 확인이 불가능하면:

- 날짜를 예약 가능으로 추측하지 않는다.
- 사용자에게 `일정 확인이 어려워 현재 신청할 수 없습니다. 잠시 후 다시 시도해 주세요.` 표시
- 관리자 설정에는 연결 오류 표시

즉 availability는 fail-closed다.

---

## 9. 관리자 심방 설정

### 9.1 특정 날짜 비활성

관리자는 Calendar 형태로 임의 날짜를 차단/해제할 수 있다.

필드:

- 날짜
- 관리자 메모(선택)

Google Calendar event를 만들 필요는 없다.
앱 예약 availability에서만 차단한다.

### 9.2 반복 요일 비활성

관리자는 월~일 중 복수 요일을 반복 비활성으로 지정할 수 있다.

예:

- 매주 일요일
- 매주 월요일 + 금요일

요일 설정은 별도 레코드 또는 설정 테이블로 저장한다.

변경 즉시 이후 달력 availability 계산에 반영한다.

이미 존재하는 예약을 자동 취소하지 않는다.
기존 예약과 충돌하는 설정을 추가할 때 관리자에게 경고한다.

---

## 10. 데이터 모델

새 테이블은 private `prayer_app` schema에 추가한다.

### 10.1 notices

- `id uuid pk`
- `title text not null`
- `body text not null`
- `status varchar not null` — draft | published
- `author_user_id uuid not null -> users`
- `published_at timestamptz null`
- `created_at`
- `updated_at`

index:

- status + published_at desc

### 10.2 notice_reads

- `notice_id uuid -> notices on delete cascade`
- `user_id uuid -> users on delete cascade`
- `read_at timestamptz`

primary/unique:

- notice_id + user_id

### 10.3 prayer_requests

- `id uuid pk`
- `user_id uuid not null -> users`
- `content text not null`
- `status varchar not null` — received | praying | completed
- `created_at`
- `updated_at`

index:

- status + created_at desc
- user_id + created_at desc

### 10.4 visit_requests

- `id uuid pk`
- `requester_user_id uuid not null -> users`
- `visit_date date not null`
- `visit_type varchar not null` — personal | sam
- `attendees text not null`
- `location text not null`
- `preferred_time text not null`
- `reason text not null`
- `status varchar not null` — requested | confirmed | completed | cancelled
- `calendar_sync_status varchar not null` — pending | synced | failed
- `google_event_id text null`
- `created_at`
- `updated_at`
- `confirmed_at timestamptz null`
- `confirmed_by_user_id uuid null -> users`

날짜 중복 제약:

- status != cancelled 인 신청에 대해 visit_date unique가 되도록 partial unique index 적용

### 10.5 visit_blocked_dates

- `visit_date date primary key`
- `reason text null`
- `created_by_user_id uuid not null -> users`
- `created_at`

### 10.6 visit_blocked_weekdays

- `weekday integer primary key`
- 0~6, 프로젝트에서 Sunday=0 등 규칙을 한 곳에서 고정
- `created_by_user_id uuid not null -> users`
- `created_at`

### 10.7 push_subscriptions

- `id uuid pk`
- `user_id uuid not null -> users`
- `endpoint text not null`
- `p256dh text not null`
- `auth text not null`
- `user_agent text null`
- `created_at`
- `last_seen_at`

unique:

- endpoint

사용자는 여러 기기를 등록할 수 있다.

### 10.8 google_calendar_connections

현재 앱은 관리자 운영 Calendar 1개만 지원한다.

- `id uuid pk`
- `connected_by_user_id uuid not null -> users`
- `google_account_email text null`
- `refresh_token_ciphertext text not null`
- `selected_calendar_id text null`
- `selected_calendar_name text null`
- `created_at`
- `updated_at`

앱 레벨에서 active connection은 1개만 허용한다.

민감 token은 관리자 API에서도 평문 반환하지 않는다.

---

## 11. API 경계

구체적인 파일 분할은 구현 계획에서 정하지만 논리 API는 다음 책임으로 나눈다.

### 사용자

공지:

- `GET /api/notices`
- `GET /api/notices/[id]`
- 상세 조회 시 읽음 처리 또는 별도 read endpoint
- `GET /api/notices/unread-count`

기도요청:

- `POST /api/prayer-requests`

심방:

- `GET /api/visits/availability?month=YYYY-MM`
- `POST /api/visits`

Push:

- `POST /api/push/subscribe`
- `DELETE /api/push/subscribe`
- VAPID public key는 공개 가능

### 관리자

공지 CRUD:

- `GET/POST /api/admin/notices`
- `GET/PATCH/DELETE /api/admin/notices/[id]`

기도요청 관리:

- `GET /api/admin/prayer-requests`
- `PATCH /api/admin/prayer-requests/[id]`

심방 관리:

- `GET /api/admin/visits`
- `PATCH /api/admin/visits/[id]`
- `POST /api/admin/visits/[id]/confirm`
- `POST /api/admin/visits/[id]/complete`
- `POST /api/admin/visits/[id]/cancel`

blocked settings:

- `GET/POST/DELETE /api/admin/visits/blocked-dates`
- `GET/PUT /api/admin/visits/blocked-weekdays`

Google:

- `GET /api/admin/google-calendar/status`
- `GET /api/admin/google-calendar/connect`
- `GET /api/admin/google-calendar/callback`
- `GET /api/admin/google-calendar/calendars`
- `PUT /api/admin/google-calendar/selection`
- `DELETE /api/admin/google-calendar/connection`

모든 admin endpoint는 서버에서 권한을 재검증한다.

---

## 12. 관리자 정보구조

기존 한 파일의 긴 관리자 화면을 기능별 화면으로 분리한다.

왼쪽 관리자 메뉴:

1. 대시보드
2. 기도운동 관리
3. 심방 신청 관리
4. 기도요청 관리
5. 공지 관리
6. 사용자 관리
7. 설정

### 12.1 관리자 메인 대시보드

한눈에 볼 카드:

- 현재 기도운동 참여자 수
- 오늘 기도 완료 수/완료율
- 대기 중 심방 신청 수
- 이번 주 확정 심방 수
- 미처리 기도요청 수
- 최근 공지 수 / 가장 최근 공지

최근 활동:

- 새 심방 신청
- 심방 확정
- 새 기도요청
- 공지 발행

카드/활동 행은 해당 관리 화면으로 이동한다.

### 12.2 상세 관리 원칙

목록은 검색/필터를 제공한다.

심방:

- 상태 필터
- 날짜 필터
- 상세 편집
- Google 동기화 상태 표시

기도요청:

- 상태 필터
- 요청자 검색
- 상세 내용
- 상태 변경

공지:

- draft/published 필터
- 작성/편집
- 읽음 통계

사용자:

- 현재 구현된 참여자/로그인 허용 명단/비밀번호 초기화/선택 삭제를 보존

설정:

- Google Calendar 연결
- 운영 Calendar 선택
- 반복 비활성 요일
- 특정 날짜 비활성 관리
- Push 운영 상태(키 존재 여부 정도, secret 값 노출 금지)

---

## 13. 기존 기도운동 통합

기도운동의 서버 규칙은 변경하지 않는다.

- 시작일~1개월
- 월~토 대상
- 일요일 제외
- 오늘/어제 수정 가능
- optimistic check
- 현재 통계와 관리자 기능

변경되는 것은 레이아웃이다.

기존 `PrayerDashboardClient`의 자체 header/nav를 공통 앱 셸과 중복되지 않도록 정리한다.

기도운동 콘텐츠 안에서는:

- 현재 달성률
- 기간
- 기도 달력
- 사용자 기도 기록

을 유지한다.

---

## 14. 개인정보 및 권한

### 일반 사용자

볼 수 있음:

- 본인 기도운동
- published 공지
- 심방 availability
- 본인이 작성할 심방 신청 form
- 기도요청 form

볼 수 없음:

- 다른 사람 심방 신청
- 다른 사람 기도요청
- 관리자 메모
- Google OAuth token
- Push 다른 사용자 구독

### 관리자

볼 수 있음:

- 사용자/명단 정보
- 모든 심방 신청
- 모든 기도요청
- 공지 관리
- Google Calendar 연결 상태

Google refresh token / VAPID private key / 암호화 key 자체는 관리자 화면에도 표시하지 않는다.

기도요청 및 심방 요청 이유는 민감 정보로 취급하고 로그에 본문을 출력하지 않는다.

---

## 15. 에러 처리

사용자에게 내부 stack/DB/Google 응답 원문을 보여주지 않는다.

대표 오류:

- `VISIT_DATE_UNAVAILABLE`
- `CALENDAR_NOT_CONNECTED`
- `CALENDAR_AVAILABILITY_UNAVAILABLE`
- `VISIT_ALREADY_EXISTS`
- `NOTICE_NOT_FOUND`
- `PUSH_NOT_SUPPORTED`

사용자 메시지는 한국어로 변환한다.

Google 연결 문제가 있어도:

- 기도운동
- 공지
- 기도요청

은 정상 동작해야 한다.

Web Push 문제가 있어도 공지 발행/앱 내 알림은 정상 동작한다.

---

## 16. 테스트 기준

### 공통 셸/PWA

- desktop에서 왼쪽 메뉴 4개가 정확한 순서
- mobile에서 드로어로 동일 메뉴 사용
- active 메뉴 표시
- PWA manifest name/short_name = 56사랑
- 메인 제목/성구 정확히 표시
- 기존 로그인/profile/logout 동작 유지

### 공지

- 일반 사용자는 published 공지만 조회
- 일반 사용자 작성/수정/삭제 불가
- 관리자는 draft 작성 후 publish 가능
- unread count 정확
- 공지 상세 조회 후 read 생성
- 중복 read 생성 없음
- 새 공지 Push payload가 해당 상세 URL 포함
- Push 실패해도 공지 publish 성공
- 410 subscription 자동 제거

### 기도요청

- 로그인 사용자만 제출
- 빈 내용 거절
- 제출자는 다른 사용자 요청 목록 조회 불가
- 관리자만 전체 목록 조회
- received → praying → completed 변경 가능

### 심방 availability

- Google Calendar event가 날짜와 조금이라도 겹치면 비활성
- timed event / all-day event 모두 동일
- cancelled event는 차단하지 않음
- blocked date 비활성
- blocked weekday 비활성
- 기존 active visit 비활성
- Google 조회 실패 시 비활성/fail-closed
- Asia/Seoul 경계 테스트

### 심방 신청

- 활성 날짜 신청 성공
- disabled 날짜 서버에서도 거절
- 렌더 후 Google 일정이 생기면 제출 시 재검증하여 거절
- 동시 두 신청에서 하나만 성공
- Google 일정은 all-day
- Calendar description에 신청자/유형/장소/희망시간/참석자 포함
- reason은 Calendar description에 포함하지 않음
- Calendar 생성 실패 시 사용자에게 성공 반환 안 함
- 관리자 확정/수정/취소가 Google event와 동기화

### Google OAuth

- admin만 connect/callback/selection 가능
- state mismatch 거절
- refresh token 암호화 저장
- API 응답에 refresh token 노출 없음
- Calendar 1개 선택/변경 가능

### 관리자

- 대시보드 요약 숫자와 실제 데이터 일치
- 카드 클릭 시 상세 관리 화면 이동
- 기존 사용자 관리 기능 회귀 없음
- 민감 내용은 admin만 조회

---

## 17. 운영/환경 설정

새 Google Cloud 설정이 필요하다.

- OAuth consent screen
- Web application OAuth client
- Preview/Production redirect URI 등록
- Calendar API 활성화

새 환경변수는 Vercel Preview와 Production에 각각 설치한다.

Google:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`

Web Push:

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`

실제 secret 값은 GitHub, spec, 로그에 기록하지 않는다.

DB migration은 기존 사용자/기도기록/명단 데이터를 삭제하지 않는 additive migration으로 진행한다.

---

## 18. 구현 단계

1. 공통 `56사랑` 앱 셸 + PWA 이름/아이콘 + 기존 기도운동 이식
2. 공지 DB/API/UI + 읽음 배지
3. Service Worker + Web Push 구독/발송
4. 기도요청 DB/API/UI
5. 심방 DB + 달력 + blocked date/weekday
6. Google OAuth + Calendar 선택
7. 심방 availability와 Calendar event 생성/동기화
8. 관리자 정보구조 재구성 + 통합 대시보드
9. 관리자 각 기능 관리 화면
10. 통합 테스트, Supabase advisor, Preview 모바일/데스크톱 검증
11. 사용자 승인 후 main 병합/Production

Google OAuth credential 준비가 늦어져도 1~5와 관리자 골격 작업은 독립적으로 진행 가능하게 설계한다.

---

## 19. 완료 기준

다음이 모두 충족되어야 완료로 본다.

- 설치 이름과 아이콘이 `56사랑`
- 메인 상단에 `56공동체`와 지정 성구 표시
- 사용자 메뉴 4개가 요청 순서로 동작
- 기존 기도운동 기록/통계 손실 없음
- 공지 작성은 관리자만 가능
- 안 읽은 공지 앱 배지 동작
- 지원 기기에서 명시적 허용 후 Web Push 동작
- 기도요청은 사용자 입력 전용, 관리자 관리 가능
- 심방 날짜 availability가 Google Calendar + 앱 차단 규칙과 일치
- 심방 신청 성공 시 선택 Google Calendar에 일정 생성
- 관리자가 유선확정/수정/취소 관리 가능
- 관리자 대시보드에서 전체 기능 요약과 상세 이동 가능
- 민감 데이터 권한 테스트 통과
- 전체 unit/integration/build/lint/Preview 검증 통과

---

## 20. 이번 범위 밖

이번 확장에서 하지 않는다.

- 여러 관리자별 서로 다른 Google Calendar 지원
- 한 날짜에 여러 시간 슬롯 예약
- 사용자 간 기도요청 공개/댓글
- 공지 댓글
- SMS/Kakao 알림
- Google Calendar 일정의 외부 참석자 초대
- 여러 교회/공동체를 한 앱에서 tenant로 분리
- 네이티브 iOS/Android 앱 제작

이 항목들은 현재 요구사항 달성 후 별도 기능으로 확장할 수 있다.
