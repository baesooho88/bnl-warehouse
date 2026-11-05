# BNL 입출고 v2 (클라우드·직원 공유) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 PC에서 올린 입출고 엑셀이 Supabase에 저장되고, PIN으로 로그인한 직원 안드로이드 앱에 실시간 반영·푸시 알림되게 한다.

**Architecture:** v1의 parsers·화면·로컬 Dexie 저장소는 그대로 두고, 로컬 저장소를 "클라우드 사본"으로 쓴다. `Remote` 인터페이스(Supabase 구현) + `sync` 엔진이 `upload_log` 기준으로 바뀐 날짜만 따라잡는다. 쓰기는 `replace_days` RPC(관리자 전용, 트랜잭션), 로그인은 Edge Function `staff-login`(PIN·잠금)·Supabase Auth, 알림은 Web Push(Edge Function `notify` + 직접 작성 서비스 워커).

**Tech Stack:** 기존(React 19, Vite 8, TS 7, Dexie 4, SheetJS 0.20.3, Vitest 5) + `@supabase/supabase-js` 2.x, Supabase CLI 3.x(`npx supabase`), Edge Functions(Deno, `npm:web-push@3.6.7`), vite-plugin-pwa `injectManifest`, `workbox-precaching`.

**Spec:** `docs/superpowers/specs/2026-11-05-bnl-warehouse-v2-cloud-design.md` (v1 스펙: `docs/superpowers/specs/2026-11-05-bnl-warehouse-design.md`)

## Global Constraints

- 비밀 값(서비스 키, `STAFF_PASSWORD`, `VAPID_PRIVATE_KEY`, 관리자 비밀번호, PIN)은 저장소·채팅·로그에 절대 쓰지 않는다. 공개 설정은 `.env.local`(git 제외됨)과 GitHub Variables에만.
- 원본 엑셀(`source/`) 값은 문서·테스트에 옮기지 않는다. 테스트 자료 재생성은 `npm run fixtures`(git 대상 전체 검사 포함).
- Supabase 리전 Seoul. 이 환경에는 Docker·Deno가 없다 → 로컬 Supabase 불가, 원격 프로젝트 + `functions deploy --use-api`.
- v1 테스트 전부 계속 통과. 화면 컴포넌트·parsers는 수정 최소.
- 역할 판정은 `app_metadata.role`(`admin`|`staff`)만 사용.
- 직원 PIN: 정확히 6자리 숫자. 잠금: 최근 15분 실패 20회 이상.
- 날짜는 `YYYY-MM-DD` 문자열(로컬·원격 모두, DB는 `date` 타입).
- 알림 본문에 이름·전화번호를 넣지 않는다.
- 모든 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 사용자 작업이 필요한 단계(Supabase 가입·CLI 로그인·비밀 입력·GitHub 설정·push)는 해당 단계에서 멈추고 안내한다.

## Review Focus

1. **직원 폰이 오프라인인 동안 업로드가 여러 번** → 다시 연결되면 빠진 업로드 기록을 모두 따라잡아야 한다. (Task 3 테스트)
2. **동기화 중에 실시간 이벤트가 또 옴**(연속 업로드) → 동시에 두 번 돌지 않고, 끝난 뒤 한 번 더 돌아 마지막 변경까지 반영. (Task 3 테스트)
3. **첫 동기화 데이터가 1000행 초과** → 페이지 단위로 끝까지 받아야 한다. (Task 2 계약 테스트 + Task 3)
4. **PIN 변경으로 세션 무효화** → 직원 앱은 로컬 데이터를 지우고 로그인 화면으로. (Task 4 테스트 + Task 10 실기기)
5. **관리자가 오프라인에서 업로드** → 해석 전에 막고 `인터넷 연결이 필요해요`. (Task 7 테스트)

---

## File Structure

