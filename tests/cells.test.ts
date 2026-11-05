import { describe, expect, test } from 'vitest'
import { inferYear, normHeader, parseQty, toIsoDate, toNumber, toText } from '../src/parsers/cells'

const now = new Date(2026, 10, 5)

describe('normHeader', () => {
  test('공백·줄바꿈 제거와 대문자화', () => {
    expect(normHeader('선    명')).toBe('선명')
    expect(normHeader('물류센터명\n도착지')).toBe('물류센터명도착지')
    expect(normHeader('B/L NO.  ')).toBe('B/LNO.')
    expect(normHeader('BL No')).toBe('BLNO')
    expect(normHeader(null)).toBe('')
  })
})

describe('toText', () => {
  test('trim 후 빈 문자열은 null', () => {
    expect(toText('  HPNT  ')).toBe('HPNT')
    expect(toText('   ')).toBeNull()
    expect(toText(null)).toBeNull()
    expect(toText(2370)).toBe('2370')
  })
})

describe('toNumber', () => {
  test('콤마 숫자, 하이픈, 빈칸, 숫자', () => {
    expect(toNumber('3,482.6')).toBe(3482.6)
    expect(toNumber('-')).toBeNull()
    expect(toNumber('')).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber(15560)).toBe(15560)
  })
})

describe('inferYear', () => {
  test('연초에 12월이면 전년도', () => {
    expect(inferYear(12, new Date(2027, 0, 3))).toBe(2026)
    expect(inferYear(11, now)).toBe(2026)
  })
})

describe('toIsoDate', () => {
  test('문자열 날짜', () => {
    expect(toIsoDate('2026-10-14', now)).toBe('2026-10-14')
    expect(toIsoDate('2026.11.2', now)).toBe('2026-11-02')
  })
  test('M월 D일은 업로드 시점 기준 연도', () => {
    expect(toIsoDate('10월 31일', now)).toBe('2026-10-31')
    expect(toIsoDate('12월 30일', new Date(2027, 0, 3))).toBe('2026-12-30')
  })
  test('M월 D일에 notAfter가 있으면 그 날짜보다 미래가 되지 않는다', () => {
    expect(toIsoDate('10월 31일', now, '2026-11-02')).toBe('2026-10-31')
    expect(toIsoDate('12월 30일', new Date(2027, 6, 1), '2027-01-03')).toBe('2026-12-30')
  })
  test('엑셀 시리얼 숫자', () => {
    expect(toIsoDate(46328, now)).toBe('2026-11-02')
  })
  test('해석할 수 없으면 null', () => {
    expect(toIsoDate('-', now)).toBeNull()
    expect(toIsoDate(null, now)).toBeNull()
  })
})

describe('parseQty', () => {
  test('요청/전체 형식', () => {
    expect(parseQty('11/22')).toEqual({ text: '11/22', requested: 11, total: 22 })
  })
  test('다른 형식은 원문만', () => {
    expect(parseQty('1식')).toEqual({ text: '1식', requested: null, total: null })
    expect(parseQty(null)).toEqual({ text: null, requested: null, total: null })
  })
})
