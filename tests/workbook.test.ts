import * as XLSX from 'xlsx'
import { describe, expect, test } from 'vitest'
import { parseWorkbook } from '../src/parsers/workbook'
import { fixtureBytes, readFixture } from './helpers/fixtures'

const now = new Date(2026, 10, 5)
const toBytes = (wb: XLSX.WorkBook) => new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))

describe('parseWorkbook', () => {
  test('신항: 누적 파일의 4개 시트가 모두 하루치로', () => {
    const r = parseWorkbook(fixtureBytes('sinhang'), 'sinhang.xlsx', now)
    expect(r.sheets.map((s) => [s.status, s.kind, s.baseDate])).toEqual([
      ['ok', '입고-신항', '2026-11-02'], ['ok', '입고-신항', '2026-11-03'],
      ['ok', '입고-신항', '2026-11-04'], ['ok', '입고-신항', '2026-11-05'],
    ])
    expect(r.inbound).toHaveLength(7)
    expect(r.outbound).toEqual([])
  })

  test('출고: 각 건의 기준일은 시트 날짜', () => {
    const r = parseWorkbook(fixtureBytes('outbound'), 'outbound.xlsx', now)
    expect(r.sheets.every((s) => s.status === 'ok' && s.kind === '출고')).toBe(true)
    const bySheet = new Map(r.sheets.map((s) => [s.baseDate, s.count]))
    for (const [date, count] of bySheet) expect(r.outbound.filter((o) => o.baseDate === date)).toHaveLength(count)
  })

  test('북항: 시트 안의 2025 오타와 무관하게 2026', () => {
    const r = parseWorkbook(fixtureBytes('bukhang'), 'bukhang.xlsx', now)
    expect(r.inbound.length).toBeGreaterThan(0)
    expect(r.inbound.every((x) => x.baseDate.startsWith('2026-'))).toBe(true)
  })

  test('모르는 양식 시트는 건너뛴다', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['아무 제목']]), '11.5')
    const r = parseWorkbook(toBytes(wb), 'x.xlsx', now)
    expect(r.sheets[0]).toMatchObject({ status: 'skipped', message: '알 수 없는 양식', count: 0 })
    expect(r.inbound).toEqual([])
    expect(r.outbound).toEqual([])
  })

  test('날짜가 아닌 시트 이름은 그 시트만 건너뛴다', () => {
    const wb = readFixture('sinhang')
    XLSX.utils.book_append_sheet(wb, wb.Sheets['11.5'], 'Sheet1')
    const r = parseWorkbook(toBytes(wb), 'x.xlsx', now)
    expect(r.sheets.filter((s) => s.status === 'ok')).toHaveLength(4)
    expect(r.sheets.find((s) => s.sheetName === 'Sheet1')).toMatchObject({ status: 'skipped', message: '시트 이름에서 날짜를 읽지 못함' })
  })

  test('열 이름 줄이 없으면 그 시트만 건너뛴다', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['일일출하요청서'], ['x']]), '11.5')
    expect(parseWorkbook(toBytes(wb), 'x.xlsx', now).sheets[0]).toMatchObject({ status: 'skipped', message: '열 이름 줄을 못 찾음' })
  })
})

// 2026-11 이후 양식: 열 이름이 짧아지고, 특수 자재는 같은 날짜의 '(인바)' 시트로 따로 온다
const newFormatSheet = (rows: (string | number)[][]) => XLSX.utils.aoa_to_sheet([
  ['일일출하요청서'],
  [null, '11/10', null, null, null, null, null, null, null, null, null, '당일착(도착일):', null, '11/10'],
  [null, '센터', '입하', 'BL No', '호선', 'PO', '품명', '수량', '중량', '용적', 'BOX NO', '도착지', '입문', 'MEMO', '검수', '신청자명', '도착', 'Location'],
  ...rows.map((r) => [r[0], 'BNL', '2026-10-01', `BL${r[0]}`, '1234', 'PO1', r[1], '1/2', '100', '1', 'B1', r[2], r[3], '', '-', '테스트', r[4], 'LOC']),
])

describe('새 양식(2026-11~)', () => {
  test('짧아진 열 이름도 읽는다: 도착지·입문·도착·수량', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, newFormatSheet([[1, '품목A', '테스트도착지', '09시', '2026-11-11']]), '11.10')
    const [o] = parseWorkbook(toBytes(wb), 'x.xlsx', now).outbound
    expect(o).toMatchObject({ seq: 1, destination: '테스트도착지', gateTime: '09시', arriveDate: '2026-11-11', qtyText: '1/2', sameDay: false })
  })
  test("'11.10 (인바)' 시트도 11.10으로 읽고, 같은 날짜 시트끼리 id가 겹치지 않는다", () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, newFormatSheet([[1, '품목A', '가', '09시', '2026-11-11'], [2, '품목B', '가', '10시', '2026-11-11']]), '11.10')
    XLSX.utils.book_append_sheet(wb, newFormatSheet([[21, 'INVAR PLATE', '나', '09시', '2026-11-11']]), '11.10 (인바)')
    const r = parseWorkbook(toBytes(wb), 'x.xlsx', now)
    expect(r.sheets.map((s) => [s.status, s.baseDate])).toEqual([['ok', '2026-11-10'], ['ok', '2026-11-10']])
    expect(r.outbound.map((o) => o.seq)).toEqual([1, 2, 21])
    expect(new Set(r.outbound.map((o) => o.id)).size).toBe(3)
  })
})
