import * as XLSX from 'xlsx'
import { describe, expect, test } from 'vitest'
import { detectKind, findHeaderRow, headerIndex, sheetBaseDate, sheetToGrid } from '../src/parsers/grid'
import { readFixture } from './helpers/fixtures'

const now = new Date(2026, 10, 5)

describe('sheetToGrid', () => {
  test('병합된 B/L 값이 아래 행까지 채워진다', () => {
    const grid = sheetToGrid(readFixture('sinhang').Sheets['11.5'])
    expect(grid[3][2]).toBe('PLISH7H51981')
    expect(grid[4][2]).toBe('PLISH7H51981')
    expect(grid[4][11]).toBe('TEMU1760600')
  })
})

describe('detectKind', () => {
  test('A1 제목으로 종류 판별', () => {
    expect(detectKind(sheetToGrid(readFixture('sinhang').Sheets['11.5']))).toBe('입고-신항')
    expect(detectKind(sheetToGrid(readFixture('bukhang').Sheets['11.5']))).toBe('입고-북항')
    expect(detectKind(sheetToGrid(readFixture('outbound').Sheets['11.5']))).toBe('출고')
  })
  test('모르는 양식은 null', () => {
    const grid = sheetToGrid(XLSX.utils.aoa_to_sheet([['아무 제목'], [], ['x']]))
    expect(detectKind(grid)).toBeNull()
    expect(findHeaderRow(grid)).toBe(-1)
  })
})

describe('findHeaderRow / headerIndex', () => {
  test('입고·출고 모두 3행(index 2)이 열 이름 줄', () => {
    const inGrid = sheetToGrid(readFixture('sinhang').Sheets['11.5'])
    const outGrid = sheetToGrid(readFixture('outbound').Sheets['11.5'])
    expect(findHeaderRow(inGrid)).toBe(2)
    expect(findHeaderRow(outGrid)).toBe(2)
    expect(headerIndex(inGrid[2]).get("CONT'RNO.")).toBe(11)
    expect(headerIndex(outGrid[2]).get('물류센터명도착지')).toBe(11)
  })
})

describe('sheetBaseDate', () => {
  test('M.D 시트 이름만 날짜로 읽는다', () => {
    expect(sheetBaseDate('11.5', now)).toBe('2026-11-05')
    expect(sheetBaseDate('11.5 ', now)).toBe('2026-11-05')
    expect(sheetBaseDate('Sheet1', now)).toBeNull()
    expect(sheetBaseDate('요약', now)).toBeNull()
  })
})
