import * as XLSX from 'xlsx'
import type { CellValue } from '../domain/types'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

export function normHeader(v: CellValue): string {
  return String(v ?? '').replace(/\s+/g, '').toUpperCase()
}

export function toText(v: CellValue): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export function toNumber(v: CellValue): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = toText(v)?.replace(/,/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** 연도 없는 날짜의 연도. 1월에 12월 시트를 올리는 경우처럼 6개월 넘게 미래면 전년도. */
export function inferYear(month: number, now: Date): number {
  return month - (now.getMonth() + 1) > 6 ? now.getFullYear() - 1 : now.getFullYear()
}

export function toIsoDate(v: CellValue, now: Date, notAfter?: string): string | null {
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v) // 시간대와 무관한 순수 계산
    return d && d.y > 1900 ? iso(d.y, d.m, d.d) : null
  }
  const s = toText(v)
  if (!s) return null

  const full = s.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})/)
  if (full) return iso(+full[1], +full[2], +full[3])

  const md = s.match(/^(\d{1,2})월\s*(\d{1,2})일/)
  if (md) {
    const m = +md[1]
    const d = +md[2]
    if (!notAfter) return iso(inferYear(m, now), m, d)
    const y = +notAfter.slice(0, 4)
    const candidate = iso(y, m, d)
    return candidate > notAfter ? iso(y - 1, m, d) : candidate
  }
  return null
}

export function parseQty(v: CellValue): { text: string | null; requested: number | null; total: number | null } {
  const text = toText(v)
  const m = text?.match(/^(\d+)\s*\/\s*(\d+)$/)
  return { text, requested: m ? +m[1] : null, total: m ? +m[2] : null }
}