```
src/storage/cloud/mapper.ts        # Inbound/Outbound ↔ DB 행(snake_case)
src/storage/cloud/remote.ts        # Remote 인터페이스 + createSupabaseRemote(client)
src/storage/cloud/supabase.ts      # createClient (env), 앱 전역 supabase 인스턴스
src/storage/dexieRepository.ts     # (수정) meta 표, LocalRepository 확장
src/storage/cloudRepository.ts     # 읽기=로컬, replaceDays=원격→로컬
src/sync/sync.ts                   # createSync({local, remote}) — syncOnce, 직렬화
src/auth/auth.ts                   # roleOf, isValidPin, staffLogin, adminLogin, logout
src/push/push.ts                   # 구독/해제
src/sw.ts                          # 직접 작성 서비스 워커 (precache + push + notificationclick)
src/screens/LoginScreen.tsx, src/components/StatusBar.tsx, src/components/PushCard.tsx, src/screens/AdminPanel.tsx
supabase/config.toml, supabase/migrations/20261105000000_init.sql
supabase/functions/_shared/pin.ts, _shared/notifyText.ts, _shared/admin.ts
supabase/functions/staff-login/index.ts, set-staff-pin/index.ts, notify/index.ts
scripts/verify-cloud.mjs           # 원격 권한·함수 검증 (비밀 값은 환경 변수로만)
tests/mapper.test.ts, remote.contract.test.ts, sync.test.ts, cloudRepository.test.ts,
tests/auth.test.ts, pin.test.ts, notifyText.test.ts, upload.test.ts
tests/helpers/fakeRemote.ts
```

---

### Task 1: 레코드 ↔ DB 행 매퍼와 Supabase 클라이언트

**Files:**
- Create: `src/storage/cloud/mapper.ts`, `src/storage/cloud/supabase.ts`, `.env.example`
- Test: `tests/mapper.test.ts`

**Interfaces:**
- Produces: `toInboundRow(x: Inbound): InboundRow`, `fromInboundRow(r: InboundRow): Inbound`, `toOutboundRow`, `fromOutboundRow`, 타입 `InboundRow`/`OutboundRow`(스펙 3.1 열 이름 그대로, 숫자는 `number|null`, 날짜는 `string|null`, `containers`/`raw`는 객체).
- Produces: `src/storage/cloud/supabase.ts` — `export const supabase` (`createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })`), `export const cloudConfigured: boolean`(두 값이 모두 있을 때).
- `.env.example`: `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`, `VITE_VAPID_PUBLIC_KEY=` (값 비움).

- [ ] **Step 1:** `npm i @supabase/supabase-js` 및 `npm i -D supabase@3`
- [ ] **Step 2: 실패하는 테스트** — 세 픽스처(`parseWorkbook`)의 모든 입고·출고 레코드에 대해 `fromXRow(toXRow(x))`가 `x`와 `toEqual`; `toInboundRow`의 키가 `base_date`, `weight_kg`, `containers` 등 snake_case이고 camelCase 키가 없음; `fromOutboundRow`에 `qty_requested: null`이 오면 `qtyRequested: null`
- [ ] **Step 3:** `npx vitest run tests/mapper.test.ts` → FAIL → 구현 → PASS
- [ ] **Step 4: Commit** — `feat(v2): 레코드↔DB 행 매퍼와 Supabase 클라이언트`

---

### Task 2: Remote 인터페이스, 가짜 원격, Supabase 구현

**Files:**
- Create: `src/storage/cloud/remote.ts`, `tests/helpers/fakeRemote.ts`
- Test: `tests/remote.contract.test.ts`

