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

test('null 중량·CBM은 0으로 합산(NaN 없음), 당일착 수', () => {
  const s = computeStats({ inbound: [], outbound: [out({ weightKg: null, cbm: 1.5, sameDay: true }), out({ weightKg: 1000, cbm: null })] }, '2026-11-03', '2026-11-03')
  expect(s.outbound).toEqual({ count: 2, weightKg: 1000, cbm: 1.5, sameDay: 1 })
})

test('항구별 입고 합계(중량·CBM)와 컨테이너 수', () => {
  const containers = Array.from({ length: 14 }, (_, i) => ({ no: `C${i}`, type: null }))
  const s = computeStats({ inbound: [inb({ weightKg: 231667, cbm: 40.25, containers }), inb({ port: '북항', weightKg: 10 })], outbound: [] }, '2026-11-03', '2026-11-03')
  expect(s.inbound['신항']).toEqual({ count: 1, weightKg: 231667, cbm: 40.25, containers: 14 })
  expect(s.inbound['북항']).toEqual({ count: 1, weightKg: 10, cbm: 0, containers: 0 })
})

test('일별: 데이터 없는 날도 0, 건수·중량·CBM 모두', () => {
  const s = computeStats({ inbound: [inb({ weightKg: 500, cbm: 2 })], outbound: [out({ cbm: 1 }), out({ weightKg: 300 })] }, '2026-11-02', '2026-11-04')
  const z = { count: 0, weightKg: 0, cbm: 0 }
  expect(s.daily).toEqual([
    { date: '2026-11-02', inbound: z, outbound: z },
    { date: '2026-11-03', inbound: { count: 1, weightKg: 500, cbm: 2 }, outbound: { count: 2, weightKg: 300, cbm: 1 } },
    { date: '2026-11-04', inbound: z, outbound: z },
  ])
})

test('상위 5: 호선(입고+출고), 출고 도착지, null 제외, CBM 합계', () => {
  const outs = Array.from({ length: 11 }, (_, i) => out({ hull: `H${i}`, destination: i < 3 ? 'A안벽' : null, cbm: 2 }))
  const s = computeStats({ inbound: [inb({ hull: 'H0', cbm: 1 })], outbound: [...outs, out({ hull: null })] }, '2026-11-03', '2026-11-03')
  expect(s.topHulls).toHaveLength(5)
  expect(s.topHulls[0]).toEqual({ name: 'H0', count: 2, cbm: 3 })
  expect(s.topDestinations).toEqual([{ name: 'A안벽', count: 3, cbm: 6 }])
})
