# 운영 절차 (v2 클라우드)

비밀 값(관리자 비밀번호, 직원 PIN, VAPID 비밀 키, service role 키)은 이 문서·저장소·채팅에 쓰지 않는다.
명령은 저장소 폴더에서 **터미널 앱**으로 실행한다. 프로젝트는 `npx supabase link`로 연결되어 있어야 한다.

## 구성

| 항목 | 위치 |
|---|---|
| 앱 공개 설정 (URL, publishable 키, VAPID 공개 키) | `.env.local`(git 제외), GitHub Actions Variables `VITE_*` |
| 계정 | Supabase › Authentication › Users — 관리자 1명(`role=admin`), 직원 개인 계정(`role=staff`, 직원 탭에서 만듦) |
| 역할 | `auth.users.raw_app_meta_data.role` (사용자가 바꿀 수 없음) |
| 서버 비밀 값 | `npx supabase secrets list --remote` — `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| DB 구조 | `supabase/migrations/` |
| 서버 함수 | `supabase/functions/` — `staff-login`(로그인 전 호출, JWT 검사 끔), `staff-accounts`(직원 계정), `notify`, `holidays`(구글 공휴일 캘린더 중계) |

## 직원 계정·권한

관리자로 앱 로그인 › **직원** 탭에서 직원마다 계정(이름·아이디·개인 PIN)을 만들고 권한(컨테이너 상태 변경·휴가 달력 편집)을 켠다. 권한이 없으면 보기만 한다. 권한은 표(`staff_accounts`)에서 읽어 바로 적용된다. 개인 PIN을 바꾸면 그 폰은 1시간 안에 로그아웃되고, 계정을 지우면 알림 구독도 함께 지워진다. 계정 비밀번호는 아무도 모르는 난수라 로그인은 `staff-login`으로만 된다.

로그인이 15분 동안 20번 틀리면 모두 15분간 잠긴다. 기다리면 풀린다.

## 관리자 비밀번호 변경

Supabase › Authentication › Users › 관리자 › **Send password recovery**, 또는 같은 화면에서 직접 변경.

## 알림(VAPID) 키 교체

키를 바꾸면 모든 폰의 알림 구독이 무효가 된다(각자 알림 다시 켜기).

1. `npx -y web-push@3.6.7 generate-vapid-keys --json > vapid.local` (출력을 화면에 띄우지 않는다)
2. 공개 키 → `.env.local`의 `VITE_VAPID_PUBLIC_KEY`와 GitHub Variables, 그리고 `VAPID_PUBLIC_KEY` 비밀 값. 비밀 키 → `VAPID_PRIVATE_KEY` 비밀 값
3. 앱 재배포, `rm vapid.local`

## DB 구조 변경 · 함수 재배포

```bash
npx supabase migration new <이름>     # supabase/migrations/ 에 SQL 작성
npx supabase db push --remote
npx supabase functions deploy staff-login staff-accounts notify holidays --use-api --remote
```

## 점검

`scripts/verify-cloud.mjs` — 권한·PIN·업로드 롤백·실시간·알림 권한을 원격 프로젝트에 대해 확인한다(사용법은 스크립트 머리말).
