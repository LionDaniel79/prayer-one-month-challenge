# 교적 명단 기반 로그인 + 즉시 체크 반응 설계

작성일: 2026-09-23

이 문서는 기존 `docs/superpowers/specs/2026-09-22-prayer-one-month-challenge-design.md` 중
**로그인/회원 데이터/관리자 사용자 관리/기도 체크 UX**를 대체한다.
기간, 월~토 기도일, 오늘+어제 수정 가능, Asia/Seoul 기준, 관리자 통계 등 나머지 요구사항은 기존 설계를 유지한다.

## 1. 목표

1. 업로드된 `56공동체.xls`를 로그인 허용 명단의 기준 데이터로 사용한다.
2. 엑셀 명단에 존재하는 **한글 이름 + 전화번호** 조합만 로그인할 수 있다.
3. 엑셀 이름 끝의 영문 알파벳 접미사는 로그인 비교에서 무시한다.
4. 엑셀 명단 전체가 아니라 **실제로 한 번 이상 로그인한 사람만 기도운동 참여자**로 계산한다.
5. 관리자는 허용 명단의 사람을 직접 추가하고 수정할 수 있다.
6. 최초 관리자는 사용자가 지정한 “현식” 계정이다. 실제 전화번호 값은 공개 GitHub에 하드코딩하지 않고 private import/migration 과정에서만 매칭한다.
7. 기도 체크는 DB 응답을 기다리지 않고 화면에 즉시 반영한 뒤 백그라운드 저장하며, 실패할 때만 원상복구한다.

## 2. 개인정보 및 원본 파일 원칙

- `56공동체.xls`는 GitHub 저장소에 커밋하지 않는다.
- 원본 엑셀 파일은 개발 환경에서 **1회 import source**로만 사용한다.
- 원본 파일의 현재 SHA-256은 다음과 같이 import 추적용으로 기록한다.
  - `7845f487c9597d1a2210adc33cbf8ad6ca89e020b3f4b458c447a66f8ce72788`
- 전화번호 평문은 일반 DB 컬럼에 저장하지 않는다.
- 로그인 검색용으로는 기존 `PHONE_LOOKUP_PEPPER`를 이용한 HMAC-SHA256 값을 저장한다.
- 관리자 화면 표시/수정을 위해 전화번호는 별도의 앱 암호화 키로 AES-256-GCM 암호화하여 저장한다.
- 새 서버 환경변수 `ROSTER_ENCRYPTION_KEY`를 추가한다. 이 값 역시 GitHub에 커밋하지 않는다.
- 일반 회원 API에는 복호화된 전화번호를 반환하지 않는다.
- 관리자 전용 API만 권한 검사 후 필요한 전화번호를 복호화한다.

## 3. 원본 엑셀 매핑

원본에서 사용하는 논리 열:

- 이름
- 교회직분
- 핸드폰
- 마을
- 샘

### 3.1 이름 정규화

원본 이름은 추적을 위해 그대로 보존하고, 로그인/표시용 canonical name을 별도로 만든다.

규칙:

1. 앞뒤 공백 제거
2. Unicode NFC 정규화
3. 내부 연속 공백은 1칸으로 축소
4. 이름 **끝에 붙은 ASCII 영문 알파벳(A-Z/a-z) 접미사만 제거**
5. 접미사 제거 뒤 남은 끝 공백 제거

예:

- `김은희A` → `김은희`
- `김은희 B` → `김은희`
- `김은희` → `김은희`

로그인 입력 이름에도 같은 규칙을 적용한다.
중간에 있는 문자나 숫자를 임의로 제거하지 않는다.

### 3.2 전화번호 정규화

- Excel 셀의 raw numeric 값보다 **화면에 표시되는 formatted text**를 우선 읽어 앞자리 0 손실을 방지한다.
- 공백, 하이픈, 괄호 등 숫자가 아닌 문자를 제거한다.
- 로그인 입력에도 동일한 숫자 정규화를 적용한다.
- 전화번호가 없는 명단 행은 roster에는 가져오되 로그인 불가능 상태로 표시한다.
- 관리자가 전화번호를 추가하면 즉시 로그인 가능해진다.

