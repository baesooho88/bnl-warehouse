import * as XLSX from 'xlsx'
import type { CellValue } from '../domain/types'
import { inferYear, normHeader, toIsoDate, toNumber, toText } from './cells'
import { headerIndex, sheetToGrid } from './grid'

/** 재고 현황 한 줄(BOX 단위 재고) */
export interface StockItem {
  idx: number
  bl: string
  item: string | null
  box: string | null // BOX NO 원문 '8(3392)'
  qty: number | null // BOX 재고 수량
  weightKg: number | null
  cbm: number | null
  location: string | null
  inDate: string | null // 입고일
  inNo: string | null // 입고번호
  po: string | null
  project: string | null
  customsNo: string | null // 수입신고번호
  cargoNo: string | null // 화물관리번호
  note: string | null
}

const isHeader = (row: CellValue[]) => {
  const keys = row.map(normHeader)
  return keys.includes('BOX재고_수량') && keys.includes('LOCATION')
}

/**
 * 재고 파일이면 {date, items}, 날짜를 못 읽으면 {error}, 재고 파일이 아니면 null.
 * 기준일은 파일 이름('11.12.xlsx' 또는 '2026.11.12'). 합계 줄(Σ)처럼 B/L 없는 줄은 건너뛴다.
 */
export function parseStockWorkbook(data: ArrayBuffer | Uint8Array, fileName: string, now: Date): { date: string; items: StockItem[] } | { error: string } | null {
  const wb = XLSX.read(data)
  const grid = wb.SheetNames.map((n) => sheetToGrid(wb.Sheets[n])).find((g) => g.slice(0, 10).some(isHeader))
  if (!grid) return null

  const m = fileName.normalize('NFC').match(/(?:(\d{4})\.)?(\d{1,2})\.(\d{1,2})/)
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return { error: '파일 이름에서 날짜를 읽지 못했어요 (예: 11.12.xlsx)' }
  const year = m[1] ? +m[1] : inferYear(+m[2], now)
  const date = `${year}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`

  const h = grid.findIndex(isHeader)
  const idx = headerIndex(grid[h])
  const items: StockItem[] = []
  for (const row of grid.slice(h + 1)) {
    const at = (key: string) => (idx.has(key) ? row[idx.get(key)!] : null)
    const bl = toText(at('B/LNO'))
    if (!bl) continue
    items.push({
      idx: items.length, bl, item: toText(at('품명')), box: toText(at('BOXNO')),
      qty: toNumber(at('BOX재고_수량')), weightKg: toNumber(at('BOX재고중량')), cbm: toNumber(at('BOX재고용적')),
      location: toText(at('LOCATION')), inDate: toIsoDate(at('입고일'), now), inNo: toText(at('입고번호')),
      po: toText(at('PONO')), project: toText(at('PROJECTNO')), customsNo: toText(at('수입신고번호')), cargoNo: toText(at('화물관리번호')),
      note: toText(at('비고')),
    })
  }
  return { date, items }
}