**Interfaces:**
```ts
export interface UploadLog { id: number; kind: Kind; baseDates: string[]; createdAt: string }
export interface Remote {
  fetchAll(): Promise<{ inbound: Inbound[]; outbound: Outbound[]; maxLogId: number }>
  fetchLogsAfter(id: number): Promise<UploadLog[]>               // id 오름차순
  fetchDays(kind: Kind, baseDates: string[]): Promise<{ inbound: Inbound[]; outbound: Outbound[] }>
  replaceDays(kind: Kind, baseDates: string[], inbound: Inbound[], outbound: Outbound[], fileName: string): Promise<number> // 새 log id
  onNewLog(cb: () => void): () => void                           // 구독 해제 함수 반환
}
export const PAGE = 1000
export function createSupabaseRemote(client: SupabaseClient): Remote
```
- Supabase 구현: 조회는 `.range(from, from+PAGE-1)`를 빈 페이지까지 반복; `fetchDays`는 입고면 `.eq('port', …).in('base_date', dates)`; `replaceDays`는 `rpc('replace_days', { kind, base_dates, rows, file_name })`(rows는 매퍼로 변환), 오류면 `throw new Error(error.message)`; `onNewLog`는 `channel('upload_log').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'upload_log' }, cb).subscribe()`.
- `createFakeRemote()`: 위 인터페이스의 인메모리 구현 + 테스트용 `failNext(method)`, `emitNewLog()`, `calls` 기록, 페이지 크기 PAGE로 잘라 반환하는 내부 동작(페이징 검증용 `pagesServed` 카운터).

- [ ] **Step 1: 실패하는 계약 테스트 (fake 대상)** — `replaceDays('입고-신항', ['2026-11-05'], …)` 후 `fetchLogsAfter(0)`이 `[{id:1, kind:'입고-신항', baseDates:['2026-11-05']}]`; 같은 날 다시 교체하면 행 수 그대로; 2500행 넣은 뒤 `fetchAll()`이 2500행 전부 + `pagesServed ≥ 3`; `fetchDays('입고-북항', …)`는 신항 행을 포함하지 않음
- [ ] **Step 2:** FAIL → `remote.ts`(인터페이스·Supabase 구현) + `fakeRemote.ts` → PASS. Supabase 구현은 타입 검사(`npx tsc -b`)만 여기서, 동작은 Task 9에서 검증.
- [ ] **Step 3: Commit** — `feat(v2): Remote 인터페이스와 가짜·Supabase 구현`

---

### Task 3: 로컬 메타 저장과 동기화 엔진

**Files:**
- Modify: `src/storage/dexieRepository.ts` (Dexie `version(2)`에 `meta: 'key'` 추가)
- Create: `src/sync/sync.ts`
- Test: `tests/sync.test.ts`

**Interfaces:**
- `dexieRepository.ts`: `export interface LocalRepository extends Repository { getSyncState(): Promise<{ lastLogId: number; lastSyncedAt: string | null }>; setSyncState(s): Promise<void> }`, `createDexieRepository(dbName?): LocalRepository`. `clearAll()`은 meta도 비운다.
- `sync.ts`:
```ts
export type SyncStatus = { state: 'idle' | 'syncing' | 'error'; lastSyncedAt: string | null; error?: string }
export function createSync(deps: { local: LocalRepository; remote: Remote; now?: () => Date }): {
  syncOnce(): Promise<void>            // 직렬화: 실행 중 호출되면 끝난 뒤 정확히 한 번 더
  status(): SyncStatus
  onChange(cb: (s: SyncStatus) => void): () => void   // 상태 변화·데이터 반영 시 호출
}
```
  알고리즘은 스펙 5장 그대로. 첫 동기화(`lastLogId===0`)는 `local.clearAll()` 후 종류·날짜별 `replaceDays`로 채운다. 실패 시 로컬·`lastLogId` 변경 없음, `state:'error'`.

