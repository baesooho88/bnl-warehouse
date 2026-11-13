# 운영 절차 (v2 클라우드)

비밀 값(관리자 비밀번호, 직원 PIN, 직원 계정 비밀번호, VAPID 비밀 키, service role 키)은 이 문서·저장소·채팅에 쓰지 않는다.
명령은 저장소 폴더에서 **터미널 앱**으로 실행한다. 프로젝트는 `npx supabase link`로 연결되어 있어야 한다.

## 구성

| 항목 | 위치 |
|---|---|
| 앱 공개 설정 (URL, publishable 키, VAPID 공개 키) | `.env.local`(git 제외), GitHub Actions Variables `VITE_*` |
| 계정 | Supabase › Authentication › Users — 관리자 1명(`role=admin`), 직원 공용 1개(`role=staff`) |
| 역할 | `auth.users.raw_app_meta_data.role` (사용자가 바꿀 수 없음) |
| 서버 비밀 값 | `npx supabase secrets list --remote` — `STAFF_EMAIL`, `STAFF_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| DB 구조 | `supabase/migrations/` |
| 서버 함수 | `supabase/functions/` — `staff-login`(로그인 전 호출, JWT 검사 끔), `set-staff-pin`, `notify`, `holidays`(구글 공휴일 캘린더 중계) |

## 직원 PIN 변경

관리자로 앱 로그인 › **올리기** 탭 › **직원 PIN 변경**. 바꾸면 직원 폰은 1시간 안에 로그아웃되고 알림 구독도 지워진다(새 PIN으로 다시 로그인 → 알림 다시 켜기).

PIN 로그인이 15분 동안 20번 틀리면 모두 15분간 잠긴다. 기다리면 풀린다.

## 관리자 비밀번호 변경

Supabase › Authentication › Users › 관리자 › **Send password recovery**, 또는 같은 화면에서 직접 변경.

## 직원 계정 비밀번호 교체

직원은 이 비밀번호를 모른다(서버 함수만 사용). 유출이 의심될 때만 바꾼다. 새 값을 계정과 `STAFF_PASSWORD` 비밀 값 **둘 다**에 넣어야 하며, 둘이 다르면 PIN 로그인이 전부 실패한다.

1. 새 비밀번호를 git 제외 임시 파일에 만든다: `openssl rand -base64 36 | tr -d '\n/+=' > .staff-password.local`
2. 계정에 적용: Supabase › Authentication › Users › 직원 계정에서 비밀번호 변경(파일 내용을 `pbcopy < .staff-password.local`로 복사해 붙여 넣기)
3. 서버에 적용: `npx supabase secrets set --remote STAFF_PASSWORD="$(cat .staff-password.local)"`
4. `rm .staff-password.local`

직원 계정 이메일을 바꾸면 `STAFF_EMAIL` 비밀 값도 같은 값으로 바꾼다.

## 알림(VAPID) 키 교체

키를 바꾸면 모든 폰의 알림 구독이 무효가 된다(각자 알림 다시 켜기).

1. `npx -y web-push@3.6.7 generate-vapid-keys --json > vapid.local` (출력을 화면에 띄우지 않는다)
2. 공개 키 → `.env.local`의 `VITE_VAPID_PUBLIC_KEY`와 GitHub Variables, 그리고 `VAPID_PUBLIC_KEY` 비밀 값. 비밀 키 → `VAPID_PRIVATE_KEY` 비밀 값
3. 앱 재배포, `rm vapid.local`

## DB 구조 변경 · 함수 재배포

```bash
npx supabase migration new <이름>     # supabase/migrations/ 에 SQL 작성
npx supabase db push --remote
npx supabase functions deploy staff-login set-staff-pin notify holidays --use-api --remote
```

## 점검

`scripts/verify-cloud.mjs` — 권한·PIN·업로드 롤백·실시간·알림 권한을 원격 프로젝트에 대해 확인한다(사용법은 스크립트 머리말).
