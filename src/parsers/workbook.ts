import * as XLSX from 'xlsx'
import type { ParseResult, Port } from '../domain/types'
import { parseDispatch } from './dispatch'
import { detectKind, findHeaderRow, sheetBaseDate, sheetToGrid } from './grid'
import { parseInboundSheet } from './inbound'
import { parseOutboundSheet } from './outbound'

/** 파일 하나를 끝까지 해석한다. 파서 예외는 잡지 않는다 — 그 파일 전체를 반영하지 않기 위해. */
export function parseWorkbook(data: ArrayBuffer | Uint8Array, fileName: string, now: Date): ParseResult {
  const wb = XLSX.read(data) // cellDates 미사용: 날짜를 시간대와 무관한 시리얼로 받는다
  const result: ParseResult = { fileName, inbound: [], outbound: [], sheets: [] }
  let dispatch: { sheetName: string; lines: string[] } | null = null

  for (const sheetName of wb.SheetNames) {
    const grid = sheetToGrid(wb.Sheets[sheetName])
    const kind = detectKind(grid)
    const baseDate = sheetBaseDate(sheetName, now)
    const skip = (message: string) => result.sheets.push({ kind, sheetName, baseDate, status: 'skipped', count: 0, message })

    if (!kind && sheetName.includes('배차')) {
      dispatch = { sheetName, lines: grid.map((row) => row.filter((v) => v !== null).join(' ')) }
      continue
    }
    if (!kind) { skip('알 수 없는 양식'); continue }
    if (!baseDate) { skip('시트 이름에서 날짜를 읽지 못함'); continue }
    if (findHeaderRow(grid) < 0) { skip('열 이름 줄을 못 찾음'); continue }

    if (kind === '출고') {
      // 같은 날짜 시트(예: '11.10'과 '11.10 (인바)')는 이어 붙이므로 id 번호를 이어 간다
      const list = parseOutboundSheet(grid, baseDate, now, result.outbound.filter((x) => x.baseDate === baseDate).length)
      result.outbound.push(...list)
      result.sheets.push({ kind, sheetName, baseDate, status: 'ok', count: list.length })
    } else {
      const port: Port = kind === '입고-북항' ? '북항' : '신항'
      const list = parseInboundSheet(grid, port, baseDate, now)
      result.inbound.push(...list)
      result.sheets.push({ kind, sheetName, baseDate, status: 'ok', count: list.length })
    }
  }
  if (dispatch) attachDispatch(result, dispatch.sheetName, dispatch.lines)
  return result
}

/** 배차 시트에는 날짜가 없다: 파일의 가장 최근 출고 날짜 것으로 본다. 배차에 없는 건은 이미 나간 당착(차량 없음). */
function attachDispatch(result: ParseResult, sheetName: string, lines: string[]) {
  const baseDate = result.outbound.map((o) => o.baseDate).sort().at(-1)
  if (!baseDate) return
  const day = result.outbound.filter((o) => o.baseDate === baseDate)
  const { bySeq, problems } = parseDispatch(lines, baseDate)
  for (const o of day) o.dispatch = (o.seq !== null && bySeq.get(o.seq)) || { line: 0, arrive: null, vehicles: '', note: null, invar: false }
  const seqs = new Set(day.map((o) => o.seq))
  for (const s of bySeq.keys()) if (!seqs.has(s)) problems.push(`순번 ${s} 출고에 없음`)
  const count = day.filter((o) => o.dispatch!.vehicles).length
  result.sheets.push({ kind: null, sheetName, baseDate, status: 'ok', count, message: problems.join(', ') || undefined })
}
