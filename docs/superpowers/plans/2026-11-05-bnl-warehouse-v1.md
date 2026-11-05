# BNL 입출고 조회 앱 v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보세운송현황(북항·신항, 입고)과 한화오션 일일출하요청서(출고) 엑셀을 휴대폰에서 업로드해 날짜별 목록·검색·통계로 조회하는 안드로이드용 PWA를 만든다.

**Architecture:** 순수 함수 `parsers`(엑셀 → 레코드)와 `Repository` 인터페이스 뒤의 IndexedDB 저장소(`storage`), React 화면(`screens`)으로 분리한다. 화면은 `Repository` 인터페이스만 알고, v2에서 클라우드 구현으로 교체한다. 서버 없음, 데이터는 휴대폰 IndexedDB에만 저장된다.

**Tech Stack:** TypeScript, React 18, Vite, SheetJS 0.20.3(cdn.sheetjs.com), Dexie 4, vite-plugin-pwa, Vitest, fake-indexeddb, GitHub Pages(Actions).

**Spec:** `docs/superpowers/specs/2026-11-05-bnl-warehouse-design.md`

## Global Constraints

- 대상: 안드로이드 Chrome, 세로 모바일 화면(폭 360px 기준). UI 문구는 모두 한국어.
- 서버·외부 API 호출 없음. 엑셀 데이터는 IndexedDB에만 저장하고 네트워크로 보내지 않는다.
- `source/`(원본 엑셀, 이름·전화번호 포함)는 절대 커밋하지 않는다(`.gitignore`에 이미 있음). 테스트는 `tests/fixtures/`의 익명화 사본만 쓴다.
- SheetJS 설치: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (npm 레지스트리의 `xlsx`는 쓰지 않는다).
- 단위: 중량 kg, 용적 CBM.
- 날짜는 내부적으로 항상 `YYYY-MM-DD` 문자열(로컬 기준). 화면 표시는 `M.D` / `M.D (요일)`.
- 같은 종류 + 같은 기준일 데이터는 통째로 교체한다.
- 모든 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **B/L 칸이 병합되지 않은 채 CONT'R NO.만 있는 행** → 버려지지 않고 직전 입고 건의 컨테이너로 붙어야 한다. (Task 4 테스트)
2. **같은 파일을 두 번 올림** → 건수가 두 배가 되면 안 된다. (Task 6 테스트)
3. **날짜가 아닌 시트 이름**(`Sheet1`, `11.5 `처럼 공백 포함, `요약`) → 공백은 허용해 읽고, 그 외는 그 시트만 건너뛰며 앱이 멈추면 안 된다. (Task 5 테스트)
4. **숫자 칸의 문자열**(`"3,482.6"`, `"-"`, 빈칸) → 콤마는 숫자로, 나머지는 `null`. 통계 합계가 `NaN`이 되면 안 된다. (Task 2, Task 8 테스트)
5. **연말·연초 업로드**(1월에 `12.30` 시트) → 전년도 날짜가 되어야 한다. (Task 2 테스트)

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html
public/logo.svg (+ 생성된 pwa 아이콘들)
.github/workflows/deploy.yml
scripts/make-fixtures.mjs          # source/ → tests/fixtures/ 익명화
src/
  domain/types.ts                  # Inbound, Outbound, Kind, Container, SheetResult, ParseResult
  parsers/cells.ts                 # 셀 값 변환: normHeader, toText, toNumber, toIsoDate, inferYear, parseQty
  parsers/grid.ts                  # 워크시트 → 병합 채운 2차원 배열, 종류 판별, 열 이름 줄 탐지, 시트명 날짜
  parsers/inbound.ts               # 보세운송 시트 → Inbound[]
  parsers/outbound.ts              # 출하요청서 시트 → Outbound[]
  parsers/workbook.ts              # 파일 전체 → ParseResult
  storage/repository.ts            # Repository 인터페이스
  storage/dexieRepository.ts       # IndexedDB 구현
  lib/dates.ts                     # 표시 형식, 주/월 범위, 날짜 더하기
  lib/stats.ts                     # computeStats (순수)
  lib/phone.ts                     # 전화번호 분리
  lib/importFiles.ts               # 업로드: 파싱 → 저장 → 결과 메시지
  components/  DateNav.tsx, InboundCard.tsx, OutboundCard.tsx, BarChart.tsx, TabBar.tsx
  screens/     ListScreen.tsx, DetailScreen.tsx, SearchScreen.tsx, StatsScreen.tsx, UploadScreen.tsx
  App.tsx, main.tsx, styles.css, repo.ts (앱 전역 Repository 인스턴스)
