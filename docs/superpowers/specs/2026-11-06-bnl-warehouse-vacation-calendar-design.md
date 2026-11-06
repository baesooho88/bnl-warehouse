# BNL 입출고 앱 — 휴가 달력 설계

- 작성일: 2026-11-06
- 상태: 사용자 검토 대기
- 기반: v2 (`docs/superpowers/specs/2026-11-05-bnl-warehouse-v2-cloud-design.md`) — 로그인·역할(`app_metadata.role`)·RLS 규칙을 그대로 쓴다

## 1. 목적과 범위

### 목적
월별 달력에서 날짜마다 휴가자를 보고, 관리자가 날짜를 눌러 팝업에서 휴가자를 넣고 뺀다.

### 사용자가 정한 사항
| 항목 | 결정 |
|---|---|
| 권한 | 관리자만 입력·삭제, 직원은 모두 보기만 |
| 한 줄의 내용 | 이름 + 종류(`연차` / `오전반차` / `오후반차` / `기타`) |
| 입력 단위 | 날짜마다 한 줄씩 (기간 입력 없음 — 긴 연속 연차는 드묾) |
| 저장·조회 | 서버(Supabase)에만 저장, 달력을 열 때마다 그 달을 받아옴 (휴대폰 사본 없음) |
| 갱신 | 달력이 열려 있으면 실시간으로 다시 받아옴 |

### 범위 밖 (YAGNI)
- 기간 입력, 주말 제외 처리
- 공휴일 표시
- 휴가 입력 알림(푸시)
- 오프라인 조회 (인터넷이 없으면 안내만)
- 같은 줄 수정 (종류를 바꾸려면 삭제 후 다시 추가)
- 직원 본인 입력, 승인 절차

## 2. 화면

### 탭
하단 탭에 **달력**을 넣는다.
- 관리자: 목록 · 검색 · 통계 · 달력 · 올리기
- 직원: 목록 · 검색 · 통계 · 달력

### 월 달력
- 머리: `◀  2026년 11월  ▶`. 탭을 처음 열면 이번 달.
- 일~토 7열. 1일 앞, 말일 뒤 칸은 비운다.
- 칸: 날짜 숫자 + 휴가자 최대 2명(`김OO 연차`처럼 이름 뒤에 종류를 짧게), 3명 이상이면 2명 + `+N명`.
- 오늘 칸 강조, 일요일 숫자 빨강, 토요일 숫자 파랑.
- 360px 폭에서 가로 스크롤 없이 7열이 들어가야 한다(이름이 길면 칸 안에서 말줄임).

### 날짜 팝업 (아래에서 올라오는 시트)
- 제목: `11.10 (화) 휴가`
- 그날 목록: `이름 · 종류` 줄들. 없으면 `휴가자가 없어요`.
- 직원: 목록만(읽기 전용).
- 관리자: 각 줄에 **삭제** 버튼, 아래에 추가 줄
  - 이름 입력(자동완성: 최근에 넣은 이름, 중복 제거)
  - 종류 선택(기본 `연차`)
  - **추가** — 이름이 비면 누를 수 없다. 성공하면 이름 칸을 비우고 목록·달력에 바로 반영.
- 닫기: 바깥 누르기, 닫기 버튼, 뒤로 가기(안드로이드 뒤로 버튼으로 팝업만 닫힌다 — 상세 화면과 같은 방식).

## 3. 서버

### 표 `public.vacations`
| 열 | 형 | 규칙 |
|---|---|---|
| `id` | bigint identity | 기본 키 |
| `date` | date | not null |
| `name` | text | not null, 앞뒤 공백 없음, 1~20자 (`check`) |
| `type` | text | not null, `연차`/`오전반차`/`오후반차`/`기타` (`check`) |
| `created_at` | timestamptz | 기본 now() |

- `unique (date, name)` — 같은 날 같은 사람은 한 번.
- 색인: `date`.

### 권한 (RLS)
- select: `app_role() in ('admin','staff')`
- insert, delete: `app_role() = 'admin'`
- update 정책 없음.
- 비로그인(anon)은 0행.

