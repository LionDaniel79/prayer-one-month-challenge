# 운영 가이드 — 기도운동 1달 도전

## 1. 인프라

### Supabase

- Project: `prayer-one-month-challenge`
- Project ref: `mraqwckqvxkozvzyszhv`
- Region: `ap-northeast-2` (Seoul)
- Application schema: `prayer_app`
- 앱 테이블은 `public`이 아니라 private schema에 있으며 `anon` / `authenticated` 역할에 권한을 부여하지 않습니다.
- 앱 서버만 DB에 연결합니다.

### Vercel

Vercel 프로젝트에 다음 서버 환경변수를 설정합니다.

| 변수 | 용도 |
| --- | --- |
| `DATABASE_URL` | Supabase Shared Pooler Transaction mode(6543) PostgreSQL URL |
| `SESSION_SECRET` | 세션 토큰 HMAC용 비밀값, 최소 32자 |
| `PHONE_LOOKUP_PEPPER` | 전화번호 lookup HMAC용 별도 비밀값, 최소 32자 |

비밀값을 `NEXT_PUBLIC_*` 이름으로 만들지 마세요.

## 2. 최초 운영 준비

### 2.1 첫 관리자 + 첫 샘 생성

최초에는 관리자도 샘도 없으므로 아래 명령을 **한 번만** 실행합니다.

```bash
BOOTSTRAP_ADMIN_NAME="관리자이름" \
BOOTSTRAP_ADMIN_PHONE="01012345678" \
BOOTSTRAP_SAM_NAME="관리자샘" \
BOOTSTRAP_SAM_LEADER="샘리더이름" \
npm run admin:bootstrap
```

- 전화번호는 프로세스 메모리에서만 사용하며 평문으로 DB에 저장하지 않습니다.
- 이미 관리자가 존재하면 bootstrap은 중단됩니다.
- 실제 전화번호를 GitHub Issue, 로그, 스크린샷, 문서에 남기지 마세요.

### 2.2 나머지 샘 등록

첫 관리자로 로그인하여 `/admin` → **샘 추가**에서 샘 이름과 샘리더 이름을 등록합니다.

회원 공개 등록 전에 실제 사용할 샘을 먼저 등록하는 것이 좋습니다.

### 2.3 도전 기간 설정

`/admin` → **도전 설정**에서:

1. 제목: `기도운동 1달 도전`
2. 시작일 입력
3. 종료일 입력
4. 활성화 체크
5. 저장

기본 제품 규칙은 “시작일 포함 → 다음 달 같은 날짜의 전날”입니다. 예: 9월 22일 → 10월 21일.

기존 체크 기록이 새 기간 밖으로 밀려나는 기간 축소는 서버가 409로 거부합니다.

## 3. 로그인 / 자동 로그인

- 아이디: 이름
- 비밀번호: 전화번호
- DB에는 전화번호 평문을 저장하지 않습니다.
  - lookup: HMAC-SHA256
  - 검증: Argon2id
- 세션 쿠키:
  - HttpOnly
  - Secure(운영)
  - SameSite=Lax
  - 180일 rolling session
- 로그아웃 시 현재 세션이 폐기됩니다.
- 사용자를 비활성화하면 해당 사용자의 활성 세션을 모두 폐기합니다.

## 4. 관리자 추가

이미 가입한 회원을 관리자로 승격할 때:

```bash
npm run admin:promote -- --name "홍길동" --phone "01012345678"
```

스크립트는 전화번호를 출력하지 않습니다.

## 5. 일상 운영

### 회원

- 오늘과 어제만 체크/취소 가능
- 월~토만 기도일로 계산
- 일요일, 미래, 이틀 이상 지난 날짜는 수정 불가
- 모든 날짜 판정은 `Asia/Seoul`

### 관리자

- 전체 참여자 / 오늘 완료 / 평균 달성률
- 100%, 80~99%, 60~79%, 60% 미만 구간
- 샘별 평균 달성률 및 오늘 완료율
- 개인별 공동순위
- 사용자 샘/권한/활성 상태 관리

## 6. DB 보안 및 Advisor

2026-09-23 최종 점검 기준:

- Supabase Security Advisor: **0 findings**
- Performance Advisor: `unused_index` INFO 3건
  - `checkin_date_idx`
  - `sessions_user_idx`
  - `sessions_expiry_idx`

초기 데이터가 거의 없어 아직 사용 기록이 없는 인덱스입니다. 실제 운영 쿼리에 필요한 인덱스이므로 출시 전에는 제거하지 않습니다.

참고: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## 7. 백업 / 복구

- Supabase 대시보드의 현재 요금제별 백업/복구 옵션과 보존 기간을 운영 시작 전에 확인합니다.
- 중요한 운영 변경 전에는 데이터 export/backup을 확인합니다.
- 전화번호 원문, DB 비밀번호, 세션 토큰을 export 파일명·Issue·스크린샷에 노출하지 않습니다.
- 복구 후에는 관리자 로그인, 활성 도전, 샘 수, 체크인 수를 검증합니다.

## 8. 장애 대응

### 로그인 장애

1. 사용자 활성 상태 확인
2. 샘 활성 상태 확인
3. 반복 로그인 실패로 15분 차단되었는지 확인
4. 세션 폐기 후 재로그인 확인

### 체크 장애

1. 활성 challenge 존재 여부
2. Asia/Seoul 기준 오늘/어제인지
3. 일요일인지
4. challenge 기간 내부인지 확인

### 관리자 접근 장애

- 해당 사용자의 `role = admin` 여부 확인
- 권한 변경 후 기존 세션을 새로 로그인해 확인

## 9. 배포 전 체크리스트

- [ ] Vercel 환경변수 3종 설정
- [ ] 첫 관리자 bootstrap
- [ ] 전체 샘 등록
- [ ] 도전 기간 설정/활성화
- [ ] 일반 회원 테스트 계정 등록
- [ ] 브라우저 종료/재접속 자동 로그인 확인
- [ ] 오늘/어제 체크 및 취소 확인
- [ ] 오래된 날짜/일요일 비활성 확인
- [ ] 관리자 통계/순위 확인
- [ ] 로그아웃 후 자동 로그인 해제 확인
- [ ] 모바일 360px/430px 확인
- [ ] 홈 화면 추가(PWA) 확인
