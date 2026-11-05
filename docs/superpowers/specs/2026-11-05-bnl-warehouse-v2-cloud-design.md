# BNL 입출고 앱 v2 — 클라우드 저장·직원 공유 설계

- 작성일: 2026-11-05
- 상태: 사용자 검토 대기
- 이전 버전: `docs/superpowers/specs/2026-11-05-bnl-warehouse-design.md` (v1, 휴대폰 단독)

## 1. 목적과 범위

### 목적
관리자가 PC에서 엑셀을 올리면, 앱을 설치한 직원들(약 20명)의 휴대폰에 즉시 반영되고 알림이 간다.

### 사용자가 정한 사항
| 항목 | 결정 |
|---|---|
| 업로드 | 관리자 1명만 (주로 PC 브라우저) |
| 조회 | 직원 약 20명 + 관리자 |
| 로그인 | 직원: 회사 공용 **6자리 숫자 PIN** (실패 횟수 제한). 관리자: 본인 이메일 + 비밀번호 |
| 데이터 범위 | 전부 클라우드에 저장 (신청자명·MEMO 포함 — 회사 규정상 문제없음을 사용자가 확인) |
| 반영 | 앱이 켜져 있으면 실시간 갱신 + 꺼져 있으면 푸시 알림 |
| 기기 | 안드로이드 우선. 아이폰은 이후 단계 |
| 클라우드 | Supabase (서울 리전, 무료 요금제) |
| 오프라인 | 마지막으로 받은 데이터 조회 유지 (v1과 동일) |
| 전체 삭제 버튼 | 제거 (클라우드 실수 삭제 방지) |

### 범위 밖 (YAGNI)
- 직원 개인 계정, 이메일 초대, 구글 로그인 (공용 PIN 구조를 나중에 교체 가능하게만 분리)
- 아이폰 동작 확인과 아이폰 전용 조정
- 앱 안에서 클라우드 데이터 삭제·수정
- 업로드 이력 화면, 누가 봤는지 기록
- v1 휴대폰 데이터의 클라우드 이전 (v2 첫 업로드로 대체)

## 2. 전체 구조

```
[관리자 PC 브라우저]                 [Supabase 서울]                      [직원 안드로이드 PWA]
 엑셀 해석(v1 parsers 그대로)
  → rpc replace_days ─────────────▶ 트랜잭션: 삭제+삽입+upload_log 1줄
                                    upload_log INSERT ──Realtime──────▶ 동기화: 바뀐 날짜만 받아 로컬 DB 교체
  → functions notify ─────────────▶ Web Push 발송 ─────────────────────▶ 서비스 워커가 알림 표시
                                    functions staff-login ◀─────────── PIN 로그인
                                    functions set-staff-pin ◀── 관리자
```

| 모듈 | v2에서의 역할 |
|---|---|
| `parsers`, 화면(목록·상세·검색·통계) | 변경 없음 |
| `storage/dexieRepository` | 로컬 사본(읽기 모델)으로 유지. 화면은 계속 이것만 읽는다 |
| `storage/cloud` (신규) | Supabase 클라이언트, `replace_days` 호출, 원격 조회 |
| `sync` (신규) | upload_log 기준 따라잡기 + Realtime 구독 |
| `auth` (신규) | 로그인 상태, 역할(admin/staff), 로그아웃 시 로컬 데이터 삭제 |
| `push` (신규) | 알림 권한·구독 등록/해제 |
| 서비스 워커 | 자동 생성(generateSW) → 직접 작성(injectManifest): 오프라인 캐시 + push + notificationclick |
| `supabase/` (신규) | SQL 마이그레이션, Edge Functions (`staff-login`, `set-staff-pin`, `notify`) |

`Repository` 인터페이스는 유지한다. 앱이 쓰는 구현은 "읽기 = 로컬 Dexie, `replaceDays` = 클라우드 RPC"로 조합한다(`CloudRepository`).

## 3. 클라우드 데이터 모델 (PostgreSQL)

