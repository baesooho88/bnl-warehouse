import { expect, test } from 'vitest'
import type { Outbound } from '../src/domain/types'
import { groupOutbound } from '../src/lib/outboundGroups'

let n = 0
const o = (p: Partial<Outbound>): Outbound => ({
  id: `o${n++}`, baseDate: '2026-11-05', seq: null, center: null, bnlInDate: null, bl: null, hull: null, po: null, item: null,
  qtyText: null, qtyRequested: null, qtyTotal: null, weightKg: null, cbm: null, boxNo: null, destination: null, gateTime: null,
  memo: null, inspectedDate: null, requester: null, arriveDate: null, location: null, sameDay: false, raw: {}, ...p,
})

test('도착지별로 묶고 건수·중량 합계·당일착 수를 센다', () => {
  const g = groupOutbound([
    o({ destination: '가', weightKg: 1000, gateTime: '10:00' }),
    o({ destination: '가', weightKg: 500, gateTime: '09:00', sameDay: true }),
    o({ destination: '나', weightKg: null, gateTime: '08:00' }),
  ])
  expect(g.map((x) => [x.destination, x.items.length, x.weightKg, x.sameDay])).toEqual([['가', 2, 1500, 1], ['나', 1, 0, 0]])
})
test('그룹 순서: 당일착 있는 도착지 먼저, 그다음 가장 이른 게이트 시간', () => {
  const g = groupOutbound([
    o({ destination: '늦음', gateTime: '13:00' }),
    o({ destination: '이름', gateTime: '07:30' }),
    o({ destination: '당일', gateTime: '15:00', sameDay: true }),
  ])
  expect(g.map((x) => x.destination)).toEqual(['당일', '이름', '늦음'])
})
test('그룹 안: 당일착 먼저, 그다음 게이트 시간, 시간 없으면 뒤', () => {
  const g = groupOutbound([
    o({ destination: '가', gateTime: null, item: 'C' }),
    o({ destination: '가', gateTime: '09:00', item: 'B' }),
    o({ destination: '가', gateTime: '11:00', item: 'A', sameDay: true }),
  ])
  expect(g[0].items.map((x) => x.item)).toEqual(['A', 'B', 'C'])
})
test('도착지 없거나 공백이면 "도착지 없음"으로 묶는다', () => {
  const g = groupOutbound([o({ destination: null }), o({ destination: '  ' })])
  expect(g.map((x) => [x.destination, x.items.length])).toEqual([['도착지 없음', 2]])
})
test('빈 목록', () => {
  expect(groupOutbound([])).toEqual([])
})
test('당일착 도착지끼리는 그룹 전체에서 가장 이른 게이트 시간 순', () => {
  const g = groupOutbound([
    o({ destination: 'Y', gateTime: '10:00', sameDay: true }),
    o({ destination: 'X', gateTime: '15:00', sameDay: true }),
    o({ destination: 'X', gateTime: '07:00' }),
  ])
  expect(g.map((x) => x.destination)).toEqual(['X', 'Y'])
})