tests/
  fixtures/bukhang.xlsx, sinhang.xlsx, outbound.xlsx
  cells.test.ts, grid.test.ts, inbound.test.ts, outbound.test.ts, workbook.test.ts,
  repository.test.ts, stats.test.ts, dates.test.ts, phone.test.ts, importFiles.test.ts
```

---

### Task 1: 프로젝트 뼈대와 익명화 테스트 자료

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`(빈 화면), `scripts/make-fixtures.mjs`, `tests/fixtures/*.xlsx`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm test`(vitest run), `npm run dev`, `npm run build`(tsc --noEmit && vite build), `npm run fixtures`. 픽스처 3개: `tests/fixtures/bukhang.xlsx`, `sinhang.xlsx`, `outbound.xlsx`.

- [ ] **Step 1: Vite React-TS 프로젝트 생성**
  `npm create vite@latest . -- --template react-ts` (기존 파일 유지), 그다음
  `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz dexie` /
  `npm i -D vitest fake-indexeddb vite-plugin-pwa @vite-pwa/assets-generator`.
  `package.json` scripts에 `"test": "vitest run"`, `"fixtures": "node scripts/make-fixtures.mjs"` 추가. `vite.config.ts`의 `base`는 `process.env.BASE_PATH ?? '/'`.

- [ ] **Step 2: `scripts/make-fixtures.mjs` 작성**
  `source/`의 가장 최근 날짜 파일 3개(북항, 신항, 출하요청서 — 파일명 정렬로 마지막)를 SheetJS(`cellDates: true`)로 읽어 다음을 치환한 뒤 같은 구조(시트·병합 유지)로 `tests/fixtures/{bukhang,sinhang,outbound}.xlsx`에 쓴다:
  - 모든 문자열 셀의 전화번호 `/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g` → `010-0000-0000`
  - 출하요청서 `신청자명` 열 값 → `신청자A`, `신청자B` …(같은 이름은 같은 별칭), MEMO의 한글 이름(2~4자 한글 + 공백/직함 앞) → `담당자`
  - 출하요청서 2행 `작성자 : …` → `작성자 : 작성자`
  스크립트는 파일명을 NFC로 정규화해 비교한다(macOS 파일명은 NFD).

- [ ] **Step 3: 픽스처 생성 후 개인정보 잔존 확인**
  Run: `npm run fixtures && node -e "…"`(각 픽스처의 모든 셀을 출력해 `grep -E '01[016789][- ]?[0-9]{3,4}'`가 `010-0000-0000` 외에 없음, 원본 신청자명이 하나도 없음을 확인)
  Expected: 원본 이름·번호 0건.

- [ ] **Step 4: 스모크 테스트** `tests/smoke.test.ts`: 세 픽스처를 `XLSX.read(fs.readFileSync(...))`로 열어 각 `SheetNames`가 `['11.2','11.3','11.4','11.5']`인지 확인. Run `npm test` → PASS. `npm run build` → 성공.

- [ ] **Step 5: Commit** — `chore: Vite+React+TS 프로젝트 뼈대와 익명화 테스트 자료`

---

### Task 2: 도메인 타입과 셀 값 변환

**Files:**
- Create: `src/domain/types.ts`, `src/parsers/cells.ts`
- Test: `tests/cells.test.ts`

**Interfaces:**
- Produces: `src/domain/types.ts` — 스펙 6장의 `Port`, `Container`, `Inbound`, `Outbound`, `Kind`, `SheetResult`, `ParseResult`를 그대로. 추가로 `type CellValue = string | number | boolean | Date | null`.
- Produces: `src/parsers/cells.ts`
  - `normHeader(v: CellValue): string` — 문자열화 후 모든 공백·줄바꿈 제거, 대문자화
  - `toText(v: CellValue): string | null` — trim, 빈 문자열은 `null`
  - `toNumber(v: CellValue): number | null` — 숫자 그대로, 문자열은 콤마 제거 후 `Number`, 실패/빈칸 `null`
  - `inferYear(month: number, now: Date): number` — `month - (now.getMonth()+1) > 6`이면 `now.getFullYear()-1`, 아니면 올해
  - `toIsoDate(v: CellValue, now: Date): string | null` — `Date`, 엑셀 시리얼 숫자(`XLSX.SSF.parse_date_code`), `YYYY-MM-DD`/`YYYY.MM.DD` 문자열, `M월 D일`(연도는 `inferYear`) 처리, 그 외 `null`
  - `parseQty(v: CellValue): { text: string | null; requested: number | null; total: number | null }`

- [ ] **Step 1: 실패하는 테스트 작성** (`now = new Date(2026, 10, 5)`):
```ts
expect(normHeader('선    명')).toBe('선명');
expect(normHeader('물류센터명\n도착지')).toBe('물류센터명도착지');
expect(normHeader('B/L NO.  ')).toBe('B/LNO.');
expect(toNumber('3,482.6')).toBe(3482.6);
expect(toNumber('-')).toBeNull();
expect(toNumber('')).toBeNull();
expect(toNumber(15560)).toBe(15560);
expect(toIsoDate('2026-10-14', now)).toBe('2026-10-14');
expect(toIsoDate('10월 31일', now)).toBe('2026-10-31');
expect(toIsoDate('12월 30일', new Date(2027, 0, 3))).toBe('2026-12-30');
expect(toIsoDate(new Date(2026, 10, 2), now)).toBe('2026-11-02');
expect(toIsoDate(46328, now)).toBe('2026-11-02');   // 엑셀 시리얼
expect(toIsoDate('-', now)).toBeNull();
expect(inferYear(12, new Date(2027, 0, 3))).toBe(2026);
expect(inferYear(11, now)).toBe(2026);
expect(parseQty('11/22')).toEqual({ text: '11/22', requested: 11, total: 22 });
expect(parseQty('1식')).toEqual({ text: '1식', requested: null, total: null });
```
- [ ] **Step 2:** `npx vitest run tests/cells.test.ts` → FAIL (모듈 없음)
- [ ] **Step 3:** `types.ts`, `cells.ts` 구현
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5: Commit** — `feat: 도메인 타입과 셀 값 변환`

---

### Task 3: 시트 그리드 — 병합 채우기, 종류 판별, 열 이름 줄, 시트 날짜

**Files:**
- Create: `src/parsers/grid.ts`
- Test: `tests/grid.test.ts`

**Interfaces:**
- Consumes: `CellValue`, `Kind`, `normHeader`
- Produces:
  - `sheetToGrid(ws: XLSX.WorkSheet): CellValue[][]` — `grid[0][0]`이 A1. `decode_range(ws['!ref'])` 전 범위를 순회해 만들고, `ws['!merges']`마다 좌상단 값을 범위 전체에 복사. 빈 셀은 `null`.
  - `detectKind(grid: CellValue[][]): Kind | null` — A1 문자열에 `일일보세운송현황`+`북항` → `'입고-북항'`, +`신항` → `'입고-신항'`, `일일출하요청서` → `'출고'`
  - `findHeaderRow(grid: CellValue[][]): number` — 처음 10행 중 `normHeader`가 `'B/LNO.'` 또는 `'BLNO'`인 셀이 있는 행 인덱스, 없으면 `-1`
  - `headerIndex(row: CellValue[]): Map<string, number>` — `normHeader(셀) → 열 번호`
  - `sheetBaseDate(sheetName: string, now: Date): string | null` — `trim` 후 `/^(\d{1,2})\.(\d{1,2})$/`, 연도는 `inferYear`

- [ ] **Step 1: 실패하는 테스트** (픽스처 사용, `now = new Date(2026,10,5)`):
  - 신항 픽스처 `11.5` 시트: `detectKind`=`'입고-신항'`, `findHeaderRow`=2, 그리드 5행(index 4)의 B/L 열 값이 `'PLISH7H51981'`(병합 채움 확인), `L`열은 `'TEMU1760600'`
  - 북항 → `'입고-북항'`, 출고 픽스처 → `'출고'`
  - `XLSX.utils.aoa_to_sheet([['아무 제목'],[],['x']])` → `detectKind`=`null`, `findHeaderRow`=`-1`
  - `sheetBaseDate('11.5', now)`=`'2026-11-05'`, `sheetBaseDate('11.5 ', now)`=`'2026-11-05'`, `sheetBaseDate('Sheet1', now)`=`null`, `sheetBaseDate('요약', now)`=`null`
- [ ] **Step 2:** `npx vitest run tests/grid.test.ts` → FAIL
- [ ] **Step 3:** `grid.ts` 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5: Commit** — `feat: 시트 그리드 변환과 양식 판별`

---

### Task 4: 입고(보세운송) 시트 해석

**Files:**
- Create: `src/parsers/inbound.ts`
- Test: `tests/inbound.test.ts`

**Interfaces:**
- Consumes: `sheetToGrid`, `findHeaderRow`, `headerIndex`, `toText`, `toNumber`, `toIsoDate`
- Produces: `parseInboundSheet(grid: CellValue[][], port: Port, baseDate: string, now: Date): Inbound[]`

열 매핑(정규화 이름 → 필드): `입항일`→arrivalDate, `선명`|`선(기)명`→vessel, `B/LNO.`→bl, `품명`→item, `수량`→qty, `중량`→weightKg, `용적`→cbm, `호선`→hull, `P.ONO.`→po, `부두및창고`→terminal, `구분`→container.type, `CONT'RNO.`→container.no, `도착지`→destination, `비고`→note.

