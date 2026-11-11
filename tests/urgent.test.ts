import { expect, test } from 'vitest'
import { isUrgent } from '../src/lib/urgent'

test('비고에 긴급이 들어 있으면 긴급건', () => {
  expect(isUrgent('긴급 반출')).toBe(true)
  expect(isUrgent('오전 긴급건')).toBe(true)
  expect(isUrgent('일반')).toBe(false)
  expect(isUrgent(null)).toBe(false)
})

import { needsInspection } from '../src/lib/urgent'
test("출하요청서 '입고 검수 일자'에 대기가 있으면 검사필요", () => {
  expect(needsInspection({ inspectedDate: null, raw: { 입고검수일자: '검수대기' } })).toBe(true)
  expect(needsInspection({ inspectedDate: null, raw: { 입고검수일자: '대기' } })).toBe(true)
  expect(needsInspection({ inspectedDate: '2026-11-01', raw: {} })).toBe(false)
  expect(needsInspection({ inspectedDate: null, raw: { 입고검수일자: '-' } })).toBe(false)
})
test('RI에서 완료한 B/L은 엑셀이 대기여도 검사필요가 아니다', () => {
  const x = { inspectedDate: null, raw: { 입고검수일자: '대기' }, bl: 'BL1' }
  expect(needsInspection(x, new Set(['BL1']))).toBe(false)
  expect(needsInspection(x, new Set(['BL2']))).toBe(true)
  expect(needsInspection({ ...x, bl: null }, new Set(['BL1']))).toBe(true)
})
