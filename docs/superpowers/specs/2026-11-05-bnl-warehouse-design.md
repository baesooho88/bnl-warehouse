# BNL 입출고 조회 앱 (v1) 설계

- 작성일: 2026-11-05
- 상태: 사용자 검토 대기

## 1. 목적과 범위

### 목적
매일 엑셀로 전달받는 입출고 내역을 안드로이드 휴대폰에 설치한 앱에서 조회한다.
이번 v1은 사용자 혼자 쓰는 앱이며, 이후 클라우드 저장·직원 공유(v2~)로 확장하기 위한 연습이자 기반이다.

### 사용자가 정한 사항
- 사용자: 1명(본인). 서버 없음.
- 기기: 안드로이드 휴대폰(Chrome).
- 엑셀 수신: PC(메일/메신저). PC에서 구글 드라이브 또는 카톡 "나와의 채팅"으로 휴대폰에 넘긴 뒤, 휴대폰 앱에서 업로드한다.
- 입고 = 일일보세운송현황(북항·신항), 출고 = 한화오션 일일출하요청서. 입고와 출고는 각각 따로 전달받는다.
- v1 기능: 날짜별 입출고 목록, 검색, 요약 통계, 업로드.

### v1 범위 밖 (YAGNI)
- 클라우드 저장, PC 업로드 → 휴대폰 자동 반영, 로그인, 직원 공유 (v2~)
- 앱에서 데이터 수정·입력
- 푸시 알림, 앱스토어 출시
- 입고↔출고 B/L 자동 매칭 화면 (검색 결과로 함께 보는 수준만 제공)

## 2. 전체 구조

```
[휴대폰 PWA]
  ① 파일 선택 → ② 엑셀 해석기(parsers) → ③ 저장소(storage, IndexedDB) → ④ 화면(screens)
```

| 모듈 | 책임 | 의존 | 변경 시점 |
|---|---|---|---|
| `parsers` | 엑셀(ArrayBuffer) → 표준 레코드 + 처리 결과 리포트. 순수 함수, 브라우저 API 의존 없음 | SheetJS | 엑셀 양식 변경 |
| `storage` | 레코드 저장/조회. `Repository` 인터페이스 뒤에 IndexedDB 구현 | Dexie | v2에서 클라우드 구현으로 교체 |
| `screens` | 목록·상세·검색·통계·올리기 화면 | `storage` 인터페이스만 사용 | 화면 추가/변경 |
| PWA 셸 | 설치, 오프라인 캐시, 자동 업데이트 | vite-plugin-pwa | 거의 없음 |

`screens`는 `storage`의 구현(IndexedDB)을 직접 알지 않는다. v2에서는 같은 인터페이스의 클라우드 구현을 끼워 넣는다.

## 3. 기술 스택

| 용도 | 선택 |
|---|---|
| 언어/UI | TypeScript + React |
| 빌드 | Vite |
| 엑셀 파싱 | SheetJS (`xlsx`, cdn.sheetjs.com 배포본) |
| 로컬 DB | IndexedDB + Dexie |
| PWA | vite-plugin-pwa |
| 테스트 | Vitest |
| 배포 | GitHub Pages (GitHub Actions로 자동 배포) |

## 4. 입력 파일

### 공통
- 파일은 **누적형**이다. 예: 11.5 파일에 `11.2`, `11.3`, `11.4`, `11.5` 시트가 모두 있다.
- 시트 1개 = 하루치. 시트 이름은 `M.D` 형식(예: `11.5`).
- 1~2행: 제목/날짜, 3행: 열 이름, 4행부터 데이터 (단, 위치를 고정하지 않고 탐지한다 — 5.3 참조).

### 파일 종류 판별 (A1 제목 기준, 파일명 무관)
| A1 제목 포함 문자열 | 종류 |
|---|---|
| `일일보세운송현황` + `북항` | 입고·북항 |
| `일일보세운송현황` + `신항` | 입고·신항 |
| `일일출하요청서` | 출고 |
| 그 외 | 알 수 없는 양식 → 건너뜀 + 알림 |

판별은 시트마다 수행한다.

