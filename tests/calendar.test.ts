import { expect, test } from 'vitest'
import { cellSummary, monthBounds, monthGrid, monthOf, normalizeName, shiftMonth } from '../src/vacation/calendar'

test('monthGrid 2026-11: 일요일 시작, 5주, 30일', () => {
  const g = monthGrid('2026-11')
  expect(g.length).toBe(5)
  expect(g.every((w) => w.length === 7)).toBe(true)
  expect(g[0][0]).toBe('2026-11-01')
  expect(g[4].filter(Boolean).at(-1)).toBe('2026-11-30')
  expect(g[4].slice(2).every((d) => d === null)).toBe(true)
})
test('monthGrid 2026-02(28일, 일요일 시작)은 4주, 2028-02(윤년)는 29일', () => {
  expect(monthGrid('2026-02').length).toBe(4)
  expect(monthGrid('2028-02').flat().filter(Boolean).at(-1)).toBe('2028-02-29')
})
test('monthGrid 2026-08: 1일이 토요일이면 앞 6칸이 비고 6주', () => {
  const g = monthGrid('2026-08')
  expect(g[0].slice(0, 6)).toEqual([null, null, null, null, null, null])
  expect(g[0][6]).toBe('2026-08-01')
  expect(g.length).toBe(6)
})
test('shiftMonth: 해 넘김', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  expect(shiftMonth('2026-01', -1)).toBe('2025-12')
})
test('monthOf, monthBounds', () => {
  expect(monthOf('2026-11-06')).toBe('2026-11')
  expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
})
test('normalizeName: 앞뒤 공백만 제거, 빈 값·21자는 null', () => {
  expect(normalizeName('  김 OO ')).toBe('김 OO')
  expect(normalizeName('   ')).toBeNull()
  expect(normalizeName('가'.repeat(20))).toBe('가'.repeat(20))
  expect(normalizeName('가'.repeat(21))).toBeNull()
})
test('cellSummary: 3명까지, 나머지는 more', () => {
  expect(cellSummary([])).toEqual({ shown: [], more: 0 })
  expect(cellSummary(['A', 'B', 'C'])).toEqual({ shown: ['A', 'B', 'C'], more: 0 })
  expect(cellSummary(['A', 'B', 'C', 'D', 'E'])).toEqual({ shown: ['A', 'B', 'C'], more: 2 })
})
