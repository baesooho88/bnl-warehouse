# 휴가 달력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 월별 휴가 달력 탭 — 관리자는 날짜 팝업에서 휴가자(이름+종류)를 넣고 빼고, 직원은 본다.

**Architecture:** Supabase `vacations` 표(RLS: 읽기 admin·staff, 쓰기 admin)를 앱이 달마다 직접 조회한다. 휴대폰 사본·기존 동기화는 건드리지 않는다. 달력 칸 계산은 순수 함수로 분리해 단위 테스트하고, 서버 권한은 `scripts/verify-cloud.mjs`로 원격 확인한다.

**Tech Stack:** React 19, TypeScript, Vitest, @supabase/supabase-js 2.119, Supabase CLI(`npx supabase … --remote --yes`)

**Spec:** `docs/superpowers/specs/2026-11-06-bnl-warehouse-vacation-calendar-design.md`

## Global Constraints

- 종류는 정확히 `연차` / `오전반차` / `오후반차` / `기타`, 기본값 `연차`.
- 이름: 앞뒤 공백 제거 후 1~20자. 입력칸 `maxLength=20`.
- 문구(스펙 5장 그대로): `인터넷 연결이 필요해요`, `불러오지 못했어요`, `다시 시도`, `이미 있어요`, `저장하지 못했어요. 다시 시도해 주세요`, `휴가자가 없어요`.
- 실명은 저장소·테스트·로그에 넣지 않는다. 테스트 이름은 `테스트A`류, 원격 테스트 날짜는 `2099-01-01`.
- 날짜는 `YYYY-MM-DD` 문자열, 계산은 UTC (`src/lib/dates.ts` 방식). 팝업 제목은 기존 `formatDay` 사용.
- Supabase 변경 명령은 `--remote --yes`(에이전트 셸). 비밀 값 출력 금지.
- 360px 폭에서 가로 스크롤 없음.

## Review Focus

1. **달을 빠르게 넘김** → 늦게 도착한 이전 달 응답이 현재 달 화면을 덮으면 안 된다(요청마다 대상 월을 확인하고 다르면 버림). (Task 3 브라우저 확인 + 최종 리뷰)
2. **추가 버튼 연타** → 같은 줄이 두 번 들어가거나 `이미 있어요`가 잘못 뜨면 안 된다(저장 중 버튼 비활성). (Task 3)
3. **팝업이 열린 상태에서 다른 사람이 변경**(실시간) → 팝업 목록도 새 데이터로 바뀐다(팝업은 달력이 가진 목록에서 그날 것을 걸러 보여 준다). (Task 3)
4. **이름 중간 공백**(`김 OO`) → 앞뒤만 제거하고 중간은 유지, 유일 조건은 정리된 이름 기준. (Task 1 테스트)
5. **오프라인으로 달력 진입 후 재연결** → `다시 시도`로 회복, `online` 이벤트에도 다시 받음. (Task 3)

---

### Task 1: 달력 계산 순수 함수

**Files:**
- Create: `src/vacation/calendar.ts`
- Test: `tests/calendar.test.ts`