### 3.1 표
```sql
inbound (
  id text primary key,            -- v1과 같은 `${port}|${baseDate}|${n}`
  port text not null check (port in ('북항','신항')),
  base_date date not null,
  arrival_date date, vessel text, bl text not null, item text,
  qty numeric, weight_kg numeric, cbm numeric, hull text, po text, terminal text,
  containers jsonb not null default '[]',   -- [{no, type}]
  destination text, note text,
  raw jsonb not null default '{}'
)  -- index (port, base_date)

outbound (
  id text primary key,            -- `출고|${baseDate}|${n}`
  base_date date not null,
  seq numeric, center text, bnl_in_date date, bl text, hull text, po text, item text,
  qty_text text, qty_requested numeric, qty_total numeric, weight_kg numeric, cbm numeric,
  box_no text, destination text, gate_time text, memo text, inspected_date date,
  requester text, arrive_date date, location text, same_day boolean not null,
  raw jsonb not null default '{}'
)  -- index (base_date)

upload_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('입고-북항','입고-신항','출고')),
  base_dates date[] not null,
  file_name text, row_count int not null
)

push_subscriptions (
  endpoint text primary key,
  p256dh text not null, auth text not null,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
)

staff_pin (            -- 1행만
  id int primary key check (id = 1),
  pin_hash text not null, updated_at timestamptz not null default now()
)

login_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
)
```
레코드 필드는 v1 `Inbound`/`Outbound`와 1:1이다(camelCase ↔ snake_case 변환은 `storage/cloud`의 매퍼 한 곳에서).

### 3.2 `replace_days(kind text, base_dates date[], rows jsonb, file_name text) returns bigint`
- `security definer`. 시작 시 `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'` 확인, 아니면 예외.
- 한 트랜잭션에서: 해당 종류(입고는 port 포함)·날짜 행 삭제 → `rows` 삽입 → `upload_log` 1행 삽입 → 그 id 반환.
- 예외 시 전체 롤백 (직원에게 반쯤 바뀐 데이터가 보이지 않음).

### 3.3 권한 (Row Level Security, 모든 표 RLS 켬)
| 표 | staff | admin | 비로그인 |
|---|---|---|---|
| inbound, outbound, upload_log | select | select | 없음 |
| 위 표 쓰기 | 없음 (정책 없음) | `replace_days`로만 | 없음 |
| push_subscriptions | 본인(`user_id = auth.uid()`) insert/delete | 동일 | 없음 |
| staff_pin, login_failures | 없음 (Edge Function의 service role만) | 없음 | 없음 |

역할은 `auth.users.raw_app_meta_data.role`(사용자가 바꿀 수 없음)에 `admin` / `staff`로 둔다. Supabase 설정에서 **회원가입 비활성화**.

## 4. 로그인과 계정

### 4.1 계정
- admin: 관리자 이메일 + 개인 비밀번호. 역할 `admin`.
- staff: 고정 내부 이메일(예: `staff@bnl.internal`) + **긴 무작위 내부 비밀번호**(Edge Function 비밀 값 `STAFF_PASSWORD`로만 존재). 역할 `staff`. 직원은 이 비밀번호를 모른다.

### 4.2 직원 PIN 로그인 — Edge Function `staff-login`
입력 `{ pin }`:
1. `login_failures`에서 최근 15분 실패 수가 **20 이상**이면 `423 { error: 'locked' }`.
2. `pin`이 6자리 숫자가 아니면 실패 처리.
3. `staff_pin.pin_hash`와 비교(해시 비교, PIN 원문 저장 안 함).
4. 틀리면 `login_failures`에 1행 추가 후 `401`.
5. 맞으면 service role로 staff 계정에 `signInWithPassword(staff 이메일, STAFF_PASSWORD)` → 세션(access/refresh token)을 응답. 클라이언트는 `supabase.auth.setSession`.

화면 문구: 틀림 `PIN이 맞지 않아요`, 잠김 `잠시 후 다시 시도해 주세요 (약 15분)`.

