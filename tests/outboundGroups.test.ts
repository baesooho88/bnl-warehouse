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

import { groupByDispatch } from '../src/lib/outboundGroups'
const dp = (line: number, arrive: string | null, vehicles: string, invar = false, note: string | null = null) => ({ line, arrive, vehicles, note, invar })

test('배차 묶음: 도착일 구역(당착 먼저, INVAR는 같은 날 뒤) 안에 차량 줄 순서대로', () => {
  const s = groupByDispatch([
    o({ seq: 21, weightKg: 100, dispatch: dp(5, '2026-11-11', '11T×2', true) }),
    o({ seq: 4, weightKg: 300, dispatch: dp(3, '2026-11-11', '1T×1', false, '광양 - 테스트') }),
    o({ seq: 9, dispatch: dp(0, null, '') }),
    o({ seq: 2, weightKg: 200, dispatch: dp(2, null, '5T×1') }),
    o({ seq: 3, weightKg: 50, dispatch: dp(2, null, '5T×1') }),
  ])
  expect(s.map((x) => [x.arrive, x.invar])).toEqual([[null, false], ['2026-11-11', false], ['2026-11-11', true]])
  expect(s[0].groups.map((g) => [g.vehicles, g.items.map((i) => i.seq), g.weightKg])).toEqual([['5T×1', [2, 3], 250], ['', [9], 0]])
  expect(s[1].groups[0]).toMatchObject({ vehicles: '1T×1', note: '광양 - 테스트' })
})

import { seqLabel } from '../src/lib/outboundGroups'
test('seqLabel: 이어지는 순번은 범위로', () => {
  expect(seqLabel([1])).toBe('1')
  expect(seqLabel([2, 3])).toBe('2, 3')
  expect(seqLabel([12, 13, 14, 15, 16, 17, 18, 19, 30])).toBe('12~19, 30')
  expect(seqLabel([31, 20, 21])).toBe('20, 21, 31')
  expect(seqLabel([])).toBe('')
})

import { vehicleChips } from '../src/lib/outboundGroups'
test('vehicleChips: 톤수별 모양(픽업·화물차·대형)과 색', () => {
  expect(vehicleChips('8T×1 · 5T×1')).toEqual([{ label: '8T×1', icon: '🚚', tone: 't8' }, { label: '5T×1', icon: '🚚', tone: 't5' }])
  expect(vehicleChips('1T×1')).toEqual([{ label: '1T×1', icon: '🛻', tone: 't1' }])
  expect(vehicleChips('11T×2 · 25T×1 · TR×1').map((c) => [c.icon, c.tone])).toEqual([['🚛', 't11'], ['🚛', 't25'], ['🚛', 'ttr']])
  expect(vehicleChips('3.5T×1')[0]).toEqual({ label: '3.5T×1', icon: '🚚', tone: 't5' })
  expect(vehicleChips('')).toEqual([])
})
