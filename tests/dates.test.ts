import { expect, test } from 'vitest'
import { addDays, daysBetween, formatDay, formatMD, monthRange, todayIso, weekRange } from '../src/lib/dates'

const now = new Date(2026, 10, 5) // 목요일

test('표시 형식', () => {
  expect(formatMD('2026-11-05')).toBe('11.5')
  expect(formatDay('2026-11-05')).toBe('11.5 (목)')
  expect(formatDay('2026-11-08')).toBe('11.8 (일)')
})

test('날짜 계산', () => {
  expect(todayIso(now)).toBe('2026-11-05')
  expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
  expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  expect(daysBetween('2026-11-02', '2026-11-04')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
})

test('이번 주(월~일)와 이번 달', () => {
  expect(weekRange(now)).toEqual({ from: '2026-11-02', to: '2026-11-08' })
  expect(weekRange(new Date(2026, 10, 8))).toEqual({ from: '2026-11-02', to: '2026-11-08' }) // 일요일
  expect(monthRange(now)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  expect(monthRange(new Date(2028, 1, 10))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
})
