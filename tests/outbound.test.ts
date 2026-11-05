import { describe, expect, test } from 'vitest'
import { sheetToGrid } from '../src/parsers/grid'
import { parseOutboundSheet } from '../src/parsers/outbound'
import { readFixture } from './helpers/fixtures'

const now = new Date(2026, 10, 5)
const sheet = (name: string) => sheetToGrid(readFixture('outbound').Sheets[name])

describe('parseOutboundSheet', () => {
  test('11.5 첫 건: 요청수량 분해, 다음날 도착', () => {
    const it = parseOutboundSheet(sheet('11.5'), '2026-11-05', now)[0]
    expect(it).toMatchObject({
      id: '출고|2026-11-05|0', baseDate: '2026-11-05', seq: 1, center: 'BNL', bl: 'SFSS26091021',
      qtyText: '11/22', qtyRequested: 11, qtyTotal: 22, weightKg: 3482.6, destination: '(주)한국야나세',
      gateTime: '10시', arriveDate: '2026-11-06', bnlInDate: '2026-10-07', sameDay: false,
    })
    expect(it.memo).toContain('010-0000-0000')
  })

  test('11.4 첫 건: 당일착, 검수일자 "-"는 null', () => {
    const it = parseOutboundSheet(sheet('11.4'), '2026-11-04', now)[0]
    expect(it).toMatchObject({ item: 'INVAR PLATE', arriveDate: '2026-11-04', sameDay: true, inspectedDate: null })
    expect(it.raw['입고검수일자']).toBe('-')
  })

  test('빈 행은 제외하고 순번 순서를 유지', () => {
    const list = parseOutboundSheet(sheet('11.5'), '2026-11-05', now)
    expect(list.length).toBeGreaterThan(10)
    expect(list.every((x) => x.bl || x.item)).toBe(true)
    expect(list.map((x) => x.seq).slice(0, 3)).toEqual([1, 2, 3])
  })
})
