import * as XLSX from 'xlsx'
import { expect, test } from 'vitest'
import { parseStockWorkbook } from '../src/parsers/stock'
import { searchStock } from '../src/stock/stock'

const H = ['No.', 'CHK', '화주', '입고번호', '입고일', 'B/L NO', '품명', 'BOX NO', 'BOX재고_수량', 'BOX재고중량', 'BOX재고용적', 'Location', '수입신고번호', '화물관리번호', 'PO No', 'Project No', '비고']
// 실제 재고 파일과 같은 모양(가짜 값): 맨 아래 합계 줄(Σ)은 B/L이 없다
const book = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    H,
    [1, 'F', '테스트화주', 'IN0001', '2026-09-02', 'TESTBL0001', 'TEST PUMP', '8(3392)', 1, 1417, 1.172, 'A1B2', 'CUS001', 'CRG001', '4000000001', 'P043', '역보세'],
    [2, 'F', '테스트화주', 'IN0002', '2026-11-06', 'TESTBL0002', 'TEST VALVE', '1', 3, 268, 1.83, 'C3D4', null, null, null, '2514', null],
    ['Σ', '', '', '', '', '', '', '', 4, 1685, 3.0, '', '', '', '', '', ''],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
}
const now = new Date('2026-11-13T09:00:00+09:00')

test('재고 파일: 날짜는 파일 이름(연도 없으면 올해), 합계 줄은 건너뛴다', () => {
  const r = parseStockWorkbook(book(), '11.12.xlsx', now)
  if (!r || 'error' in r) throw new Error('파싱 실패')
  expect(r.date).toBe('2026-11-12')
  expect(r.items).toHaveLength(2)
  expect(r.items[0]).toEqual({
    idx: 0, bl: 'TESTBL0001', item: 'TEST PUMP', box: '8(3392)', qty: 1, weightKg: 1417, cbm: 1.172, location: 'A1B2',
    inDate: '2026-09-02', inNo: 'IN0001', po: '4000000001', project: 'P043', customsNo: 'CUS001', cargoNo: 'CRG001', note: '역보세',
  })
  expect(parseStockWorkbook(book(), '재고.xlsx', now)).toEqual({ error: expect.any(String) })
})

test('재고 검색: 공백·대소문자 무시, 여러 칸 중 하나라도', () => {
  const r = parseStockWorkbook(book(), '2026.11.12.xlsx', now)
  if (!r || 'error' in r) throw new Error('파싱 실패')
  expect(searchStock(r.items, ' test valve ').map((x) => x.bl)).toEqual(['TESTBL0002'])
  expect(searchStock(r.items, 'p043').map((x) => x.bl)).toEqual(['TESTBL0001'])
  expect(searchStock(r.items, 'testbl')).toHaveLength(2)
  expect(searchStock(r.items, '  ')).toEqual([])
})
