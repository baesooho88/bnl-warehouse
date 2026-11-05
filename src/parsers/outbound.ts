import type { CellValue, Outbound } from '../domain/types'
import { parseQty, toNumber, toText } from './cells'
import { findHeaderRow } from './grid'
import { rowReader } from './rowReader'

export function parseOutboundSheet(grid: CellValue[][], baseDate: string, now: Date): Outbound[] {
  const h = findHeaderRow(grid)
  if (h < 0) return []
  const read = rowReader(grid[h], now)
  const seqFromFirstColumn = toText(grid[h][0]) === null // 순번 열은 열 이름이 비어 있다
  const result: Outbound[] = []

  for (const row of grid.slice(h + 1)) {
    const r = read(row)
    const bl = r.text(['BLNO'])
    const item = r.text(['품명'])
    if (!bl && !item) continue

    const qty = parseQty(r.cell(['요청수량']))
    const gateTime = r.text(['입문시간'])
    const arriveDate = r.date('도착요청일자', ['도착요청일자'])
    result.push({
      id: `출고|${baseDate}|${result.length}`,
      baseDate,
      seq: seqFromFirstColumn ? toNumber(row[0] ?? null) : null,
      center: r.text(['센터']),
      bnlInDate: r.date('BNL입하일자', ['BNL입하일자']),
      bl,
      hull: r.text(['호선']),
      po: r.text(['PO']),
      item,
      qtyText: qty.text,
      qtyRequested: qty.requested,
      qtyTotal: qty.total,
      weightKg: r.num('중량', ['중량']),
      cbm: r.num('용적', ['용적']),
      boxNo: r.text(['BOXNO']),
      destination: r.text(['물류센터명도착지']),
      gateTime,
      memo: r.text(['MEMO']),
      inspectedDate: r.date('입고검수일자', ['입고검수일자']),
      requester: r.text(['신청자명']),
      arriveDate,
      location: r.text(['LOCATION']),
      sameDay: (gateTime?.includes('당착') ?? false) || arriveDate === baseDate,
      raw: r.raw,
    })
  }
  return result
}