- [ ] **Step 1: 실패하는 테스트** (fake-indexeddb + fakeRemote)
  - 첫 동기화: 원격 3종 픽스처 → 로컬 `getRange('2026-11-01','2026-11-30')` 건수 = 원격 건수, `lastLogId` = 원격 최대 id
  - 따라잡기 (Review Focus 1): 첫 동기화 후 원격에 업로드 3회(서로 다른 날짜) → `syncOnce()` 한 번에 3건 모두 반영, `fetchDays` 호출은 종류별 1회
  - 바뀐 날짜만: 따라잡기에서 `fetchAll`이 다시 불리지 않음
  - 실패: `failNext('fetchDays')` → `syncOnce()` 후 로컬 기존 데이터·`lastLogId` 그대로, `status().state==='error'`; 다음 `syncOnce()`에서 반영
  - 직렬화 (Review Focus 2): `syncOnce()` 진행 중 두 번 더 호출 → `fetchLogsAfter` 총 2회, 마지막 업로드까지 반영
  - 페이징 (Review Focus 3): 원격 2500행 첫 동기화 → 로컬 2500행
- [ ] **Step 2:** FAIL → 구현 → PASS. `npm test` 전체 → PASS(v1 테스트 포함)
- [ ] **Step 3: Commit** — `feat(v2): 로컬 동기화 상태와 동기화 엔진`

---

### Task 4: 클라우드 저장소 조합과 인증 모듈

**Files:**
- Create: `src/storage/cloudRepository.ts`, `src/auth/auth.ts`
- Test: `tests/cloudRepository.test.ts`, `tests/auth.test.ts`

**Interfaces:**
- `createCloudRepository(local: LocalRepository, remote: Remote, fileName: () => string): Repository` — 읽기 메서드는 `local` 위임, `replaceDays`는 `remote.replaceDays(…)` 성공 후 `local.replaceDays(…)`. 원격 실패면 throw, 로컬 변경 없음. `clearAll`은 로컬만.
  - 업로드 파일명 전달: `importFiles`는 바꾸지 않는다. 대신 `UploadScreen`이 파일마다 `currentFileName`을 설정(클로저)하도록 `fileName` 콜백을 받는다.
- `auth.ts`:
```ts
export type Role = 'admin' | 'staff' | null
export function roleOf(session: Session | null): Role          // app_metadata.role
export function isValidPin(pin: string): boolean                // /^\d{6}$/
export async function staffLogin(client, pin): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'locked' | 'network' }>
export async function adminLogin(client, email, password): Promise<{ ok: boolean }>
export function watchAuth(client, onSignedOut: () => Promise<void>, onChange: (role: Role) => void): () => void
export async function logout(client, onSignedOut): Promise<void>
```
  `staffLogin`: `functions.invoke('staff-login', { body: { pin } })` → 성공 시 `auth.setSession(data)`; HTTP 401 → invalid, 423 → locked, 그 외 → network. `watchAuth`: `onAuthStateChange`에서 `SIGNED_OUT`(무효화 포함)이면 `onSignedOut()`(로컬 데이터 삭제·푸시 해제 — App이 주입).

- [ ] **Step 1: 실패하는 테스트**
  - cloudRepository: fakeRemote + 로컬 → `replaceDays` 후 원격과 로컬 모두 반영; `failNext('replaceDays')` → reject, 로컬 기존 데이터 그대로
  - auth: `roleOf`가 `app_metadata.role` 'admin'/'staff'/없음 → 'admin'/'staff'/null, `user_metadata.role='admin'`만 있으면 null(사용자 수정 가능 칸은 무시); `isValidPin('012345')` true, `'12345'`·`'12345a'`·`'1234567'` false; `staffLogin`에 가짜 client(`functions.invoke`가 401/423/네트워크 오류/성공 반환) → reason 매핑과 성공 시 `setSession` 호출; `watchAuth`에 `SIGNED_OUT` 이벤트 주입 → `onSignedOut` 1회 (Review Focus 4)
- [ ] **Step 2:** FAIL → 구현 → PASS
- [ ] **Step 3: Commit** — `feat(v2): 클라우드 저장소 조합과 인증 모듈`

---

### Task 5: DB 마이그레이션과 Edge Functions(PIN 로그인·PIN 변경)