묶기 규칙(스펙 5.5, 5.6 + Review Focus 1):
- 행의 bl·item이 모두 비었고 컨테이너 번호도 없으면 건너뜀.
- bl·item이 모두 비었지만 컨테이너 번호가 있으면 직전 건의 `containers`에 추가. (실제 샘플 신항 11.3 6행이 이 경우)
- 이어지는 행의 비고가 직전 건 `note`에 없는 값이면 ` / `로 이어 붙인다. (신항 11.3 8행 `OOG 확인필요`)
- bl이 직전 건과 같으면 직전 건에 컨테이너 추가, 다르면 새 건.
- 숫자/날짜 변환 실패한 비어 있지 않은 원문은 `raw[열이름]`에 저장.
- `id = \`${port}|${baseDate}|${n}\``(n은 0부터 건 순번).

- [ ] **Step 1: 실패하는 테스트**
  - 신항 픽스처 `11.5` 시트 → 1건, `bl='PLISH7H51981'`, `item='ANCHOR CHAIN'`, `qty=38`, `weightKg=231667`, `hull='2607'`, `containers.length=14`, `containers[0]={no:'HMMU2248146', type:'20DC X 14'}`, `arrivalDate='2026-10-25'`, `note='월요일 까지 컨반납'`
  - 북항 픽스처 `11.2` 시트 → 첫 건 `bl='PLISH7H54985'`, `vessel='EASLINE KWANGYANG'`, `arrivalDate='2026-10-31'`, `containers=[{no:'EAXU6114460', type:'40HC X 1'}]`
  - 신항 `11.2` 시트 헤더 `선(기)명`이 vessel로 매핑: 첫 건 `vessel='ONE TRIUMPH'`, 시트 전체 2건(첫 건 컨테이너 8개)
  - 신항 `11.3` 시트 → 3건. 2번째 건(`PLISH7H53647`) 컨테이너 번호 `['HMMU7604614','HMMU7605903']`(B/L 미병합 행). 3번째 건(`HLCUDX3260805976`) 컨테이너 구분 `['40HC X 1','20FR X 1','40FR X 1']`, `note`에 `'OOG 확인필요'` 포함
  - 직접 만든 그리드: 헤더 + `['10월 1일','SHIP','BL1','ITEM',1,'-',…,'C1',…]` + 컨테이너만 있는 행 `[null,null,null,null,…,'C2',…]` → 1건, `containers` 번호 `['C1','C2']`, `weightKg=null`, `raw['중량']='-'`