### 3.3 샘 표시

원본의 마을과 샘을 각각 정규화해서 표시용 label을 만든다.

- `1마을` + `6샘` → `1-6`
- 마을 값에서는 끝의 `마을`을 제거한다.
- 샘 값에서는 끝의 `샘`을 제거한다.
- 양쪽 공백을 제거한다.
- 두 값 중 하나라도 없으면 화면에는 `미지정`으로 표시한다.
- 원본 마을/샘 값은 별도 컬럼으로 보존한다.

## 4. 데이터 모델

### 4.1 member_roster — 로그인 허용 명단 / 기준 데이터

새 테이블 `prayer_app.member_roster`:

- `id uuid pk`
- `source_name text` — 엑셀/관리자 입력 원문 이름
- `canonical_name varchar(80)` — 영문 접미사를 제거한 로그인/표시 이름
- `position varchar(80) null` — 교회직분
- `phone_lookup_hash varchar(64) null` — 로그인 검색 HMAC
- `phone_ciphertext text null` — AES-GCM 암호문/nonce/tag를 직렬화한 값
- `village varchar(80) null` — 정규화 전후 관리용 마을 값
- `sam varchar(80) null` — 정규화 전후 관리용 샘 값
- `sam_label varchar(100) null` — 예: `1-6`
- `is_active boolean not null default true`
- `is_admin boolean not null default false`
- `source varchar(20) not null` — `xls` | `admin`
- `source_row integer null`
- `created_at`
- `updated_at`

제약:

- `(canonical_name, phone_lookup_hash)`는 전화번호가 존재하는 경우 unique.
- exact duplicate 자격정보는 import 시 조용히 합치지 않고 오류/리포트 대상으로 처리한다.

### 4.2 users — 실제 참여자

`users`는 더 이상 전체 명단이 아니다.
**실제로 로그인에 성공한 사람만** 생성되는 참여자 테이블로 사용한다.

변경:

- `roster_id uuid unique references member_roster(id)` 추가.
- 기존 `role`은 세션/권한 코드 호환성을 위해 유지한다.
- 신규 user 생성 시 `member_roster.is_admin` 값에서 role을 결정한다.
- 기존 사용자 데이터/기도기록/세션 ID는 가능한 한 그대로 유지하면서 roster에 backfill한다.
- 기존 `sam_id`, `phone_password_hash`, `phone_lookup_hash`는 migration 호환을 위해 당장 삭제하지 않아도 되지만 더 이상 로그인/샘 정보의 authoritative source로 사용하지 않는다.
- 후속 정리 migration 전까지 legacy 컬럼으로 남길 수 있다.

**통계의 참여자 정의 = users에 존재하는 활성 사용자.**
따라서 엑셀에만 있고 아직 로그인하지 않은 사람은 모든 참여 통계/순위 분모에서 제외된다.

### 4.3 현식 관리자

- roster import 시 사용자가 지정한 현식 자격정보와 일치하는 row를 `is_admin=true`로 설정한다.
- 실제 전화번호는 코드/설계문서/GitHub에 하드코딩하지 않는다.
- 현재 이미 생성되어 있는 현식 사용자/기도기록/세션은 해당 roster row에 연결하고 role은 `admin`을 유지한다.
- fresh import 환경에서도 현식이 처음 로그인하면 자동으로 admin user가 생성되도록 한다.

## 5. 로그인 흐름

기존 “없는 계정이면 샘을 선택해 가입” 흐름을 제거한다.

### POST /api/auth/login

1. 이름/전화번호 입력 검증
2. 기존 rate limit 검사
3. 이름 canonicalization
4. 전화번호 normalization + HMAC lookup hash 생성
5. `member_roster`에서
   - canonical_name 일치
   - phone_lookup_hash 일치
   - is_active=true
   인 row 조회
6. 없으면 generic 401:
   - `ROSTER_MISMATCH`
   - UI: `등록된 명단과 일치하지 않습니다. 이름과 전화번호를 확인해 주세요.`