**Files:**
- Create: `supabase/config.toml`(`npx supabase init`로 생성), `supabase/migrations/20261105000000_init.sql`, `supabase/functions/_shared/pin.ts`, `supabase/functions/_shared/admin.ts`, `supabase/functions/staff-login/index.ts`, `supabase/functions/set-staff-pin/index.ts`
- Test: `tests/pin.test.ts`

**Interfaces:**
- 마이그레이션: 스펙 3.1의 표·인덱스, 모든 표 `enable row level security`, 스펙 3.3 정책, `replace_days`(스펙 3.2, `security definer`, `set search_path = public`), `revoke_staff_sessions(staff_id uuid)`(`security definer`: `delete from auth.refresh_tokens where user_id = staff_id::text; delete from auth.sessions where user_id = staff_id;` — `service_role`에만 `grant execute`), `upload_log`를 `supabase_realtime` publication에 추가.
- `_shared/pin.ts` (외부 import 없음 — Node·Deno 공용):
  - `export const LOCK_WINDOW_MIN = 15, LOCK_THRESHOLD = 20`
  - `isLocked(recentFailures: number): boolean` (≥20)
  - `hashPin(pin: string, salt?: string): Promise<string>` — Web Crypto PBKDF2-SHA256 100000회, 결과 `pbkdf2$<salt hex>$<hash hex>`
  - `verifyPin(pin: string, stored: string): Promise<boolean>` — 같은 salt로 재계산, 길이 같은 바이트 비교
- `_shared/admin.ts`: `requireAdmin(req): Promise<{ userId } | Response>` — Authorization JWT로 `getUser`, `app_metadata.role==='admin'` 아니면 403 Response.
- `staff-login`: 스펙 4.2 그대로. 성공 응답 `{ access_token, refresh_token }`. 환경 변수 `STAFF_EMAIL`, `STAFF_PASSWORD`.
- `set-staff-pin`: 스펙 4.4 그대로(`requireAdmin` → `isValidPin` 동등 검사 → `staff_pin` upsert(hashPin) → staff 사용자 id 조회(`STAFF_EMAIL`) → `rpc('revoke_staff_sessions')` → `push_subscriptions` 삭제(user_id=staff)).
- 모든 함수: CORS 허용(`OPTIONS` 처리), 응답 JSON.

- [ ] **Step 1: 실패하는 테스트 (`_shared/pin.ts`)** — `isLocked(19)` false, `isLocked(20)` true; `verifyPin('123456', await hashPin('123456'))` true, `'123457'` false; 같은 PIN 두 번 해시 → 문자열 다름(salt), 둘 다 검증 통과; 형식이 깨진 stored → false
- [ ] **Step 2:** FAIL → 구현 → PASS
- [ ] **Step 3:** 마이그레이션 SQL과 두 함수 작성. 확인: `npx tsc -b`(앱) 통과, SQL은 Task 9에서 원격 적용으로 검증
- [ ] **Step 4: Commit** — `feat(v2): DB 마이그레이션과 PIN 로그인·변경 함수`

---

### Task 6: 푸시 — 서비스 워커, 구독, notify 함수

**Files:**
- Create: `src/sw.ts`, `src/push/push.ts`, `supabase/functions/_shared/notifyText.ts`, `supabase/functions/notify/index.ts`
- Modify: `vite.config.ts` (`strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts'`), `package.json`(`workbox-precaching`)
- Test: `tests/notifyText.test.ts`