- [ ] **Step 2:** → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5: Commit** — `feat: 보세운송(입고) 시트 해석`

---

### Task 5: 출고(출하요청서) 시트 해석과 파일 전체 해석

**Files:**
- Create: `src/parsers/outbound.ts`, `src/parsers/workbook.ts`
- Test: `tests/outbound.test.ts`, `tests/workbook.test.ts`

**Interfaces:**
- Produces: `parseOutboundSheet(grid: CellValue[][], baseDate: string, now: Date): Outbound[]`
- Produces: `parseWorkbook(data: ArrayBuffer | Uint8Array, fileName: string, now: Date): ParseResult` — `XLSX.read(data, { cellDates: true })`. 시트마다: `detectKind` null → `{status:'skipped', message:'알 수 없는 양식'}`; `sheetBaseDate` null → `'시트 이름에서 날짜를 읽지 못함'`; `findHeaderRow` -1 → `'열 이름 줄을 못 찾음'`; 아니면 해당 파서 실행 후 `{status:'ok', count}`. 파서 예외는 잡지 않는다(파일 전체 실패 — 스펙 5.11).

출고 열 매핑: 헤더 줄의 A열이 비어 있으면 0번 열을 `seq`로 사용. `센터`→center, `BNL입하일자`→bnlInDate, `BLNO`→bl, `호선`→hull, `PO`→po, `품명`→item, `요청수량`→qty*, `중량`, `용적`, `BOXNO`→boxNo, `물류센터명도착지`→destination, `입문시간`→gateTime, `MEMO`→memo, `입고검수일자`→inspectedDate, `신청자명`→requester, `도착요청일자`→arriveDate, `LOCATION`→location. 빈 행 제외 규칙은 입고와 같음(bl·item 모두 빈 행). `sameDay = gateTime?.includes('당착') || arriveDate === baseDate`. `id = \`출고|${baseDate}|${n}\``.

