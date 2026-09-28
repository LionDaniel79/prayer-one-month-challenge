# 새 인스턴스 출시 체크리스트

이 체크리스트는 [새 공동체용 독립 설치 가이드](new-instance-setup.md)를 완료한 뒤 사용합니다.

## 분리 확인

- [ ] 원본 56공동체 `DATABASE_URL`을 사용하지 않는다.
- [ ] `SESSION_SECRET`, `PHONE_LOOKUP_PEPPER`, `ROSTER_ENCRYPTION_KEY`를 새로 만들었다.
- [ ] Google Calendar를 쓰는 경우 새 OAuth Client와 새 token encryption key를 사용한다.
- [ ] 실제 회원 데이터나 비밀값을 GitHub에 커밋하지 않았다.

## Supabase

- [ ] 새 프로젝트를 생성했다.
- [ ] `drizzle/*.sql`을 파일명 순서대로 새 DB에 적용했다.
- [ ] `prayer_app` schema와 최신 community 테이블이 존재한다.
- [ ] anon/authenticated에 `prayer_app` schema 사용 권한이 없다.
- [ ] Security Advisor에서 새 ERROR/WARN이 없는지 확인했다.

## 관리자와 명단

- [ ] `npm run admin:bootstrap`으로 첫 관리자 생성에 성공했다.
- [ ] bootstrap용 네 환경변수를 로컬 설정에서 제거했다.
- [ ] 첫 관리자 로그인이 된다.
- [ ] 실제 성도 XLS/XLSX를 가져올 수 있다.
- [ ] 샘 리더 명단을 별도로 등록했다.

## Vercel

- [ ] 새 GitHub 저장소를 새 Vercel 프로젝트에 연결했다.
- [ ] 필수 환경변수 4개를 Production에 등록했다.
- [ ] Preview를 사용할 경우 Preview 환경에도 필요한 값을 등록했다.
- [ ] Production 배포가 Ready다.
- [ ] `/api/health`가 `status: ok`, `database: ok`를 반환한다.
- [ ] GitHub repository variable `PUBLIC_APP_URL`을 새 주소로 설정했다.

## 기능

- [ ] 사용자 로그인/로그아웃이 된다.
- [ ] 기도운동 기간을 설정하고 체크/취소가 된다.
- [ ] 심방 신청 화면이 열린다.
- [ ] 기도요청이 일반 회원끼리 노출되지 않는다.
- [ ] 커뮤니티 폴더/글/댓글/좋아요가 된다.
- [ ] 첨부파일 최대 2개·파일당 6MB 제한이 동작한다.
- [ ] 사진 첨부가 본문보다 먼저 표시된다.
- [ ] 공지와 공지 이미지가 표시된다.
- [ ] 관리자 화면과 회원 화면의 권한 분리가 유지된다.

## 선택 통합

- [ ] Google Calendar 사용 시 Production callback URI를 등록했다.
- [ ] 관리자 설정에서 Google 계정을 연결하고 운영 Calendar를 선택했다.
- [ ] 심방 일정 생성/수정/취소가 실제 Calendar와 동기화된다.
- [ ] 심방 요청 이유가 Google Calendar 설명에 포함되지 않는다.

## 브랜딩

- [ ] 공동체 이름/PWA 이름을 결정했다.
- [ ] 필요하면 `56사랑`, `56공동체`, 성구, 아이콘을 교체했다.
- [ ] `npm test`, `npm run lint`, `npm run build`가 성공한다.
- [ ] 모바일에서 홈 화면 설치 이름과 아이콘을 확인했다.

모든 항목을 확인한 뒤 실제 사용자를 초대합니다.