**Interfaces:**
- `notifyText.ts`: `buildMessage(s: { date: string; inbound: number; outbound: number; sameDay: number }): { title: string; body: string; tag: string; url: string }` — title `BNL 입출고`, body `${M.D} 입출고가 올라왔어요 — 입고 ${n} · 출고 ${n} (당일착 ${n})`(당일착 0이면 괄호 생략), tag `bnl-upload`, url `?date=${date}`.
- `notify`: `requireAdmin` → body `{ date, inbound, outbound, sameDay }` → `buildMessage` → `push_subscriptions` 전체에 `webpush.sendNotification`(VAPID env) → 404/410은 삭제 → `{ sent, removed }`.
- `src/sw.ts`: `precacheAndRoute(self.__WB_MANIFEST)`; `push` → `showNotification(title, { body, tag, data: { url } })`; `notificationclick` → 열린 앱 창이 있으면 `focus()` + `postMessage({ type: 'open-date', date })`, 없으면 `openWindow(scope + url)`.
- `push.ts`: `pushSupported(): boolean`, `subscribePush(client, vapidKey): Promise<'subscribed' | 'denied' | 'unsupported'>`(권한 요청 → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` → `push_subscriptions` upsert `{ endpoint, p256dh, auth, user_id }`), `unsubscribePush(client): Promise<void>`(구독 해제 + 행 삭제, 실패 무시).

- [ ] **Step 1: 실패하는 테스트** — `buildMessage({date:'2026-11-06', inbound:3, outbound:28, sameDay:2})` → body `11.6 입출고가 올라왔어요 — 입고 3 · 출고 28 (당일착 2)`, url `?date=2026-11-06`; sameDay 0 → `… · 출고 28`로 끝남; 결과 문자열에 숫자·날짜 외 데이터가 들어갈 자리가 없음(입력 타입이 숫자만)
- [ ] **Step 2:** FAIL → 구현 → PASS
- [ ] **Step 3:** `npm run build` → `dist/sw.js` 생성, precache 목록 포함 확인(`grep -c "index.html" dist/sw.js` ≥ 1)
- [ ] **Step 4: Commit** — `feat(v2): 푸시 서비스 워커·구독·notify 함수`

---

### Task 7: 화면 연결 — 로그인, 상태 줄, 관리자 전용 업로드, PIN 변경, 알림 카드

**Files:**
- Create: `src/screens/LoginScreen.tsx`, `src/components/StatusBar.tsx`, `src/components/PushCard.tsx`, `src/screens/AdminPanel.tsx`, `src/lib/upload.ts`
- Modify: `src/App.tsx`, `src/repo.ts`, `src/screens/UploadScreen.tsx`, `src/screens/ListScreen.tsx`, `src/main.tsx`, `src/styles.css`
- Test: `tests/upload.test.ts`

**Interfaces:**
- `src/repo.ts`: `local = createDexieRepository()`, `remote = createSupabaseRemote(supabase)`, `repo = createCloudRepository(local, remote, () => currentFileName)`, `setCurrentFileName(n)`, `sync = createSync({ local, remote })`. 화면은 계속 `repo`만 읽는다.
- `src/lib/upload.ts`: `uploadFiles(files, deps: { online: boolean; repo; now; notify: (s) => Promise<void>; setFileName }): Promise<ImportLine[]>` — `online`이 false면 `[{ level:'error', text:'❌ 인터넷 연결이 필요해요' }]`(해석 안 함, Review Focus 5); 아니면 파일마다 `setFileName` 후 `importFiles([file])`; ok 줄이 하나라도 있으면 최신 기준일 요약으로 `notify` 호출, 실패 시 `⚠️ 알림을 보내지 못했어요` 추가.
- `App`: 세션 없음 → `LoginScreen`(PIN 6자리 `inputMode="numeric"`, 문구는 스펙 4.2; `관리자 로그인 ›` 전환). 로그인 후 `watchAuth` 연결(onSignedOut = `local.clearAll()` + `unsubscribePush`), `sync.syncOnce()`를 로그인 직후·`visibilitychange`(visible)·`online`·`remote.onNewLog`에서 호출, `sync.onChange` → `dataVersion` 증가. `?date=` 쿼리와 SW `open-date` 메시지 → 해당 날짜 목록.
- `StatusBar`: `최신 · HH:MM 동기화` / `동기화 중…` / `오프라인 · 마지막 동기화 M.D HH:MM` / `동기화 실패 · 다시 시도` 버튼. 우측 메뉴: `알림 켜기/끄기`, `로그아웃`.
- 탭: 역할 admin일 때만 `올리기`. `UploadScreen`: `[전체 데이터 삭제]` 제거, `uploadFiles` 사용, 하단에 `AdminPanel`(`[직원 PIN 변경]`: 6자리 두 번 입력·일치 확인 → `functions.invoke('set-staff-pin')` → `PIN을 바꿨어요. 직원 폰은 1시간 안에 로그아웃돼요`).
- `PushCard`: `pushSupported()`이고 `Notification.permission==='default'`일 때 목록 위 `🔔 새 입출고 알림 받기`.
- `main.tsx`: 개발용 `__seed` 제거.

- [ ] **Step 1: 실패하는 테스트 (`upload.ts`)** — `online:false` → 오류 한 줄, `repo.replaceDays` 호출 0회; 신항 픽스처 업로드 → `notify`가 `{ date:'2026-11-05', inbound:1, outbound:0, sameDay:0 }`로 1회; `notify` reject → 마지막 줄 `{ level:'warn', text:'⚠️ 알림을 보내지 못했어요' }`; 결과가 모두 error면 `notify` 미호출
- [ ] **Step 2:** FAIL → 구현 → PASS
- [ ] **Step 3:** 화면 구현. `npm run build` 성공, `npm test` 전체 PASS
- [ ] **Step 4: Commit** — `feat(v2): 로그인·동기화 상태·관리자 업로드·PIN 변경·알림 화면`

---

### Task 8: 클라우드 프로젝트 준비 (사용자와 함께 — 각 단계 전 안내하고 멈춤)

**Files:**
- Create: `.env.local`(git 제외, 공개 값만), `docs/operations.md`(운영 절차: PIN 변경, 관리자 비밀번호 변경, 함수 재배포, 비밀 값 교체 — 값 자체는 쓰지 않음)

- [ ] **Step 1 (사용자):** supabase.com 가입 → New project(Region: Northeast Asia (Seoul), 강한 DB 비밀번호는 사용자가 보관) → Project Settings › API에서 URL·anon key를 알려 줌(공개 값)
- [ ] **Step 2 (사용자, 터미널 앱):** `npx supabase login` → `npx supabase link --project-ref <ref>`
- [ ] **Step 3:** `npx supabase db push` → 표 6개·함수 생성 확인(`npx supabase db … ` 또는 대시보드 Table Editor)
- [ ] **Step 4:** Authentication 설정: 회원가입 비활성화(대시보드 › Authentication › Sign In / Providers › "Allow new users to sign up" 끔), 이메일 확인 끔
- [ ] **Step 5:** 계정 생성 — 대시보드 › Authentication › Add user: 관리자(사용자 이메일, 사용자가 비밀번호 입력), staff(`staff@bnl.internal`). staff 비밀번호는 무작위 40자를 git 제외 임시 파일(`.staff-password.local`)에 생성 → 사용자가 그 파일 내용을 대시보드 비밀번호 칸에 붙여 넣음 → `npx supabase secrets set STAFF_PASSWORD="$(cat .staff-password.local)"` → 임시 파일 삭제. 채팅·로그 출력 금지. SQL Editor에서 두 계정의 `raw_app_meta_data`에 `role` 설정
- [ ] **Step 6:** VAPID 키 생성(`npx web-push generate-vapid-keys --json` → 공개 키는 `.env.local`, 비밀 키는 `supabase secrets set VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:<관리자 이메일> STAFF_EMAIL=staff@bnl.internal`), 출력은 파일로만 받아 바로 삭제
- [ ] **Step 7:** `npx supabase functions deploy staff-login set-staff-pin notify --use-api`. `staff-login`은 `--no-verify-jwt`(로그인 전 호출)
- [ ] **Step 8 (사용자):** 관리자로 앱 로그인 → AdminPanel에서 초기 PIN 6자리 설정
- [ ] **Step 9: Commit** — `docs(v2): 운영 절차와 Supabase 설정` (`.env.local` 제외 확인: `git check-ignore .env.local`)

---

### Task 9: 원격 권한·함수 검증 스크립트

**Files:**
- Create: `scripts/verify-cloud.mjs`

**Interfaces:**
- 실행: `ADMIN_EMAIL=… ADMIN_PASSWORD=… STAFF_PIN=… node --env-file=.env.local scripts/verify-cloud.mjs` (비밀은 사용자가 터미널에서 직접 입력; 스크립트는 값을 출력하지 않음). 검사마다 `✅/❌ 설명` 한 줄, 하나라도 ❌면 exit 1.
- 검사 항목:
  1. 비로그인: `inbound`/`outbound`/`upload_log` select → 0행 또는 권한 오류
  2. 틀린 PIN → 401; 맞는 PIN → 세션 받음, role `staff`
  3. staff: select 가능; `inbound` insert/delete 거부; `rpc('replace_days')` 거부; `staff_pin` select 0행
  4. admin: 신항 픽스처로 `replace_days`(날짜를 `2099-01-01`로 바꾼 테스트 행) 성공 → `upload_log` 증가 → 같은 호출 재실행 후 행 수 동일 → 잘못된 행(id 중복)으로 호출 → 실패하고 기존 행 유지(롤백) → 테스트 날짜 행 정리(관리자 RPC로 빈 rows 교체)
  5. Realtime: staff 클라이언트가 `upload_log` INSERT 이벤트를 10초 안에 수신
  6. `notify`를 staff로 호출 → 403
  잠금 검사(20회 실패)는 실제 직원을 15분 막으므로 자동 실행하지 않고 `pin.test.ts` 단위 테스트로 대신한다.

- [ ] **Step 1:** 스크립트 작성
- [ ] **Step 2 (사용자가 비밀 입력):** 실행 → 전 항목 ✅. ❌가 나오면 superpowers:systematic-debugging으로 원인 수정(마이그레이션/함수) 후 재배포·재실행
- [ ] **Step 3: Commit** — `test(v2): 원격 권한·함수 검증 스크립트`

---

### Task 10: 배포와 실기기 확인

**Files:**
- Modify: `.github/workflows/deploy.yml` (build 단계 env: `VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` 동일), `README.md`(v2 사용법: 직원 설치·PIN 로그인·알림 켜기, 관리자 업로드·PIN 변경)

- [ ] **Step 1:** 워크플로·README 수정, `npm test`·`npm run build` 통과, Commit — `feat(v2): 배포 설정과 사용 안내`
- [ ] **Step 2 (사용자):** GitHub 저장소 › Settings › Secrets and variables › Actions › **Variables**에 세 값 등록
- [ ] **Step 3:** `feat/v2` → `main` 병합 여부를 사용자에게 확인(superpowers:finishing-a-development-branch) → 사용자가 터미널에서 push → Actions 성공 확인
- [ ] **Step 4 (사용자와 함께) 실기기 확인:**
  - 안드로이드: 앱 업데이트 후 PIN 로그인 → 알림 받기 허용 → 상태 줄 `최신`
  - PC(관리자): 최신 엑셀 3개 업로드 → 안드로이드 화면이 열린 상태에서 몇 초 안에 갱신
  - 안드로이드 앱 종료 후 PC에서 다시 업로드 → 알림 도착 → 탭하면 해당 날짜 목록
  - 비행기 모드 → 앱 열림, 상태 줄 `오프라인`
  - AdminPanel에서 PIN 변경 → (최대 1시간 후) 안드로이드가 로그인 화면, 목록 데이터 없음 → 새 PIN으로 로그인 → 데이터 다시 받음 (Review Focus 4)