7. row가 있으면 `users.roster_id`로 실제 참여자 조회
8. user가 없으면 transaction에서 최초 참여자 생성
   - role = roster.is_admin ? admin : member
9. user가 있으면 현재 roster의 관리자 상태와 active 상태를 동기화
10. 기존 방식과 동일한 장기 HttpOnly 세션 생성
11. 성공 응답

### 제거

- 일반 사용자용 `POST /api/auth/register`
- 로그인 실패 후 샘 선택 화면
- 일반 사용자 스스로 샘을 바꾸는 profile 기능

프로필 화면은 필요하면 이름/직분/샘을 읽기 전용으로 보여주고,
명단 정보 수정은 관리자만 할 수 있다.

## 6. 관리자 명단 관리

관리자 페이지에 명단 영역을 명확하게 두 개로 구분한다.

### 6.1 참여자 명단

실제로 로그인해서 `users`가 생성된 사람만 표시한다.

첫 네 정보는 반드시 다음 순서를 따른다.

1. **이름**
2. **직분**
3. **전화번호**
4. **샘**

샘은 `마을-샘` label을 사용한다. 예: `1-6`.

그 뒤 필요에 따라 기존 정보:

- 달성률
- 완료일수
- 오늘 완료 여부
- 순위
- 관리 버튼

을 표시할 수 있다.

### 6.2 전체 로그인 허용 명단

`member_roster` 전체를 관리한다.

기능:

- 이름/전화번호/샘 검색
- 실제 참여 여부 표시
- 관리자 직접 신규 사용자 추가
- 기존 사용자 수정
- 활성/비활성
- 관리자 여부 설정

수정 필드:

- 이름
- 직분
- 전화번호
- 마을
- 샘
- 활성 여부
- 관리자 여부

마을/샘 수정 시 `sam_label`은 서버가 재계산한다.
전화번호/이름이 변경되어도 기존 참여자와의 연결은 `roster_id`로 유지된다.

자격정보(이름/전화번호)가 변경되거나 계정이 비활성화되는 경우
해당 사용자의 기존 세션은 폐기해서 다음 요청부터 새 자격정보를 사용하게 한다.

관리자 여부 변경은 roster와 이미 존재하는 user.role을 동시에 동기화한다.

## 7. 샘별 통계

기존 별도 샘 선택/가입 데이터 대신 roster의 `sam_label`을 기준으로 그룹화한다.

- `1-6`에 실제 로그인한 참여자만 해당 샘의 인원/평균 달성률 분모에 들어간다.
- roster에만 있고 아직 로그인하지 않은 사람은 샘 통계에서도 제외한다.
- 기존 legacy `sams` 테이블은 migration 안정성을 위해 당장 삭제하지 않아도 되지만 새 통계의 source of truth가 아니다.

## 8. 엑셀 1회 import

원본 `56공동체.xls`는 runtime 앱에 포함하지 않는다.

개발/운영 초기화용 one-off importer를 만든다.

예상 인터페이스:

```bash
npm run roster:import -- --file /absolute/private/path/56공동체.xls
```

요구사항:

1. 구형 `.xls` 파일 읽기
2. 필요한 열 확인
3. 모든 row를 메모리에서 정규화/검증
4. duplicate canonical name + phone 조합 검사
5. phone이 없는 row는 warning으로 기록하고 roster에는 import
6. malformed row는 import 전에 리포트
7. 치명적 중복/스키마 오류가 있으면 DB 변경 전에 중단
8. 정상일 때 transaction으로 roster insert
9. 현식 admin row 표시
10. 기존 현식 user를 roster row에 backfill
11. 결과에 총행/성공/전화번호 없음/오류 건수만 출력
12. 전화번호 평문은 로그에 출력하지 않음

원본 XLS는 공개 저장소로 복사하지 않는다.

## 9. 기도 체크 — Optimistic UI

현재 문제:
클릭 → API/DB 완료 → 전체 dashboard 응답 적용 순서라 체크표시가 네트워크 왕복만큼 늦다.

새 흐름:

