import type { CellValue, Inbound, Port } from '../domain/types'
import { findHeaderRow } from './grid'
import { rowReader } from './rowReader'

export function parseInboundSheet(grid: CellValue[][], port: Port, baseDate: string, now: Date): Inbound[] {
  const h = findHeaderRow(grid)
  if (h < 0) return []
  const read = rowReader(grid[h], now)
  const result: Inbound[] = []

  for (const row of grid.slice(h + 1)) {
    const r = read(row)
    const bl = r.text(['B/LNO.'])
    const item = r.text(['품명'])
    const contNo = r.text(["CONT'RNO."])
    const container = contNo ? { no: contNo, type: r.text(['구분']) } : null
    const note = r.text(['비고'])
    const prev = result[result.length - 1]

    if (!bl && !item) {
      // 병합되지 않은 컨테이너 전용 행 → 직전 건에 붙인다 (신항 11.3 사례)
      if (container && prev) appendTo(prev, container, note)
      continue
    }
    if (prev && bl === prev.bl && item === prev.item) {
      appendTo(prev, container, note)
      continue
    }
    result.push({
      id: `${port}|${baseDate}|${result.length}`,
      port,
      baseDate,
      arrivalDate: r.date('입항일', ['입항일'], baseDate),
      vessel: r.text(['선명', '선(기)명']),
      bl: bl ?? '',
      item,
      qty: r.num('수량', ['수량']),
      weightKg: r.num('중량', ['중량']),
      cbm: r.num('용적', ['용적']),
      hull: r.text(['호선']),
      po: r.text(['P.ONO.']),
      terminal: r.text(['부두및창고']),
      containers: container ? [container] : [],
      destination: r.text(['도착지']),
      note,
      raw: r.raw,
    })
  }
  return result
}

function appendTo(target: Inbound, container: Inbound['containers'][number] | null, note: string | null) {
  if (container) target.containers.push(container)
  if (note && !(target.note ?? '').includes(note)) target.note = target.note ? `${target.note} / ${note}` : note
}