### 4.3 관리자 로그인
로그인 화면의 `관리자 로그인 ›` → 이메일 + 비밀번호 → `supabase.auth.signInWithPassword`.

### 4.4 직원 PIN 변경 — Edge Function `set-staff-pin`
입력 `{ pin }` (6자리 숫자). 호출자 JWT의 역할이 admin인지 확인 후 한 번에:
1. `staff_pin.pin_hash` 갱신
2. staff 계정의 모든 세션 무효화(refresh token 삭제) → 기존 access token 만료(최대 1시간) 후 직원 앱은 로그인 화면으로
3. staff 사용자의 `push_subscriptions` 삭제

### 4.5 로그아웃·세션 만료
로그아웃하거나 세션 갱신이 실패(무효화)하면: 로컬 IndexedDB 입출고 데이터와 동기화 상태를 **삭제**하고, 이 폰의 푸시 구독을 해제한 뒤 로그인 화면으로. (오프라인 상태로 계속 머무는 폰은 무효화를 받지 못함 — 오프라인 조회와의 절충으로 수용)

## 5. 동기화 (`sync`)

로컬 Dexie에 `meta` 표 추가: `lastLogId: number`, `lastSyncedAt: string`.

```
syncOnce():
  if lastLogId == 0:                       # 첫 로그인
     전체 inbound/outbound 내려받기 → 로컬 전체 교체
     lastLogId = max(upload_log.id) (없으면 0)
  else:
     logs = upload_log where id > lastLogId order by id
     종류별로 바뀐 날짜 합집합 → 그 종류·날짜 행만 원격 조회 → 로컬 replaceDays
     lastLogId = max(logs.id)
  lastSyncedAt = now
```
- 실행 시점: 로그인 직후, 앱 시작, `visibilitychange`(화면 복귀), `online` 이벤트, Realtime `upload_log` INSERT 수신.
- 동시에 두 번 돌지 않게 직렬화(실행 중이면 끝난 뒤 한 번 더).
- 원격 조회는 페이지 단위(1000행)로 끝까지.
- 실패 시 로컬 데이터는 그대로 두고 상태만 `오프라인`/`동기화 실패`로 표시. 다음 시점에 재시도.
- 동기화가 끝나면 화면에 알려 목록·검색·통계가 다시 읽는다(v1의 `dataVersion` 사용).

목록 화면 상단 상태 줄: `최신 · 14:02 동기화` / `동기화 중…` / `오프라인 · 마지막 동기화 11.6 09:10`.

## 6. 업로드 (관리자)

- 올리기 탭은 역할이 admin일 때만 보인다.
- v1 `importFiles` 흐름 그대로. `repo.replaceDays`가 `CloudRepository`에서 `rpc('replace_days', …)` 호출.
- 업로드 결과에 반영된 종류가 하나 이상이면 `functions.invoke('notify', { summary })` 호출. 실패해도 업로드는 성공으로 두고 `⚠️ 알림을 보내지 못했어요` 한 줄 추가.
- 관리자 기기도 Realtime으로 자신의 업로드를 받아 로컬에 반영.
- v1의 `[전체 데이터 삭제]` 버튼 제거.
- 관리자 화면(올리기 탭 아래)에 `[직원 PIN 변경]`: 6자리 입력 두 번(확인) → `set-staff-pin`.

## 7. 푸시 알림 (`push`, `notify`)

- 표준 Web Push + VAPID. 공개 키는 빌드 변수, 비밀 키는 Edge Function 비밀 값.
- 로그인 후 알림 권한이 `default`이면 목록 위 카드 `🔔 새 입출고 알림 받기` → 탭 → `Notification.requestPermission()` → `pushManager.subscribe` → `push_subscriptions` upsert. 거부되면 카드 숨김.
- 설정 위치: 목록 상단 메뉴에 `알림 끄기/켜기`, `로그아웃`.
- `notify` (admin만 호출 가능): 모든 구독에 발송. 응답 404/410인 구독은 삭제.
  - 제목 `BNL 입출고`, 본문 예 `11.6 입출고가 올라왔어요 — 입고 3 · 출고 28 (당일착 2)` (가장 최근 기준일 기준 건수). 이름·전화번호 등 개인정보는 넣지 않는다.
  - `tag: 'bnl-upload'`로 같은 알림을 덮어쓴다.
  - `data.url = '<앱 경로>?date=YYYY-MM-DD'` → 알림 탭 시 그 날짜 목록을 연다(앱이 열려 있으면 그 창을 포커스).