### 실시간
`alter publication supabase_realtime add table public.vacations` — 열려 있는 달력은 변경 이벤트를 받으면 그 달을 다시 받는다(이벤트 내용은 쓰지 않는다).

## 4. 앱 코드

### `src/vacation/calendar.ts` (순수 함수, 서버 없이 테스트)
- `VACATION_TYPES = ['연차','오전반차','오후반차','기타'] as const`, `type VacationType`
- `monthGrid(ym: string): (string | null)[][]` — `'2026-11'` → 주 단위 7칸 배열, 날짜는 `YYYY-MM-DD`, 빈칸은 `null`. UTC 계산(기존 `src/lib/dates.ts` 방식).
- `normalizeName(raw: string): string | null` — 앞뒤 공백 제거, 비었거나 20자 초과면 `null`.
- `cellSummary(names: string[], max = 2): { shown: string[]; more: number }`
- `shiftMonth(ym: string, delta: number): string`

### `src/vacation/vacations.ts` (Supabase 접근)
- `interface Vacation { id: number; date: string; name: string; type: VacationType }`
- `fetchMonth(client, ym): Promise<Vacation[]>` — 그 달 1일~말일, 날짜·이름 순.
- `addVacation(client, v: { date; name; type }): Promise<'ok' | 'duplicate'>` — 유일 조건 위반(23505)은 `'duplicate'`, 그 외 오류는 throw.
- `deleteVacation(client, id): Promise<void>`
- `recentNames(client): Promise<string[]>` — 최근 200줄의 이름, 중복 제거.
- `onVacationChange(client, cb): () => void` — 고유 채널 이름(`vacations:<uuid>`)으로 구독, 해제 함수 반환.

### 화면
- `src/screens/CalendarScreen.tsx` — 월 달력, 불러오기 상태, 실시간 구독(화면이 떠 있는 동안만).
- `src/components/VacationSheet.tsx` — 날짜 팝업. `canEdit` 속성으로 관리자/직원 구분.
- `src/components/TabBar.tsx`의 `Tab`에 `'달력'` 추가, `src/App.tsx`의 역할별 탭 목록에 추가.

## 5. 오류 처리

| 상황 | 표시 |
|---|---|
| 오프라인 | 달력 자리에 `인터넷 연결이 필요해요` + **다시 시도** |
| 불러오기 실패 | `불러오지 못했어요` + **다시 시도** |
| 같은 날 같은 이름 | 팝업에 `이미 있어요`, 입력값 유지 |
| 추가·삭제 실패 | `저장하지 못했어요. 다시 시도해 주세요`, 입력값 유지 |
| 이름 비었거나 20자 초과 | **추가** 비활성 (입력칸 `maxLength=20`) |

로그아웃: 휴가 데이터는 화면 상태에만 있으므로 따로 지울 것이 없다(로그인 화면으로 바뀌면 함께 사라짐).

## 6. 개인정보
- 휴가자 실명은 Supabase에만 저장한다. 저장소(공개)·문서·테스트에는 넣지 않는다. 테스트 이름은 `테스트A` 같은 가짜 값.
- 알림·로그에 이름을 내보내지 않는다.

## 7. 테스트

### 단위 (vitest)
- `monthGrid`: 2026-11(일요일 시작), 2026-02(28일), 2028-02(윤년 29일), 1일이 토요일인 달 — 주 수, 앞뒤 빈칸, 첫·마지막 날짜.
- `shiftMonth`: 12월 → 다음 해 1월, 1월 → 이전 해 12월.
- `normalizeName`: 앞뒤 공백 제거, 빈 값·공백만 → null, 20자 통과·21자 null.
- `cellSummary`: 0·2·5명.

### 원격 (`scripts/verify-cloud.mjs`에 추가)
- 비로그인 `vacations` 읽기 0행.
- 직원 insert 거부, 직원 delete 무효.
- 관리자: `2099-01-01`에 `테스트A` 추가 → 같은 이름 다시 추가 시 유일 조건 위반 → 직원이 실시간 이벤트 수신 → 삭제 후 0행.

### 화면
360px 폭에서 달력 7열·팝업이 깨지지 않는지, 관리자 추가·삭제와 직원 읽기 전용을 브라우저에서 확인.
