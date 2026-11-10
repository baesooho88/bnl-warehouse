export type Port = '북항' | '신항'

export type Kind = '입고-북항' | '입고-신항' | '출고'

/** cellDates를 쓰지 않으므로 엑셀 날짜 셀은 시리얼 숫자로 들어온다. */
export type CellValue = string | number | boolean | null

export interface Container {
  no: string
  type: string | null // 구분 (예: 20DC X 1)
}

export interface Inbound {
  id: string // `${port}|${baseDate}|${index}`
  port: Port
  baseDate: string // 기준일 YYYY-MM-DD (시트 날짜)
  arrivalDate: string | null // 입항일
  vessel: string | null // 선명
  bl: string
  item: string | null // 품명
  qty: number | null
  weightKg: number | null
  cbm: number | null
  hull: string | null // 호선
  po: string | null
  terminal: string | null // 부두 및 창고
  containers: Container[]
  destination: string | null
  note: string | null // 비고
  raw: Record<string, string> // 숫자/날짜 변환 실패 시 원문
}

export interface Outbound {
  id: string // `출고|${baseDate}|${index}`
  baseDate: string // 기준일 = 상차일 (시트 날짜)
  seq: number | null // 순번
  center: string | null
  bnlInDate: string | null // BNL 입하일자
  bl: string | null
  hull: string | null
  po: string | null
  item: string | null
  qtyText: string | null // 요청수량 원문
  qtyRequested: number | null
  qtyTotal: number | null
  weightKg: number | null
  cbm: number | null
  boxNo: string | null
  destination: string | null // 물류센터명/도착지
  gateTime: string | null // 입문시간
  memo: string | null
  inspectedDate: string | null // 입고 검수 일자
  requester: string | null
  arriveDate: string | null // 도착 요청일자
  location: string | null
  sameDay: boolean // 당일착
  dispatch?: Dispatch | null // 배차 시트에서 붙인 차량 정보(그 날짜에 배차 시트가 없으면 없음)
  raw: Record<string, string>
}

/** 배차 시트 한 줄(차 한 대분 묶음). 같은 줄의 출고 건들은 같은 값을 가진다. */
export interface Dispatch {
  line: number // 배차 시트 안의 줄 번호(묶음 구분용)
  arrive: string | null // 도착일, null = 당착
  vehicles: string // '11T×1 · 5T×1', 배차에 없는 건은 ''
  note: string | null // 지역·업체·시간
  invar: boolean
}

export interface SheetResult {
  kind: Kind | null
  sheetName: string
  baseDate: string | null
  status: 'ok' | 'skipped'
  count: number
  message?: string
}

export interface ParseResult {
  fileName: string
  inbound: Inbound[]
  outbound: Outbound[]
  sheets: SheetResult[]
}