- [ ] **Step 1: 실패하는 테스트 — outbound**
  - 출고 픽스처 `11.5` 시트 첫 건: `seq=1`, `bl='SFSS26091021'`, `qtyText='11/22'`, `qtyRequested=11`, `qtyTotal=22`, `weightKg=3482.6`, `destination='(주)한국야나세'`, `gateTime='10시'`, `arriveDate='2026-11-06'`, `sameDay=false`, `memo`에 `'010-0000-0000'` 포함
  - `11.4` 시트 첫 건: `sameDay=true`, `arriveDate='2026-11-04'`, `item='INVAR PLATE'`
  - `11.4` 시트의 `inspectedDate`가 `'-'`인 건 → `inspectedDate=null`
- [ ] **Step 2: 실패하는 테스트 — workbook** (`now=new Date(2026,10,5)`)
  - 신항 픽스처 → `sheets` 4개 모두 `ok`, baseDate `2026-11-02`~`2026-11-05`, `outbound=[]`
  - 출고 픽스처 → 4개 시트 `ok`, 모든 `outbound[i].baseDate`가 해당 시트 날짜
  - 북항 픽스처(2행에 `2025.11.x` 오타) → 모든 `baseDate`가 `2026-`로 시작
  - `aoa_to_sheet`로 만든 `['아무 제목']` 시트 1개짜리 통합문서 → `sheets[0]={status:'skipped', message:'알 수 없는 양식', …}`, 레코드 0
  - 신항 픽스처에 이름이 `Sheet1`인 보세운송 시트를 추가한 통합문서 → 그 시트만 `'시트 이름에서 날짜를 읽지 못함'`, 나머지 4개 `ok`
- [ ] **Step 3:** 두 파일 → FAIL 확인 → 구현 → PASS (`npx vitest run tests/outbound.test.ts tests/workbook.test.ts`)
- [ ] **Step 4: Commit** — `feat: 출하요청서(출고) 해석과 통합문서 해석`

---

### Task 6: 저장소 (Repository + IndexedDB)

**Files:**
- Create: `src/storage/repository.ts`, `src/storage/dexieRepository.ts`
- Test: `tests/repository.test.ts` (첫 줄 `import 'fake-indexeddb/auto'`)

**Interfaces:**
- Produces: `src/storage/repository.ts` — 스펙 7장의 `Repository` 인터페이스 그대로. 반환 배열은 모두 `baseDate` 내림차순, 같은 날은 id 순.
- Produces: `createDexieRepository(dbName = 'bnl-warehouse'): Repository`
  - Dexie 스키마 v1: `inbound: 'id, baseDate, [port+baseDate], bl, hull, po'`, `outbound: 'id, baseDate, bl, hull, po'`
  - `replaceDays`: `db.transaction('rw', db.inbound, db.outbound, …)` 안에서 대상(입고는 `[port+baseDate]`, 출고는 `baseDate`)을 지운 뒤 `bulkAdd`
  - `search(q)`: `q`를 소문자+공백 제거; 비면 빈 결과. 대상 필드: bl, hull, po, item, destination, 컨테이너 번호(입고) — 전체 읽어서 필터
  - `coverage()`: 종류별 고유 baseDate의 최소·최대·개수, 없으면 `null`

- [ ] **Step 1: 실패하는 테스트** (테스트마다 고유 dbName)
  - 신항 픽스처 해석 결과를 `replaceDays('입고-신항', 4개 날짜, inbound, [])` → `getByDate('2026-11-05').inbound.length === 1`
  - **같은 호출을 한 번 더** → 건수 변화 없음 (Review Focus 2)
  - `replaceDays('입고-신항', ['2026-11-05'], [], [])` → 11-05 신항 0건, 11-04 신항은 그대로, 북항 데이터는 영향 없음
  - `bulkAdd`가 실패하도록 같은 id 2개를 넣은 `replaceDays` → reject, 기존 11-05 데이터 그대로 (롤백)
  - `search('hmmu2248146')` → 신항 ANCHOR CHAIN 건 포함; `search(' 2607 ')` → 같은 건; `search('')` → 빈 결과
  - `coverage()['입고-신항']` = `{from:'2026-11-02', to:'2026-11-05', days:4}`, 데이터 없는 종류는 `null`
  - `latestDate()` = `'2026-11-05'`; `clearAll()` 후 `null`
