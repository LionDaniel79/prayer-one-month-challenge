# 56love 주소 전환

목표 주소는 `https://56love.vercel.app`입니다. 현재 이 주소가 이 프로젝트에 연결됐다는 뜻은 아닙니다.

## 코드와 주소는 별개
앱의 로그인·게시판·목양지·심방 API 및 파일 링크는 `/api/...`와 같은 상대 경로를 사용합니다. URL을 바꾸려고 기존 GitHub 저장소명, Supabase 프로젝트 ID, DB 스키마, 세션 비밀값 및 Google 토큰 암호화 키를 전체 치환하거나 재생성하지 않습니다. 같은 Vercel 프로젝트에 새 도메인을 연결하면 같은 프로그램과 DB를 그대로 사용할 수 있습니다.

## 운영자가 Vercel에서 할 작업
1. 해당 팀 `ditto0310-2413`으로 로그인하고 기존 프로젝트를 엽니다.
2. Project → Settings → Domains에서 `56love.vercel.app` 연결/기존 vercel.app 도메인 편집 가능 여부를 확인합니다. 다른 프로젝트에서 사용 중이면 이 주소를 사용할 수 없습니다. 해당 메뉴가 프로젝트 이름 변경을 요구하면 표시되는 안내를 확인하되 새 프로젝트를 생성하거나 DB를 복제하지 않습니다.
3. 새 주소에서 Production 버전, 로그인, DB 상태, 목양지, 심방을 검증하기 전 기존 도메인을 제거하거나 리디렉션하지 않습니다.
4. Google Cloud의 **기존** OAuth Web Client에 `https://56love.vercel.app/api/admin/google-calendar/callback`을 추가합니다. 기존 callback도 유지합니다. Client ID/Secret/토큰 암호화 키는 바꾸지 않습니다.
5. 검증 후 GitHub repository homepage와 `PUBLIC_APP_URL`을 새 주소로 지정하고 Production Readiness를 실행합니다. 명령 예제·배포 안내의 실제 서비스 URL도 그때 갱신합니다. GitHub 저장소 주소를 바꾸지 않았다면 소스 링크는 그대로입니다.
6. 도메인이 달라지면 이전 도메인 로그인 쿠키를 공유하지 않으므로 새 주소에서 한 번 로그인해야 합니다. 휴대폰에 설치한 기존 PWA 바로가기도 새 주소로 다시 추가합니다.

현재 작업에서는 Vercel 팀 접근 요청이 `403 Not authorized`로 거부되었습니다. 연결이 해당 팀에 재인증되기 전에는 도메인 소유/연결 변경을 실행할 수 없습니다. 따라서 기존 정식 URL을 유지합니다. Vercel 보호 설정을 끄거나 비밀값을 채팅에 보내지 않습니다.

공식 안내:
- https://vercel.com/docs/domains/working-with-domains/add-a-domain
- https://developers.google.com/identity/protocols/oauth2/web-server
