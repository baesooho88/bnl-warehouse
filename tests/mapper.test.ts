import { describe, expect, test } from 'vitest'
import { parseWorkbook } from '../src/parsers/workbook'
import { fromInboundRow, fromOutboundRow, toInboundRow, toOutboundRow } from '../src/storage/cloud/mapper'
import { fixtureBytes } from './helpers/fixtures'

const now = new Date(2026, 10, 5)
const all = (['bukhang', 'sinhang', 'outbound'] as const).map((n) => parseWorkbook(fixtureBytes(n), n, now))
const inbound = all.flatMap((r) => r.inbound)
const outbound = all.flatMap((r) => r.outbound)

describe('mapper', () => {
  test('입고: 왕복 변환해도 같다', () => {
    expect(inbound.length).toBeGreaterThan(0)
    for (const x of inbound) expect(fromInboundRow(toInboundRow(x))).toEqual(x)
  })

  test('출고: 왕복 변환해도 같다', () => {
    expect(outbound.length).toBeGreaterThan(0)
    for (const x of outbound) expect(fromOutboundRow(toOutboundRow(x))).toEqual(x)
  })

  test('DB 행은 snake_case 열 이름만 쓴다', () => {
    const row = toInboundRow(inbound[0]) as unknown as Record<string, unknown>
    expect(Object.keys(row)).toEqual(expect.arrayContaining(['base_date', 'weight_kg', 'arrival_date', 'containers', 'raw']))
    expect(Object.keys(row).some((k) => /[A-Z]/.test(k))).toBe(false)
    const out = toOutboundRow(outbound[0]) as unknown as Record<string, unknown>
    expect(Object.keys(out)).toEqual(expect.arrayContaining(['qty_requested', 'same_day', 'arrive_date', 'bnl_in_date']))
    expect(Object.keys(out).some((k) => /[A-Z]/.test(k))).toBe(false)
  })

  test('DB의 null은 null로 돌아온다', () => {
    const row = { ...toOutboundRow(outbound[0]), qty_requested: null }
    expect(fromOutboundRow(row).qtyRequested).toBeNull()
  })
})