- [ ] **Step 2:** → FAIL → 구현 → PASS (`npx vitest run tests/repository.test.ts`)
- [ ] **Step 3: Commit** — `feat: IndexedDB 저장소`

---

### Task 7: 업로드 처리 (파싱 → 저장 → 결과 메시지)

**Files:**
- Create: `src/lib/importFiles.ts`
- Test: `tests/importFiles.test.ts`

**Interfaces:**
- Consumes: `parseWorkbook`, `Repository`
- Produces:
```ts
type ImportLine = { level: 'ok' | 'warn' | 'error'; text: string };
importFiles(files: { name: string; data: ArrayBuffer }[], repo: Repository, now: Date): Promise<ImportLine[]>
```
  파일 하나씩 처리. 표시 이름 = 확장자 뺀 파일명(NFC). 메시지(그대로 사용):
  - 종류별 성공: `✅ ${이름}: ${일수}일치(${M.D}~${M.D}) ${입고|출고} ${건수}건 반영` (하루면 `(${M.D})`)
  - 건너뛴 시트(알 수 없는 양식 제외): `⚠️ ${이름} ${시트명} 시트: ${message}`
  - ok 시트가 하나도 없고 전부 알 수 없는 양식: `❌ ${이름}: 알 수 없는 양식`
  - `parseWorkbook` 예외: `❌ ${이름}: 파일을 읽지 못했어요 (${err.message})`
  - `replaceDays` 예외: `❌ ${이름}: 저장하지 못했어요 (${err.message})`
  - ok 시트의 종류별로 `replaceDays(kind, 그 종류 ok 시트들의 baseDate, …)` 호출.

- [ ] **Step 1: 실패하는 테스트** (`fake-indexeddb`, `now=new Date(2026,10,5)`)
  - 신항 픽스처(name `'신항보세운송 (2026.11.5).xlsx'`) → `[{level:'ok', text:'✅ 신항보세운송 (2026.11.5): 4일치(11.2~11.5) 입고 7건 반영'}]` (11.2: 2, 11.3: 3, 11.4: 1, 11.5: 1)
  - 쓰레기 바이트 `new Uint8Array([1,2,3]).buffer`, name `'x.xlsx'` → level `error` 한 줄, 다른 파일과 같이 넣으면 다른 파일은 `ok`
  - 알 수 없는 양식만 있는 통합문서 → `❌ … 알 수 없는 양식`
  - `replaceDays`가 reject하는 가짜 repo → `❌ …: 저장하지 못했어요 (…)`
- [ ] **Step 2:** → FAIL → 구현 → PASS
- [ ] **Step 3: Commit** — `feat: 엑셀 업로드 처리와 결과 메시지`

---

### Task 8: 날짜·통계·전화번호 유틸

**Files:**
- Create: `src/lib/dates.ts`, `src/lib/stats.ts`, `src/lib/phone.ts`
- Test: `tests/dates.test.ts`, `tests/stats.test.ts`, `tests/phone.test.ts`

**Interfaces:**
- Produces `dates.ts`: `todayIso(now: Date): string`, `addDays(iso: string, n: number): string`, `formatMD(iso): string`('11.5'), `formatDay(iso): string`('11.5 (목)'), `weekRange(now): {from,to}`(월~일), `monthRange(now): {from,to}`, `daysBetween(from,to): string[]`
- Produces `stats.ts`:
```ts
interface Stats {
  inbound: Record<Port, { count: number; weightKg: number; containers: number }>;
  outbound: { count: number; weightKg: number; sameDay: number };
  daily: { date: string; inbound: number; outbound: number }[];   // from~to 모든 날짜, 0 포함
  topHulls: { hull: string; count: number }[];                   // 입고+출고, 상위 10, count 내림차순
  topDestinations: { destination: string; count: number }[];     // 출고만, 상위 10
}
computeStats(data: { inbound: Inbound[]; outbound: Outbound[] }, from: string, to: string): Stats
```
  `null` 중량은 0으로 합산. hull/destination이 `null`인 건은 상위 목록에서 제외.
- Produces `phone.ts`: `splitPhones(text: string): { text: string; tel?: string }[]` — 정규식 `/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g`, `tel`은 숫자만.

