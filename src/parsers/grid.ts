import * as XLSX from 'xlsx'
import type { CellValue, Kind } from '../domain/types'
import { inferYear, normHeader } from './cells'

/** 워크시트를 grid[행][열] (grid[0][0] = A1) 배열로. 병합 범위는 좌상단 값으로 모두 채운다. */
export function sheetToGrid(ws: XLSX.WorkSheet): CellValue[][] {
  if (!ws['!ref']) return []
  const range = XLSX.utils.decode_range(ws['!ref'])
  const grid: CellValue[][] = []
  for (let r = 0; r <= range.e.r; r++) {
    const row: CellValue[] = []
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined
      row.push(cell?.v === undefined ? null : (cell.v as CellValue))
    }
    grid.push(row)
  }
  for (const m of ws['!merges'] ?? []) {
    const v = grid[m.s.r]?.[m.s.c] ?? null
    for (let r = m.s.r; r <= m.e.r && r < grid.length; r++)
      for (let c = m.s.c; c <= m.e.c && c < grid[r].length; c++) grid[r][c] = v
  }
  return grid
}

export function detectKind(grid: CellValue[][]): Kind | null {
  const title = String(grid[0]?.[0] ?? '')
  if (title.includes('일일보세운송현황')) {
    if (title.includes('북항')) return '입고-북항'
    if (title.includes('신항')) return '입고-신항'
    return null
  }
  if (title.includes('일일출하요청서')) return '출고'
  return null
}

export function findHeaderRow(grid: CellValue[][]): number {
  for (let r = 0; r < Math.min(10, grid.length); r++) {
    if (grid[r].some((v) => ['B/LNO.', 'BLNO'].includes(normHeader(v)))) return r
  }
  return -1
}

export function headerIndex(row: CellValue[]): Map<string, number> {
  const map = new Map<string, number>()
  row.forEach((v, i) => {
    const key = normHeader(v)
    if (key && !map.has(key)) map.set(key, i)
  })
  return map
}

export function sheetBaseDate(sheetName: string, now: Date): string | null {
  const m = sheetName.trim().match(/^(\d{1,2})\.(\d{1,2})(?:\s*\([^)]*\))?$/) // '11.10 (인바)'처럼 괄호 꼬리 허용
  if (!m) return null
  const month = +m[1]
  const day = +m[2]
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${inferYear(month, now)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
