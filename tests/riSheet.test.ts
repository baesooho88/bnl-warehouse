import * as XLSX from 'xlsx'
import { expect, test } from 'vitest'
import { parseRiWorkbook, riQty, riWms } from '../src/parsers/ri'

const H = ['B/L No.', 'P/O No.', 'Hull No.', '검수량', 'Description.', 'WMS\nLocation', 'PRESERVATION', null, 'BOX no.', 'RI 준비 위치', '비고']
const SUB = [null, null, null, null, null, null, '작업필요', 'REPORT', null, null, null]
const merged = (r: number) => ({ s: { r, c: 0 }, e: { r, c: 10 } })

// 실제 작업표와 같은 모양(가짜 값): 위에 빈 표·지난 제목, 날짜 줄, 두 줄짜리 열 이름, 병합 셀
const book = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    H, SUB, [], ['( 11/06일 ) 오후 상차 예정인 출고예정 자재 정보'], ['2026.11.10 (화)'], H, SUB,
    ['TESTBL0001', 'O.F.E', '1001', '전량[1]\n중 1Box', '테스트 장비', 'M0101', null, null, 'ALL', '1-D', '선주 입회검사'],
    ['TESTBL0002', '4000000001', '1002', '전량[3]\n중 3Box', '테스트 펌프', '2-A(2)\n8-D(1)', 'Y', null, '2 BOX', '0-E', '해체완료 / 검사대기'],
    [], ['*특이사항'],
  ])
  ws['!merges'] = [merged(3), merged(4), merged(10), { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 5, c: 0 }, e: { r: 6, c: 0 } }, { s: { r: 5, c: 6 }, e: { r: 5, c: 7 } }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
}

test('RI 작업표: 날짜는 파일 이름, 제목·빈 줄·열 이름 줄은 건너뛴다', () => {
  const r = parseRiWorkbook(book(), 'RI 준비자재(2026.11.11).xlsx')
  expect(r).toMatchObject({ date: '2026-11-11' })
  if (!r || 'error' in r) throw new Error('파싱 실패')
  expect(r.items).toEqual([
    { baseDate: '2026-11-11', idx: 0, bl: 'TESTBL0001', po: 'O.F.E', hull: '1001', qtyText: '전량[1]\n중 1Box', item: '테스트 장비', wms: 'M0101', presWork: null, presReport: null, box: 'ALL', riLocation: '1-D', note: '선주 입회검사' },
    { baseDate: '2026-11-11', idx: 1, bl: 'TESTBL0002', po: '4000000001', hull: '1002', qtyText: '전량[3]\n중 3Box', item: '테스트 펌프', wms: '2-A(2)\n8-D(1)', presWork: 'Y', presReport: null, box: '2 BOX', riLocation: '0-E', note: '해체완료 / 검사대기' },
  ])
})

test('RI 작업표가 아니면 null, 파일 이름에 날짜가 없으면 오류', () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['일일출하요청서']]), '11.5')
  expect(parseRiWorkbook(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), 'x.xlsx')).toBeNull()
  expect(parseRiWorkbook(book(), 'RI 준비자재.xlsx')).toEqual({ error: '파일 이름에서 날짜를 읽지 못했어요 (예: RI 준비자재(2026.11.11))' })
})

test('표시용: 검수량은 "3/3 Box", WMS 위치는 칸마다', () => {
  expect(riQty('전량[3]\n중 3Box')).toBe('3/3 Box')
  expect(riQty('전량[26]\n중 1 BOX')).toBe('1/26 Box')
  expect(riQty('일부')).toBe('일부')
  expect(riWms('2-A(2)\n8-D(1)')).toEqual(['2-A ×2', '8-D ×1'])
  expect(riWms('M0101')).toEqual(['M0101'])
  expect(riWms(null)).toEqual([])
})
