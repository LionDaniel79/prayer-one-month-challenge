# 로딩 지연 원인과 성능 수정

## 확인한 증거

- 기준 브랜치: `feature/prayer-one-month-challenge`, `7c5c24bd`.
- 2026-09-27 11:01:02 KST Preview Runtime Log: `GET /api/visits/availability?month=2026-09`, 총 4.2초/함수 4.01초. 서울(icn1)에서 수신한 요청을 미국(iad1) 함수로 전달했다. Supabase 프로젝트는 서울(ap-northeast-2)이다.
- 여러 읽기 API(월별 심방 가능일, 공지 미확인 수, 관리자 차단일, Calendar 상태)가 300초 후 504를 반환한 기록이 있었다.
- Supabase의 내용 없는 쿼리 집계에서 세션 SELECT는 평균 0.22ms/최대 8.68ms, Calendar 연결 조회는 평균 0.02ms였다. SQL 실행 자체가 수초 걸리는 근거는 없었다. 네트워크 왕복/연결 대기가 주요 개선 대상이다.
- 기존 DB 클라이언트는 연결 1개와 쿼리 제한 없는 대기였다. 일회용 로컬 DB에서 1초 대기 쿼리가 뒤의 짧은 요청을 약 903ms 지연시켰고, 20초 대기 쿼리는 중단되지 않았다.
- Calendar SDK를 매번 새로 만들면서 access token을 잃었고, Google 조회 뒤 DB 조건을 순차로 조회했다. 브라우저 fetch에 제한 시간이 없어 기도요청과 캘린더가 계속 대기할 수 있었다.

## 수정

- Vercel 함수 서울 배치, 제한된 pg 연결 풀과 연결/쿼리 제한 시간, Fluid Compute 유휴 정리 적용. 기존 필수 TLS 정책 보존. Drizzle의 BEGIN 실패 시 누락될 수 있는 연결 정리를 직접 보장하고 실패한 트랜잭션 연결 폐기.
- 요청 단위의 React cache로 레이아웃/페이지 세션 중복 조회 감소. 사용자 간 세션 캐시는 생성하지 않음.
- 월간 일정 확인을 병렬 처리하고 필요한 Google 필드만 요청. 만료 정책을 가진 OAuth access token 재사용. 실제 일정은 매번 새로 읽고, 조회 실패 시 예약을 허용하지 않음.
- 캘린더 화면 요청 취소, 오래된 응답 무시, 제한 시간과 재시도 버튼. 기도요청 응답 지연 시 입력 보존 및 접수 확인 안내. POST 자동 재시도 없음.
- 회원/관리자 이동 시 로딩 상태 즉시 표시.

## 재현 및 검증

- 변경 전 실패를 확인한 뒤 DB 동시 처리/쿼리 제한, Calendar 병렬 조회/중단, OAuth 재사용, 브라우저 무한 대기 회귀 검사를 통과시켰다.
- 별도 검토에서 BEGIN/ROLLBACK 실패 시 연결 정리와 URL의 SSL 옵션 우선순위 문제를 발견했다. 실패 재현 후 수정했고, 검토자가 남은 중요 차단 사항 없음을 확인했다.
- 전체 검사는 PR #1의 최신 CI 결과를 기준으로 확인한다. 별도 일회용 TLS PostgreSQL에서 DB 복구 검사와 Playwright를 실행한다. 운영 DB/Google 일정에 검증용 내용을 작성하지 않는다.
- 로컬 최종 결과: `npm test` 237개 통과 + 별도 DB 환경 검사 3개 통과; lint 오류 0/기존 경고 2; production build 성공; 새 일회용 DB로 Playwright 15개 통과/건너뜀 0. 기도요청의 실제 POST 201과 응답 중단 시 입력 보존/자동 재전송 없음도 확인했다.

## 근거 문서

- https://vercel.com/docs/functions/configuring-functions/region
- https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute
- https://node-postgres.com/apis/pool
- https://node-postgres.com/apis/client
- https://supabase.com/docs/guides/database/connecting-to-postgres

이번 측정은 제한된 요청 표본이며 p95 부하 시험이 아니다. 실제 기도요청 전송은 가상 계정 E2E로 검증하고, 운영 사용자 내용을 새로 전송하지 않는다. main 병합 및 Production 출시는 별도 승인 전까지 진행하지 않는다.
