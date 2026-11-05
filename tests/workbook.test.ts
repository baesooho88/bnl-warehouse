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