- [ ] **Step 1: 실패하는 테스트**
  - `formatDay('2026-11-05')`=`'11.5 (목)'`, `addDays('2026-11-30',1)`=`'2026-12-01'`, `weekRange(new Date(2026,10,5))`=`{from:'2026-11-02',to:'2026-11-08'}`, `monthRange(…)`=`{from:'2026-11-01',to:'2026-11-30'}`
  - `computeStats`: weightKg가 `null`인 출고 1건 + 1000인 1건 → `outbound.weightKg=1000` (NaN 아님, Review Focus 4); 11.2~11.4 범위에 11.3만 데이터 → `daily` 길이 3, 11.2·11.4는 0; hull 11종 → `topHulls.length=10`; 컨테이너 14개인 신항 1건 → `inbound['신항'].containers=14`
  - `splitPhones('홍길동 010 1234 5678 연락')` → `[{text:'홍길동 '},{text:'010 1234 5678', tel:'01012345678'},{text:' 연락'}]`; 전화번호 없으면 `[{text}]`
- [ ] **Step 2:** → FAIL → 구현 → PASS
- [ ] **Step 3: Commit** — `feat: 날짜·통계·전화번호 유틸`

---

### Task 9: 앱 화면 — 목록·상세·탭

**Files:**
- Create: `src/repo.ts`(`export const repo = createDexieRepository()`), `src/styles.css`, `src/components/{TabBar,DateNav,InboundCard,OutboundCard}.tsx`, `src/screens/{ListScreen,DetailScreen}.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- `App` 상태: `tab: '목록'|'검색'|'통계'|'올리기'`, `date: string`, `detail: { kind:'in'; item: Inbound } | { kind:'out'; item: Outbound } | null`. 상세는 탭 위에 덮는 전체 화면, 뒤로 버튼으로 닫음.
- `InboundCard({ item, onOpen })`, `OutboundCard({ item, onOpen })` — 검색 화면에서 재사용.
- 화면 내용·문구는 스펙 8.1, 8.2와 같게: 입고 카드(항구 배지 `입고·북항`/`입고·신항`, 선명, 품명, `B/L … · 호선 …`, `n개 · n,nnnkg · 컨테이너 n`), 출고 카드(`당일착` 배지, 도착지·입문시간, 품명, `B/L … · 호선 …`, `요청 11/22 · n,nnnkg · 신청자`, `상차 M.D → 도착 M.D`). 요약 줄 `입고 북항 n · 신항 n │ 출고 n (당일착 n)` 및 입고 중량(톤, 소수 1자리)·컨테이너 수. 필터 `전체/입고/출고`. 데이터 없는 날은 `이 날짜에는 데이터가 없어요` + `올리기` 탭으로 가는 버튼.
- 첫 진입 날짜: `todayIso(new Date())`에 데이터가 없으면 `repo.latestDate()`, 그것도 없으면 오늘.
- 상세: 모든 필드를 `라벨: 값` 목록으로, 입고는 컨테이너 표, `memo`/`note`는 `splitPhones`로 `<a href="tel:…">`, `raw` 항목은 `원문` 섹션에.
- 스타일: `:root` CSS 변수(배경, 글자, 입고색 파랑 계열, 출고색 주황 계열, 당일착 빨강), 하단 고정 탭바, 본문 좌우 16px, 글자 기본 16px, 탭 터치 영역 48px 이상.

- [ ] **Step 1:** 컴포넌트·화면 구현
- [ ] **Step 2:** `npm run build` → 타입 오류 없이 성공
- [ ] **Step 3: 동작 확인** — 올리기 화면은 Task 10에서 만들므로, `src/main.tsx`에 개발 모드(`import.meta.env.DEV`)에서만 `window.__seed = (files) => importFiles(files, repo, new Date())`를 노출하고 브라우저 콘솔에서 세 픽스처를 넣는다. `npm run dev` 후 360×780 크기에서 11.5 화면에 신항 ANCHOR CHAIN 카드와 출고 카드들이 보이고, ◀/▶로 11.4 이동 시 `당일착` 배지가 보이며, 카드를 누르면 상세와 컨테이너 14개가 보이는지 확인.
- [ ] **Step 4: Commit** — `feat: 목록·상세 화면과 하단 탭`

---

### Task 10: 검색·통계·올리기 화면

**Files:**
- Create: `src/screens/{SearchScreen,StatsScreen,UploadScreen}.tsx`, `src/components/BarChart.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `repo`, `InboundCard`, `OutboundCard`, `computeStats`, `weekRange`, `monthRange`, `importFiles`
- 검색(스펙 8.3): 입력 300ms 디바운스 → `repo.search`, 결과 카드에 기준일(`formatDay`) 표시. 결과 없으면 `검색 결과가 없어요`.
- 통계(스펙 8.4): `이번 주 / 이번 달 / 직접 지정`(직접 지정은 `<input type="date">` 두 개). `repo.getRange` → `computeStats`. 숫자 카드, `BarChart`(라이브러리 없이 div 막대, 입고·출고 두 색, 날짜 라벨 `M.D`, 가로 스크롤 허용은 차트 영역 내부만), 상위 10 목록 두 개.
- 올리기(스펙 8.5): `<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple>` → `file.arrayBuffer()` → `importFiles` → 결과 줄 목록. 처리 중 `처리 중…` 표시, 버튼 비활성. 저장 현황: `repo.coverage()` → `북항 11.2~11.5 (4일)` 형식, 없으면 `없음`. `[전체 데이터 삭제]` → `window.confirm('저장된 입출고 데이터를 모두 지울까요?')` 후 `clearAll`. 업로드·삭제 후 목록 탭이 최신 날짜를 다시 읽도록 `App`에 `dataVersion` 카운터를 두고 증가.

