import { expect, test } from 'vitest'
import type { Inbound, Outbound } from '../src/domain/types'
import { computeStats } from '../src/lib/stats'

const inb = (o: Partial<Inbound>): Inbound => ({
  id: 'x', port: '신항', baseDate: '2026-11-03', arrivalDate: null, vessel: null, bl: 'BL', item: null, qty: null,
  weightKg: null, cbm: null, hull: null, po: null, terminal: null, containers: [], destination: null, note: null, raw: {}, ...o,
})
const out = (o: Partial<Outbound>): Outbound => ({
  id: 'y', baseDate: '2026-11-03', seq: null, center: null, bnlInDate: null, bl: null, hull: null, po: null, item: null,
  qtyText: null, qtyRequested: null, qtyTotal: null, weightKg: null, cbm: null, boxNo: null, destination: null,
  gateTime: null, memo: null, inspectedDate: null, requester: null, arriveDate: null, location: null, sameDay: false, raw: {}, ...o,
})

test('null 중량은 0으로 합산(NaN 없음), 당일착 수', () => {
  const s = computeStats({ inbound: [], outbound: [out({ weightKg: null, sameDay: true }), out({ weightKg: 1000 })] }, '2026-11-03', '2026-11-03')
  expect(s.outbound).toEqual({ count: 2, weightKg: 1000, sameDay: 1 })
})

test('항구별 입고 합계와 컨테이너 수', () => {
  const containers = Array.from({ length: 14 }, (_, i) => ({ no: `C${i}`, type: null }))
  const s = computeStats({ inbound: [inb({ weightKg: 231667, containers }), inb({ port: '북항', weightKg: 10 })], outbound: [] }, '2026-11-03', '2026-11-03')
  expect(s.inbound['신항']).toEqual({ count: 1, weightKg: 231667, containers: 14 })
  expect(s.inbound['북항']).toEqual({ count: 1, weightKg: 10, containers: 0 })
})

test('일별 막대는 데이터 없는 날도 0으로 포함', () => {
  const s = computeStats({ inbound: [inb({})], outbound: [out({}), out({})] }, '2026-11-02', '2026-11-04')
  expect(s.daily).toEqual([
    { date: '2026-11-02', inbound: 0, outbound: 0 },
    { date: '2026-11-03', inbound: 1, outbound: 2 },
    { date: '2026-11-04', inbound: 0, outbound: 0 },
  ])
})

test('상위 10: 호선(입고+출고), 출고 도착지, null 제외', () => {
  const outs = Array.from({ length: 11 }, (_, i) => out({ hull: `H${i}`, destination: i < 3 ? 'A안벽' : null }))
  const s = computeStats({ inbound: [inb({ hull: 'H0' })], outbound: [...outs, out({ hull: null })] }, '2026-11-03', '2026-11-03')
  expect(s.topHulls).toHaveLength(10)
  expect(s.topHulls[0]).toEqual({ hull: 'H0', count: 2 })
  expect(s.topDestinations).toEqual([{ destination: 'A안벽', count: 3 }])
})