1. 사용자가 날짜를 탭
2. 현재 날짜의 이전 checked 상태를 로컬에 기억
3. **즉시** completedDates를 변경
4. `calculateProgress()`를 클라이언트에서도 사용해 달성률/완료일수 즉시 갱신
5. 해당 날짜만 pending 상태로 표시/재클릭 방지
6. 백그라운드에서 POST `/api/checkins`
7. 성공:
   - 서버가 반환한 최종 checked/un-checked 상태와 해당 날짜만 reconcile
8. 실패:
   - **해당 날짜만** 이전 상태로 rollback
   - 달성률 다시 계산
   - 작은 inline 오류 메시지 표시
9. 다른 수정 가능 날짜는 독립적으로 클릭 가능

동시에 서로 다른 날짜 요청이 진행될 수 있으므로
“전체 dashboard snapshot을 통째로 rollback”하지 않는다.
날짜별 이전 상태를 가지고 functional state update로 반영하여 서로의 optimistic update를 덮어쓰지 않는다.

서버의 날짜 검증/권한 검증은 기존대로 유지한다.

## 10. 마이그레이션

운영 중인 현재 Preview 데이터 손실 없이 진행한다.

1. member_roster + 암호화 필드 migration
2. XLS 검증/import
3. 현재 현식 user를 roster에 연결
4. 사용자 읽기 로직을 roster join 기반으로 전환
5. 로그인 로직을 allowlist lookup으로 전환
6. 일반 signup/sam-selection UI 제거
7. 관리자 roster CRUD 추가
8. 통계 쿼리를 users + roster 기준으로 전환
9. optimistic check-in UI 반영
10. 전체 테스트 후 Preview 배포
11. 실제 현식 로그인/관리자 접근/기도 체크 확인
12. 이후 main 병합

기존 prayer_checkins는 user id를 유지하므로 삭제하거나 재작성하지 않는다.

## 11. 테스트 기준

### 이름/전화번호
- `홍길동A` roster와 로그인 `홍길동` + 같은 phone → 성공
- `홍길동B` 입력도 canonical 결과가 같으면 같은 credential 후보
- 같은 한글 이름 + 다른 전화번호 → 정확한 전화번호 row만 성공
- 이름 일치 + 전화번호 불일치 → 실패
- 전화번호 하이픈 유무 차이 → 동일 처리
- roster에 없는 사람 → 가입 화면 없이 실패
- phone 없는 roster row → 로그인 실패
- inactive roster row → 로그인 실패

### 참여자
- roster import만 한 사람은 관리자 참여자 수에 포함되지 않음
- 첫 로그인 성공 후 users row 생성 및 참여자 수 증가
- 재로그인은 users 중복 생성 없음
- roster 이름/전화번호 변경 후에도 기존 user/checkin 연결 유지

### 관리자
- 참여자 명단 첫 네 열: 이름 → 직분 → 전화번호 → 샘
- `1마을 + 6샘` → `1-6`
- 관리자 신규 roster 추가 → 해당 자격정보로 로그인 가능
- 관리자 수정 → 다음 로그인부터 새 정보 적용
- 비활성화 → 신규 로그인 차단 + 기존 세션 폐기
- 현식 roster/admin 매칭 → admin 권한

### Optimistic check-in
- API 응답을 인위적으로 지연해도 클릭 직후 체크표시가 먼저 보임
- 체크 직후 달성률/완료일수도 즉시 갱신
- API 성공 후 상태 유지
- API 실패 시 해당 날짜만 rollback
- 서로 다른 날짜 두 요청이 겹쳐도 한 날짜의 응답이 다른 날짜 optimistic 상태를 덮지 않음
- 기존 서버 측 today/yesterday/Sunday/기간 규칙은 모두 유지

## 12. 범위 밖

이번 변경에서 하지 않는다.

- 일반 사용자의 명단 직접 수정
- 사용자의 샘 직접 변경
- XLS 파일을 Vercel/GitHub에 저장
- SMS OTP
- 전화번호 기반 문자 인증
- 외부 교적시스템 자동 동기화
- 매 로그인마다 XLS 파일을 직접 읽기