### 입고: 일일보세운송현황 (북항·신항 동일, A~N)
입항일, 선명(신항: 선(기)명), B/L NO., 품명, 수량, 중량, 용적, 호선, P.O NO., 부두 및 창고, 구분, CONT'R NO., 도착지, 비고

특징: B/L 1건에 컨테이너가 여러 개면 CONT'R NO.(및 경우에 따라 구분)만 행마다 있고 나머지 칸은 세로 병합되어 있다.

### 출고: 일일출하요청서 (A~R)
순번, 센터, BNL 입하일자, BL No, 호선, PO, 품명, 요청수량, 중량, 용적, BOX NO, 물류센터명/도착지, 입문시간, MEMO, 입고 검수 일자, 신청자명, 도착 요청일자, Location

업무 의미:
- 시트 날짜 = 출하 요청이 올라온 날 = BNL 창고에서 **상차(출고)하는 날**.
- 도착 요청일자 = 한화오션에 들어가는 날(보통 다음 날).
- **당일착**: 요청 당일 도착. 입문시간에 `당착`으로 표기되며, 도착 요청일자가 시트 날짜와 같다.

## 5. 해석 규칙 (parsers)

1. **기준일**: 시트 이름 `M.D`에서 월·일을 읽는다.
2. **연도 추론**: 시트 내 연도 표기는 신뢰하지 않는다(예: 북항 시트의 `2025.11.2` 오타). 업로드 시점 연도를 쓰되, (대상 월 − 업로드 월) > 6 이면 전년도로 본다(1월에 12월 시트를 올리는 경우). 연도 없는 입항일(`10월 31일`)은 기준일의 연도를 쓰고, 그 결과가 기준일보다 뒤면 1년을 뺀다(입항일은 기준일보다 늦을 수 없음). 엑셀 날짜 셀은 `cellDates` 없이 시리얼 숫자로 읽어 시간대 영향을 받지 않게 한다.
3. **열 이름 줄 탐지**: 공백·줄바꿈을 제거한 값이 `B/LNO.` 또는 `BLNo`인 셀이 있는 행을 열 이름 줄로 본다. 열은 정규화한 열 이름으로 매핑한다(예: `선    명` → `선명`, `선(기)명` → `선명`). 첫 10행 안에서 찾지 못하면 그 시트는 건너뛰고 알린다.
4. **병합 칸 채우기**: 시트의 병합 범위 값을 범위 내 모든 셀에 채운다.
5. **입고 묶기**: 병합 채우기 후 B/L과 품명이 모두 같은 연속 행을 1건으로 묶는다(같은 B/L이라도 품명이 다르면 별도 건). 각 행의 (CONT'R NO., 구분)은 그 건의 컨테이너 목록이 된다. 빈 컨테이너 번호는 제외한다. B/L·품명이 비어 있고 컨테이너 번호만 있는 행(병합되지 않은 경우, 예: 신항 11.3)은 직전 건의 컨테이너로 붙인다. 이어지는 행에만 있는 비고는 ` / `로 이어 붙인다.
6. **빈 행/합계 행 제외**: B/L과 품명이 모두 빈 행은 건너뛴다.
7. **숫자 변환**: 수량·중량·용적은 숫자로 변환한다. 변환할 수 없는 값(`-` 등)은 `null`로 두고 원문을 보존한다.
8. **날짜 변환**: 엑셀 날짜 셀·`YYYY-MM-DD` 문자열·`M월 D일`을 `YYYY-MM-DD`로 통일한다. 실패하면 `null` + 원문 보존.
9. **요청수량**: `11/22` → `requested=11`, `total=22`, 원문 보존. 형식이 다르면 원문만 보존한다.
10. **당일착 판정**: 입문시간에 `당착`이 포함되거나, 도착 요청일자 = 기준일.
11. **원자성**: 파일 하나를 끝까지 해석하고 나서 저장소에 넘긴다. 해석 중 예외가 나면 그 파일 전체를 반영하지 않는다(시트 단위 건너뜀은 정상 처리로 간주하고 리포트에 기록).

## 6. 데이터 모델

```ts
type Port = '북항' | '신항';

interface Container { no: string; type: string | null }   // type: 구분(예: 20DC X 1)

interface Inbound {
  id: string;                 // `${port}|${baseDate}|${index}`
  port: Port;
  baseDate: string;           // 기준일 YYYY-MM-DD (시트 날짜)
  arrivalDate: string | null; // 입항일
  vessel: string | null;      // 선명
  bl: string;
  item: string | null;        // 품명
  qty: number | null;
  weightKg: number | null;
  cbm: number | null;
  hull: string | null;        // 호선
  po: string | null;
  terminal: string | null;    // 부두 및 창고
  containers: Container[];
  destination: string | null;
  note: string | null;        // 비고
  raw: Record<string, string>; // 숫자/날짜 변환 실패 시 원문
}

interface Outbound {
  id: string;                 // `출고|${baseDate}|${index}`
  baseDate: string;           // 기준일 = 상차일 (시트 날짜)
  seq: number | null;         // 순번
  center: string | null;
  bnlInDate: string | null;   // BNL 입하일자
  bl: string | null;
  hull: string | null;
  po: string | null;
  item: string | null;
  qtyText: string | null;     // 요청수량 원문
  qtyRequested: number | null;
  qtyTotal: number | null;
  weightKg: number | null;
  cbm: number | null;
  boxNo: string | null;
  destination: string | null; // 물류센터명/도착지
  gateTime: string | null;    // 입문시간
  memo: string | null;
  inspectedDate: string | null; // 입고 검수 일자
  requester: string | null;
  arriveDate: string | null;  // 도착 요청일자
  location: string | null;
  sameDay: boolean;           // 당일착
  raw: Record<string, string>;
}

type Kind = '입고-북항' | '입고-신항' | '출고';

interface SheetResult {
  kind: Kind | null; sheetName: string; baseDate: string | null;
  status: 'ok' | 'skipped'; count: number; message?: string;
}
interface ParseResult {
  fileName: string;
  inbound: Inbound[]; outbound: Outbound[];
  sheets: SheetResult[];
}
```

단위 가정: 중량 kg, 용적 CBM.

## 7. 저장소 (storage)

```ts
interface Repository {
  replaceDays(kind: Kind, baseDates: string[], inbound: Inbound[], outbound: Outbound[]): Promise<void>;
  getRange(from: string, to: string): Promise<{ inbound: Inbound[]; outbound: Outbound[] }>;
  search(query: string): Promise<{ inbound: Inbound[]; outbound: Outbound[] }>;
  coverage(): Promise<Record<Kind, { from: string; to: string; days: number } | null>>;
  latestDate(): Promise<string | null>;
  clearAll(): Promise<void>;
}
```

- **중복 규칙**: 같은 종류 + 같은 기준일 데이터는 통째로 교체한다. `replaceDays`는 하나의 IndexedDB 트랜잭션에서 삭제와 추가를 수행한다(중간 실패 시 롤백).
- **인덱스**: `baseDate`, `[port+baseDate]`, `bl`, `hull`, `po`.
- **검색**: 대소문자·공백을 무시한 부분 일치. 대상: B/L, 호선, PO, 품명, 컨테이너 번호, 도착지. 데이터가 하루 수십 건 규모이므로 v1은 전체를 읽어 메모리에서 필터한다.
- 저장 공간 오류 등 쓰기 실패 시 기존 데이터를 그대로 두고 오류를 화면에 보여 준다.

## 8. 화면 (screens)

하단 탭 4개: **목록 · 검색 · 통계 · 올리기**. 모바일 세로 화면 기준.

### 8.1 목록 (첫 화면)
- 상단: `◀ 11.5 (목) ▶` + 달력 선택. 처음 열 때는 오늘, 오늘 데이터가 없으면 `latestDate()`.
- 요약: 입고 북항 n · 신항 n / 출고 n (당일착 n) / 입고 중량 합계·컨테이너 수.
- 필터: 전체 / 입고 / 출고.
- 입고 카드: 항구 배지, 선명, 품명, B/L·호선, 수량·중량·컨테이너 수.
- 출고 카드: 당일착 배지(해당 시), 도착지·입문시간, 품명, B/L·호선, 요청수량·중량·신청자, `상차 M.D → 도착 M.D`.
- 카드 탭 → 상세.

### 8.2 상세
- 모든 항목 표시. 입고는 컨테이너 목록(번호·구분) 표시.
- MEMO·비고 안의 전화번호(`010-…`, `010 …`)는 `tel:` 링크.
- 변환에 실패한 원문 값(`raw`)도 함께 표시.

### 8.3 검색
- 입력창 1개, 입력 후 300ms 디바운스.
- 결과: 입고·출고 함께, 기준일 최신순. 카드는 목록과 같은 컴포넌트를 쓴다.

### 8.4 통계
- 기간: 이번 주 / 이번 달 / 직접 지정.
- 숫자: 입고(북항·신항 각각) 건수·중량·컨테이너 수, 출고 건수·중량·당일착 수.
- 일별 입고/출고 막대 그래프.
- 상위 10: 호선별(입고+출고 건수), 출고 도착지별.

### 8.5 올리기
- 파일 선택(`accept=.xlsx`, 여러 개). 안드로이드 파일 선택기에서 구글 드라이브·다운로드 폴더 사용.
- 업로드 시 `navigator.storage.persist()`를 요청해 저장 공간 부족 시에도 데이터가 지워지지 않게 한다.
- 하루치 조회는 `getRange(d, d)`를 쓴다.
- 파일별 결과 알림 예:
  - `✅ 신항보세운송: 4일치(11.2~11.5) 입고 9건 반영`
  - `⚠️ 북항 11.3 시트: 열 이름 줄을 못 찾아 건너뜀`
  - `❌ abc.xlsx: 알 수 없는 양식`
- 저장 현황: 종류별 날짜 범위와 일수.
- [전체 데이터 삭제] (확인 대화상자 후 실행).

## 9. 오류 처리 요약

| 상황 | 동작 |
|---|---|
| 알 수 없는 양식 | 해당 시트/파일 건너뜀 + 알림. 다른 파일은 계속 처리 |
| 열 이름 줄 못 찾음 | 해당 시트만 건너뜀 + 알림 |
| 숫자/날짜 변환 실패 | `null` + 원문(`raw`) 보존, 상세에 표시 |
| 파일 해석 중 예외 | 그 파일 전체 미반영 + 알림 |
| 저장 실패 | 트랜잭션 롤백, 기존 데이터 유지 + 알림 |

## 10. 배포와 설치

1. GitHub 저장소(공개)에 코드 업로드. GitHub Actions로 빌드 후 GitHub Pages에 배포.
2. 안드로이드 Chrome에서 Pages 주소 접속 → "앱 설치".
3. 오프라인 동작(앱 셸 캐시). 새 버전 배포 시 다음 실행 때 자동 업데이트.

**데이터 보안**: 공개되는 것은 앱 코드뿐이다. 엑셀 데이터는 휴대폰 IndexedDB에만 저장된다.
원본 샘플 엑셀(`source/`)에는 담당자 이름·전화번호가 있으므로 **git에 올리지 않는다**(`.gitignore`).

## 11. 테스트

- **파서 단위 테스트(Vitest)**: `source/`의 실제 샘플로 만든 **익명화 테스트용 엑셀**(이름·전화번호 치환, 구조·병합 유지)을 `tests/fixtures/`에 두고 검증한다. 예:
  - 신항 11.5 시트 → 입고 1건, 컨테이너 14개
  - 북항 시트 연도 오타(`2025`)가 있어도 기준일 연도는 업로드 연도
  - 출하요청서 11.4 시트 1번 행 → `sameDay = true`
  - 출하요청서 11.5 시트 1번 행 → `qtyRequested=11`, `qtyTotal=22`, `arriveDate` = 11-06
  - 누적 파일 → 시트 수만큼 기준일 생성
  - A1이 다른 파일 → 알 수 없는 양식
- **저장소 테스트**: fake-indexeddb로 `replaceDays` 교체·롤백, 검색 동작 확인.
- **화면 확인**: PC 브라우저 모바일 크기 보기 → 실제 안드로이드 기기 설치 확인.

## 12. 이후 확장 (참고, v1 범위 아님)

v2: Supabase 등 클라우드 `Repository` 구현 → PC에서 업로드, 휴대폰에서 조회 → 로그인 → 직원 공유.
`parsers`와 `screens`는 그대로 두고 `storage` 구현만 교체하는 것을 목표로 한다.
