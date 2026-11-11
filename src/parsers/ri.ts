import * as XLSX from 'xlsx'
import type { CellValue } from '../domain/types'
import { normHeader, toText } from './cells'
import { headerIndex, sheetToGrid } from './grid'

/** RI 준비자재 작업표 한 줄 */
export interface RiItem {
  baseDate: string // 작업일 = 파일 이름의 날짜(시트 안 날짜는 지난 값이 남아 있곤 해서 쓰지 않는다)
  idx: number
  bl: string
  po: string | null
  hull: string | null
  qtyText: string | null // 검수량 원문 '전량[3]\n중 3Box'
  item: string | null
  wms: string | null // WMS 위치 원문, 줄마다 '2-A(2)'
  presWork: string | null // PRESERVATION 작업필요
  presReport: string | null // PRESERVATION REPORT
  box: string | null
  riLocation: string | null // RI 준비 위치
  note: string | null
}

const isHeader = (row: CellValue[]) => {
  const keys = row.map(normHeader)
  return keys.includes('B/LNO.') && keys.includes('RI준비위치')
}

/**
 * RI 작업표면 {date, items}, 날짜를 못 읽으면 {error}, RI 작업표가 아니면 null.
 * 열 이름 줄('B/L No.' + 'RI 준비 위치')이 여러 번 나올 수 있어(위쪽 빈 표) 각 줄 아래를 모두 읽는다.
 */
export function parseRiWorkbook(data: ArrayBuffer | Uint8Array, fileName: string): { date: string; items: RiItem[] } | { error: string } | null {
  const wb = XLSX.read(data)
  const grids = wb.SheetNames.map((n) => sheetToGrid(wb.Sheets[n])).filter((g) => g.some(isHeader))
  if (!grids.length) return null

  const m = fileName.normalize('NFC').match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/)
  if (!m) return { error: '파일 이름에서 날짜를 읽지 못했어요 (예: RI 준비자재(2026.11.11))' }
  const date = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`

  const items: RiItem[] = []
  for (const grid of grids) {
    let idx: Map<string, number> | null = null
    for (const row of grid) {
      if (isHeader(row)) { idx = headerIndex(row); continue }
      if (!idx) continue
      const vals = row.filter((v) => toText(v) !== null).map(String)
      if (new Set(vals).size <= 1) continue // 빈 줄, 가로로 병합된 제목·날짜 줄
      const at = (key: string, plus = 0) => (idx!.has(key) ? toText(row[idx!.get(key)! + plus]) : null)
      const bl = at('B/LNO.')
      if (!bl || normHeader(bl) === 'B/LNO.') continue // 병합으로 열 이름이 내려온 '작업필요/REPORT' 줄
      items.push({
        baseDate: date, idx: items.length, bl, po: at('P/ONO.'), hull: at('HULLNO.'), qtyText: at('검수량'), item: at('DESCRIPTION.'),
        wms: at('WMSLOCATION'), presWork: at('PRESERVATION'), presReport: at('PRESERVATION', 1), box: at('BOXNO.'), riLocation: at('RI준비위치'), note: at('비고'),
      })
    }
  }
  return { date, items }
}

/** '전량[3]\n중 3Box' → '3/3 Box'. 모양이 다르면 원문(줄바꿈은 공백). */
export const riQty = (s: string | null) => {
  const m = s?.match(/\[(\d+)\][\s\S]*?(\d+)\s*box/i)
  return m ? `${m[2]}/${m[1]} Box` : (s?.replace(/\s*\n\s*/g, ' ') ?? null)
}

/** '2-A(2)\n8-D(1)' → ['2-A ×2', '8-D ×1'] */
export const riWms = (s: string | null) =>
  (s ?? '').split(/\n+/).map((x) => x.trim()).filter(Boolean).map((x) => x.replace(/^(.+?)\s*\((\d+)\)$/, '$1 ×$2'))