- [ ] **Step 1:** 구현
- [ ] **Step 2:** `npm run build` → 성공, `npm test` → 전체 PASS
- [ ] **Step 3: 동작 확인** (360×780): 올리기에서 세 픽스처 동시 선택 → ✅ 3줄, 저장 현황 3종 `11.2~11.5 (4일)`; 같은 파일 다시 올려도 목록 건수 그대로; 검색 `HMMU2248146` → ANCHOR CHAIN; 통계 `직접 지정 2026-11-02~2026-11-05` → 막대 4개, 숫자 0이나 NaN 표기 없음; 전체 삭제 → 목록에 빈 상태 문구.
- [ ] **Step 4: Commit** — `feat: 검색·통계·올리기 화면`

---

### Task 11: PWA 설치·오프라인과 GitHub Pages 배포

**Files:**
- Create: `public/logo.svg`, `pwa-assets.config.ts`, `.github/workflows/deploy.yml`, `README.md`
- Modify: `vite.config.ts`, `index.html`

**Interfaces:**
- `VitePWA({ registerType: 'autoUpdate', manifest: { name: 'BNL 입출고', short_name: 'BNL 입출고', lang: 'ko', display: 'standalone', start_url: '.', scope: '.', theme_color, background_color, icons: [192, 512, maskable 512] }, workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] } })`
- 아이콘: `public/logo.svg`(창고/상자 모양 단순 도형) → `npx pwa-assets-generator --preset minimal-2023 public/logo.svg`
- 워크플로: `main` push 시 `npm ci` → `npm test` → `BASE_PATH=/${{ github.event.repository.name }}/ npm run build` → `actions/upload-pages-artifact@v3`(`dist`) → `actions/deploy-pages@v4`. 권한 `pages: write`, `id-token: write`.
- `README.md`: 매일 사용법(PC에서 받은 파일 3개 → 구글 드라이브/카톡 나와의 채팅 → 앱 올리기 탭에서 3개 선택), 설치 방법, 개발 명령, `source/`는 커밋 금지 안내.

- [ ] **Step 1:** 구현
- [ ] **Step 2: 확인** — `npm run build && npx vite preview` → Chrome DevTools Application 탭에서 Manifest 오류 없음, Service Worker 활성, Network를 Offline으로 바꾸고 새로고침해도 앱이 열림. `git ls-files | grep -c '^source/'` → `0`.
- [ ] **Step 3: Commit** — `feat: PWA 설치 설정과 GitHub Pages 배포`
- [ ] **Step 4: 사용자와 함께 배포 (외부 공개 작업 — 진행 전 사용자 확인 필수)**
  사용자가 GitHub에 공개 저장소 `bnl-warehouse` 생성 → 저장소 Settings › Pages › Source를 `GitHub Actions`로 설정 → `git remote add origin … && git push -u origin main`. Actions 성공 후 `https://<아이디>.github.io/bnl-warehouse/` 접속 확인.
- [ ] **Step 5: 실기기 확인 (사용자)** — 안드로이드 Chrome에서 주소 열기 → `앱 설치` → 홈 화면 아이콘으로 실행 → 올리기에서 구글 드라이브의 실제 엑셀 3개 선택 → 목록·검색·통계 확인 → 비행기 모드에서도 열리는지 확인.