## 8. 설정 값과 비밀

| 값 | 위치 | 공개 여부 |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` | 로컬 `.env.local`(git 제외), GitHub 저장소 Variables | 공개돼도 됨 (RLS로 보호) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 기본 제공 (Edge Function 내부) | 비밀 |
| `STAFF_PASSWORD`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Supabase Edge Function secrets | 비밀 |
| 관리자 비밀번호, 직원 PIN | 사용자가 직접 입력 (채팅·저장소에 기록 금지) | 비밀 |

## 9. 오류 처리

| 상황 | 동작 |
|---|---|
| 오프라인에서 업로드 | `인터넷 연결이 필요해요` — 파일 해석도 하지 않음 |
| `replace_days` 실패 | 해당 파일 `❌ 저장하지 못했어요 (…)`, 클라우드는 롤백 |
| `notify` 실패 | 업로드는 성공, `⚠️ 알림을 보내지 못했어요` |
| 동기화 실패 | 로컬 데이터 유지, 상태 줄에 표시, 다음 시점 재시도 |
| 세션 무효화(PIN 변경) | 로컬 데이터 삭제 후 로그인 화면 |
| PIN 잠금 | `잠시 후 다시 시도해 주세요 (약 15분)` |
| Realtime 연결 끊김 | 재연결은 라이브러리에 맡기고, 재연결·화면 복귀 시 `syncOnce` |

## 10. 테스트

| 대상 | 방법 |
|---|---|
| v1 기존 테스트 | 그대로 통과 |
| `sync` (첫 동기화, 따라잡기, 바뀐 날짜만, 실패 시 로컬 유지, 직렬화) | 가짜 원격(인메모리) + fake-indexeddb 단위 테스트 |
| 레코드 ↔ DB 행 매퍼 | 왕복 변환 단위 테스트 (픽스처 전체) |
| PIN 잠금 판정, 알림 문구 | 순수 함수 단위 테스트 |
| RLS·`replace_days`·Edge Functions | 개발용 Supabase 프로젝트에서 검증 스크립트: 비로그인 읽기 0건, staff 쓰기 거부, admin `replace_days` 성공·롤백, PIN 틀림/잠김/성공, PIN 변경 후 staff refresh 실패 |
| 실시간·푸시 | PC(관리자) + 안드로이드(직원) 실기기 확인 |

## 11. 배포와 준비 (사용자 작업 포함)

1. Supabase 가입, 프로젝트 생성(리전 Seoul). 처음에는 프로젝트 1개로 시작한다(개발·운영 분리는 범위 밖, 필요 시 추가).
2. 터미널에서 Supabase CLI 로그인(사용자) → 마이그레이션 적용, Edge Functions 배포, secrets 설정.
3. 관리자·staff 계정 생성과 역할 지정, 초기 PIN 설정(사용자가 직접 입력).
4. GitHub 저장소 Variables에 공개 설정 값 등록 → 워크플로가 빌드 시 주입.
5. v2 배포 후 관리자가 최신 엑셀 3개를 한 번 업로드(누적 파일로 지난 날짜 채움).
6. 직원 안내: 앱 주소, 설치 방법, PIN.

## 12. 이후 확장 (범위 밖)
아이폰 확인(홈 화면 설치 시 Web Push 지원), 직원 개인 계정(이메일 초대)으로 `auth` 교체, 업로드 이력 화면, 개발/운영 프로젝트 분리.