**Interfaces:**
- Produces: `VACATION_TYPES = ['연차','오전반차','오후반차','기타'] as const`, `type VacationType = (typeof VACATION_TYPES)[number]`, `monthGrid(ym: string): (string | null)[][]`, `shiftMonth(ym: string, delta: number): string`, `monthOf(iso: string): string` (`'2026-11-06'`→`'2026-11'`), `monthBounds(ym: string): { from: string; to: string }`, `normalizeName(raw: string): string | null`, `cellSummary(names: string[], max?: number): { shown: string[]; more: number }`

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/calendar.test.ts`)

```ts
test('monthGrid 2026-11: 일요일 시작, 5주, 30일', () => {
  const g = monthGrid('2026-11')
  expect(g.length).toBe(5)
  expect(g.every((w) => w.length === 7)).toBe(true)
  expect(g[0][0]).toBe('2026-11-01')
  expect(g[4].filter(Boolean).at(-1)).toBe('2026-11-30')
  expect(g[4].slice(2).every((d) => d === null)).toBe(true)
})
test('monthGrid 2026-02(28일, 일요일 시작)은 4주, 2028-02(윤년)는 29일', () => {
  expect(monthGrid('2026-02').length).toBe(4)
  expect(monthGrid('2028-02').flat().filter(Boolean).at(-1)).toBe('2028-02-29')
})
test('monthGrid 2026-08: 1일이 토요일이면 앞 6칸이 비고 6주', () => {
  const g = monthGrid('2026-08')
  expect(g[0].slice(0, 6)).toEqual([null, null, null, null, null, null])
  expect(g[0][6]).toBe('2026-08-01')
  expect(g.length).toBe(6)
})
test('shiftMonth: 해 넘김', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  expect(shiftMonth('2026-01', -1)).toBe('2025-12')
})
test('monthOf, monthBounds', () => {
  expect(monthOf('2026-11-06')).toBe('2026-11')
  expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
})
test('normalizeName: 앞뒤 공백만 제거, 빈 값·21자는 null', () => {
  expect(normalizeName('  김 OO ')).toBe('김 OO')
  expect(normalizeName('   ')).toBeNull()
  expect(normalizeName('가'.repeat(20))).toBe('가'.repeat(20))
  expect(normalizeName('가'.repeat(21))).toBeNull()
})
test('cellSummary: 2명까지, 나머지는 more', () => {
  expect(cellSummary([])).toEqual({ shown: [], more: 0 })
  expect(cellSummary(['A', 'B'])).toEqual({ shown: ['A', 'B'], more: 0 })
  expect(cellSummary(['A', 'B', 'C', 'D', 'E'])).toEqual({ shown: ['A', 'B'], more: 3 })
})
```

- [ ] **Step 2:** `npx vitest run tests/calendar.test.ts` → Expected: FAIL (모듈 없음)
- [ ] **Step 3:** `src/vacation/calendar.ts` 구현 — UTC `Date.UTC(y, m, 0)`로 말일, `getUTCDay()`로 앞 빈칸, 마지막 주는 `null`로 7칸 채움.
- [ ] **Step 4:** `npx vitest run tests/calendar.test.ts` → Expected: 7 passed
- [ ] **Step 5: Commit** — `feat(vacation): 달력 계산 함수`

---

### Task 2: 서버 표·권한과 접근 모듈

**Files:**
- Create: `supabase/migrations/20261106000000_vacations.sql`, `src/vacation/vacations.ts`
- Modify: `scripts/verify-cloud.mjs` (검사 추가)
- Test: `tests/vacations.test.ts`

**Interfaces:**
- Consumes: Task 1 `VacationType`, `monthBounds`, `normalizeName`
- Produces: `interface Vacation { id: number; date: string; name: string; type: VacationType }`, `fetchMonth(client: SupabaseClient, ym: string): Promise<Vacation[]>`, `addVacation(client, v: { date: string; name: string; type: VacationType }): Promise<'ok' | 'duplicate'>`, `deleteVacation(client, id: number): Promise<void>`, `recentNames(client): Promise<string[]>`, `onVacationChange(client, cb: () => void): () => void`

- [ ] **Step 1: 마이그레이션 작성** — 스펙 3장 그대로: 표(`name` check `name = btrim(name) and char_length(name) between 1 and 20`, `type` check 4종), `unique (date, name)`, `date` 색인, RLS enable, 정책 3개(select admin·staff / insert admin / delete admin, 모두 `public.app_role()` 사용), `alter publication supabase_realtime add table public.vacations`.
- [ ] **Step 2: 실패하는 테스트** (`tests/vacations.test.ts`) — 최소 가짜 client(`from().insert()`가 정해진 `{ error }`를 돌려줌)로:
  - `addVacation`이 `{ code: '23505' }` → `'duplicate'`
  - 다른 오류 → throw
  - 이름 `'  테스트A '` → insert에 `name: '테스트A'`로 넘김; 정리 후 빈 이름 → insert 호출 없이 throw
  - `recentNames`: `[{name:'테스트A'},{name:'테스트B'},{name:'테스트A'}]` → `['테스트A','테스트B']`
- [ ] **Step 3:** `npx vitest run tests/vacations.test.ts` → Expected: FAIL (모듈 없음)
- [ ] **Step 4:** `src/vacation/vacations.ts` 구현 — `fetchMonth`는 `monthBounds`로 `gte/lte('date')`, `order('date').order('name')`; `recentNames`는 `order('id', desc).limit(200)` 후 순서 유지 중복 제거; `onVacationChange`는 채널 이름 ``vacations:${crypto.randomUUID()}``, `postgres_changes` 이벤트 `*`.
- [ ] **Step 5:** `npx vitest run tests/vacations.test.ts` → Expected: PASS
- [ ] **Step 6: 원격 반영** — `npx supabase db push --remote --dry-run`(이 마이그레이션 1개만 보이는지) → `npx supabase db push --remote --yes`
- [ ] **Step 7: `scripts/verify-cloud.mjs`에 검사 추가** (기존 `try` 안, 정리는 `finally`):
  - 비로그인 `vacations` 읽기 0행
  - 관리자 `2099-01-01`·`테스트A`·`연차` insert 성공, 같은 값 재insert → 오류 코드 `23505`
  - 직원 insert 거부, 직원 delete 후에도 1행 유지
  - 직원이 `vacations` 변경 이벤트를 10초 안에 수신(관리자 insert 전에 구독)
  - `finally`: 관리자가 `2099-01-01` 휴가 삭제 → 0행
- [ ] **Step 8 (사용자):** 지난번과 같은 명령으로 실행 → Expected: `✅ 모두 통과`
- [ ] **Step 9: Commit** — `feat(vacation): 휴가 표·권한과 접근 모듈`

---

### Task 3: 달력 화면과 팝업

**Files:**
- Create: `src/screens/CalendarScreen.tsx`, `src/components/VacationSheet.tsx`
- Modify: `src/components/TabBar.tsx`(`Tab`에 `'달력'`), `src/App.tsx`(탭 목록: 관리자 `['목록','검색','통계','달력','올리기']`, 직원 `['목록','검색','통계','달력']`; `{current === '달력' && <CalendarScreen canEdit={role === 'admin'} />}`), `src/styles.css`

**Interfaces:**
- Consumes: Task 1 전부, Task 2 전부, `formatDay`·`todayIso`(`src/lib/dates.ts`), `supabase`(`src/storage/cloud/supabase.ts`)
- Produces: `CalendarScreen({ canEdit }: { canEdit: boolean })`, `VacationSheet({ date, items, canEdit, names, onClose, onChanged }: { date: string; items: Vacation[]; canEdit: boolean; names: string[]; onClose: () => void; onChanged: () => void })`

- [ ] **Step 1: CalendarScreen** — 상태: `ym`(처음 `monthOf(todayIso(new Date()))`), `items`, `state: 'loading'|'ok'|'offline'|'error'`, `openDate`. `load()`는 시작할 때 `ym`을 기억하고 응답 때 현재 `ym`과 다르면 버린다(Review Focus 1). `navigator.onLine`이 false면 `offline`. 화면이 떠 있는 동안 `onVacationChange(load)`와 `window` `online` → `load`. 관리자는 `recentNames`를 한 번 받아 팝업에 넘긴다(실패해도 무시).
- [ ] **Step 2: 달력 그리기** — `monthGrid(ym)` 7열 표, 칸에 `cellSummary(그날 items의 \`${name} ${type}\`)`, `+N명`, 오늘 강조, 일요일 숫자 빨강·토요일 파랑, 칸 누르면 `openDate` 설정. 머리 `◀ YYYY년 M월 ▶`.
- [ ] **Step 3: VacationSheet** — 제목 `${formatDay(date)} 휴가`; 목록(없으면 `휴가자가 없어요`); `canEdit`이면 줄마다 삭제, 아래에 이름 `<input list maxLength=20>`+`<datalist>`(names)+종류 `<select>`(기본 `연차`)+추가. 저장 중 버튼 비활성(Review Focus 2). 결과: `'ok'` → 이름 비우고 `onChanged()`; `'duplicate'` → `이미 있어요`; throw → `저장하지 못했어요. 다시 시도해 주세요`(입력 유지). 뒤로 가기: `DetailScreen`과 같은 방식(`history.pushState({ sheet: true }, '')`, `popstate`로 닫기, `closing` ref로 연타 방지). 바깥(배경) 누르기·닫기 버튼도 닫기. `items`는 달력이 가진 목록에서 그날 것만 걸러 넘긴다(Review Focus 3).
- [ ] **Step 4: 스타일** — 7열 `grid-template-columns: repeat(7, 1fr)`, 칸 안 이름은 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, 시트는 화면 아래 고정·배경 반투명. 기존 색 변수 사용.
- [ ] **Step 5: 검증** — `npm test` 전부 통과, `npm run build` 성공. 개발 서버를 실제 Supabase 설정으로 띄우고 360×780에서 확인: (사용자가 관리자로 로그인) 추가·중복·삭제, 달 빠르게 넘기기, 직원 로그인 시 읽기 전용, 오프라인 문구.
- [ ] **Step 6: Commit** — `feat(vacation): 달력 탭과 휴가 입력 팝업`

---

### Task 4: 안내 문서와 배포

**Files:**
- Modify: `README.md` (직원: 달력 탭에서 휴가 확인 / 관리자: 날짜 눌러 휴가 추가·삭제)

- [ ] **Step 1:** README 수정, `npm test`·`npm run build` 통과, Commit — `docs(vacation): 사용 안내`
- [ ] **Step 2:** 최종 전체 리뷰 → 수정 → `feat/vacation`을 `main`에 합칠지 사용자에게 확인(superpowers:finishing-a-development-branch) → 사용자가 터미널에서 push → Actions 성공·배포 확인
- [ ] **Step 3 (사용자) 실기기:** 직원 폰 달력 탭 열어 둔 상태에서 PC 관리자가 휴가 추가 → 몇 초 안에 반영
