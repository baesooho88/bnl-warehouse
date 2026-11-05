import 'fake-indexeddb/auto'
import * as XLSX from 'xlsx'
import { describe, expect, test } from 'vitest'
import { importFiles } from '../src/lib/importFiles'
import { createDexieRepository } from '../src/storage/dexieRepository'
import type { Repository } from '../src/storage/repository'
import { fixtureBytes } from './helpers/fixtures'

const now = new Date(2026, 10, 5)
let n = 0
const freshRepo = () => createDexieRepository(`import-${n++}`)
const file = (name: string, bytes: Uint8Array) => ({ name, data: bytes.slice().buffer })
const unknownWorkbook = () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['아무 제목']]), '11.5')
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
}

describe('importFiles', () => {
  test('신항 누적 파일 → 성공 한 줄', async () => {
    const repo = freshRepo()
    const lines = await importFiles([file('신항보세운송 (2026.11.5).xlsx', fixtureBytes('sinhang'))], repo, now)
    expect(lines).toEqual([{ level: 'ok', text: '✅ 신항보세운송 (2026.11.5): 4일치(11.2~11.5) 입고 7건 반영' }])
    expect((await repo.coverage())['입고-신항']?.days).toBe(4)
  })

  test('출고 파일 → 출고 문구', async () => {
    const lines = await importFiles([file('11.5 한화오션 일일출하요청서.xlsx', fixtureBytes('outbound'))], freshRepo(), now)
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toMatch(/^✅ 11\.5 한화오션 일일출하요청서: 4일치\(11\.2~11\.5\) 출고 \d+건 반영$/)
  })

  test('깨진 파일은 오류 한 줄, 같이 올린 다른 파일은 반영', async () => {
    const lines = await importFiles([file('x.xlsx', new Uint8Array([1, 2, 3])), file('신항.xlsx', fixtureBytes('sinhang'))], freshRepo(), now)
    expect(lines.map((l) => l.level)).toEqual(['error', 'ok'])
    expect(lines[0].text.startsWith('❌ x:')).toBe(true)
  })

  test('알 수 없는 양식만 있으면 오류', async () => {
    const lines = await importFiles([file('abc.xlsx', unknownWorkbook())], freshRepo(), now)
    expect(lines).toEqual([{ level: 'error', text: '❌ abc: 알 수 없는 양식' }])
  })

  test('저장 실패는 오류로 알린다', async () => {
    const failing = { ...freshRepo(), replaceDays: () => Promise.reject(new Error('디스크 가득 참')) } as Repository
    const lines = await importFiles([file('신항.xlsx', fixtureBytes('sinhang'))], failing, now)
    expect(lines).toEqual([{ level: 'error', text: '❌ 신항: 저장하지 못했어요 (디스크 가득 참)' }])
  })

  test('하루치 시트 하나면 날짜 하나로 표시하고, 건너뛴 시트는 경고', async () => {
    const wb = XLSX.read(fixtureBytes('sinhang'))
    const one = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(one, wb.Sheets['11.5'], '11.5')
    XLSX.utils.book_append_sheet(one, wb.Sheets['11.4'], '요약')
    const lines = await importFiles([file('신항.xlsx', new Uint8Array(XLSX.write(one, { type: 'array', bookType: 'xlsx' })))], freshRepo(), now)
    expect(lines).toEqual([
      { level: 'ok', text: '✅ 신항: 1일치(11.5) 입고 1건 반영' },
      { level: 'warn', text: '⚠️ 신항 요약 시트: 시트 이름에서 날짜를 읽지 못함' },
    ])
  })
})
