import { expect, test } from 'vitest'
import { parseDispatch } from '../src/parsers/dispatch'

const lines = [
  '당착',
  '1 : 11TX1 (부산 - 테스트A)',
  '2, 3 : 5TX1',
  '11월 11일 도착',
  '4 : 1TX1 (광양 - 테스트B)',
  '12 ~ 14, 30 : 11TX1',
  '20, 31 : TRTX1',
  '3 ~ 5 : 8TX1, 5TX1 (인바/09시)',
  '11월 11일 도착 (인바)',
  '21, 22 : 11TX2 (09시)',
  '25 : 1TX1 (해양/14시)',
  '아무 말',
]

test('머리줄은 도착일(당착=null), 줄마다 순번·차량·비고', () => {
  const { bySeq } = parseDispatch(lines, '2026-11-10')
  expect(bySeq.get(1)).toEqual({ line: 1, arrive: null, vehicles: '11T×1', note: '부산 - 테스트A', invar: false })
  expect(bySeq.get(2)).toEqual({ line: 2, arrive: null, vehicles: '5T×1', note: null, invar: false })
  expect(bySeq.get(4)?.arrive).toBe('2026-11-11')
})
test('순번 범위·나열 섞기, 트레일러, 여러 차량', () => {
  const { bySeq } = parseDispatch(lines, '2026-11-10')
  expect([12, 13, 14, 30].map((s) => bySeq.get(s)?.vehicles)).toEqual(['11T×1', '11T×1', '11T×1', '11T×1'])
  expect(bySeq.get(31)?.vehicles).toBe('TR×1')
  expect(bySeq.get(5)?.vehicles).toBe('8T×1 · 5T×1')
})
test('인바는 INVAR(머리줄 또는 비고), 해양 등 자재 이름은 비고에서 뺀다', () => {
  const { bySeq } = parseDispatch(lines, '2026-11-10')
  expect(bySeq.get(5)).toMatchObject({ invar: true, note: '09시' })
  expect(bySeq.get(21)).toMatchObject({ invar: true, note: '09시', vehicles: '11T×2' })
  expect(bySeq.get(25)).toMatchObject({ invar: true, note: '14시' })
})
test('두 번 나온 순번·읽지 못한 줄은 문제로 알려 준다(나중 줄이 이긴다)', () => {
  const { bySeq, problems } = parseDispatch(lines, '2026-11-10')
  expect(bySeq.get(3)?.line).toBe(6)
  expect(problems).toEqual(['순번 3 두 번 나옴', '순번 4 두 번 나옴', '읽지 못한 줄: 아무 말'])
})
test('도착 월이 기준월보다 많이 작으면 다음 해(12월 → 1월)', () => {
  expect(parseDispatch(['1월 2일 도착', '1 : 1TX1'], '2026-12-31').bySeq.get(1)?.arrive).toBe('2027-01-02')
})

test("차종 뒤 T 없이 쓴 줄도 읽는다: 'TRX4' → TR×4, 'LBX2' → LB×2", () => {
  const { bySeq, problems } = parseDispatch(['당착', '6, 7 : TRX4 (울산 - 테스트공장 / 25T)', '14 : LBX2 (보트/6650X2350X3250)'], '2026-11-11')
  expect(problems).toEqual([])
  expect(bySeq.get(6)).toMatchObject({ vehicles: 'TR×4', note: '울산 - 테스트공장 · 25T' })
  expect(bySeq.get(7)?.vehicles).toBe('TR×4')
  expect(bySeq.get(14)).toMatchObject({ vehicles: 'LB×2', note: '보트 · 6650X2350X3250' })
})

test('차량 없이 글만 쓴 순번 줄은 그 순번 배차 줄의 비고로 붙인다(배차 없는 순번이면 문제로)', () => {
  const { bySeq, problems } = parseDispatch(['당착', '21 : 오출고 테스트 같이 상차', '20, 21 : 11TX1 (부산 - 테스트A)', '9 : 아무 메모'], '2026-11-13')
  expect(bySeq.get(20)).toMatchObject({ vehicles: '11T×1', note: '부산 - 테스트A · 21번 오출고 테스트 같이 상차' })
  expect(bySeq.get(21)).toBe(bySeq.get(20))
  expect(problems).toEqual(['읽지 못한 줄: 9 : 아무 메모'])
})
