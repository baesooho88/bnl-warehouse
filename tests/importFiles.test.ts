import 'fake-indexeddb/auto'
import * as XLSX from 'xlsx'
import { describe, expect, test } from 'vitest'
import { importFiles, type Updated } from '../src/lib/importFiles'
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

const header = [null, '센터', '입하', 'BL No', '호선', 'PO', '품명', '수량', '중량', '용적', 'BOX NO', '도착지', '입문', 'MEMO', '검수', '신청자명', '도착', 'Location']
const day = (d: string, seqs: number[]) => XLSX.utils.aoa_to_sheet([['일일출하요청서'], [null, d], header,
  ...seqs.map((seq) => [seq, 'BNL', '', `BL${seq}`, '', '', '품목', '1/1', '100', '', '', '가', '09시', '', '', '', '', ''])])
const book = (name: string, sheets: [string, XLSX.WorkSheet][]) => {
  const wb = XLSX.utils.book_new()
  for (const [n, s] of sheets) XLSX.utils.book_append_sheet(wb, s, n)
  return file(name, new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })))
}
const dispatchSheet = (lines: string[]) => XLSX.utils.aoa_to_sheet(lines.map((l) => [l]))

test('배차 파일은 배차 탭만 읽어 저장된 출고에 붙인다(그 파일의 출고 시트는 무시)', async () => {
  const repo = freshRepo()
  await importFiles([book('출고.xlsx', [['11.10', day('11/10', [1, 2])]])], repo, now)
  const updated: Updated[] = []
  // 배차 파일 안 출고 시트는 이전 편집본: 순번 2가 없지만 저장된 출고를 지우지 않는다
  const lines = await importFiles([book('배차.xlsx', [['11.10', day('11/10', [1])], ['배차', dispatchSheet(['11월 11일 도착', '1, 2 : 5TX1', '7 : 1TX1'])]])], repo, now, updated)
  expect(lines).toEqual([
    { level: 'ok', text: '✅ 배차: 배차 11.10 차량 2건 연결(다른 탭은 무시)' },
    { level: 'warn', text: '⚠️ 배차 배차 시트: 순번 7 출고에 없음' },
  ])
  const got = (await repo.getRange('2026-11-10', '2026-11-10')).outbound
  expect(got.map((o) => [o.seq, o.dispatch?.vehicles, o.dispatch?.arrive])).toEqual([[1, '5T×1', '2026-11-11'], [2, '5T×1', '2026-11-11']])
})

test('저장된 출고가 없으면 배차 파일은 오류(출고표 먼저)', async () => {
  const lines = await importFiles([book('배차.xlsx', [['11.10', day('11/10', [1])], ['배차', dispatchSheet(['당착', '1 : 5TX1'])]])], freshRepo(), now)
  expect(lines).toEqual([{ level: 'error', text: '❌ 배차: 배차를 붙일 11.10 출고가 없어요 — 출고표를 먼저 올려 주세요' }])
})

test('다음 날 출고표를 올려도 전날 배차는 남는다', async () => {
  const repo = freshRepo()
  await importFiles([book('출고.xlsx', [['11.10', day('11/10', [1])]])], repo, now)
  await importFiles([book('배차.xlsx', [['11.10', day('11/10', [1])], ['배차', dispatchSheet(['11월 11일 도착', '1 : 5TX1'])]])], repo, now)
  await importFiles([book('출고.xlsx', [['11.10', day('11/10', [1])], ['11.11', day('11/11', [2])]])], repo, now)
  await importFiles([book('배차.xlsx', [['11.11', day('11/11', [2])], ['배차', dispatchSheet(['11월 12일 도착', '2 : 1TX1'])]])], repo, now)
  const got = await repo.getRange('2026-11-10', '2026-11-11')
  expect(got.outbound.find((o) => o.baseDate === '2026-11-10')?.dispatch?.vehicles).toBe('5T×1')
  expect(got.outbound.find((o) => o.baseDate === '2026-11-11')?.dispatch?.vehicles).toBe('1T×1')
})

test('출고표와 배차 파일을 같이 고르면 순서와 상관없이 출고표 먼저, 배차는 그 위에', async () => {
  const edited = book('11.16 출하요청서(편집).xlsx', [['11.16', day('11/16', [2, 3])], ['Sheet1', dispatchSheet(['당착', '2 : 5TON X1', '17일 도착', '3, 32 : 11TON X2'])]])
  const fresh = book('11.16 출하요청서.xlsx', [['11.16', day('11/16', [2, 3, 32])]])
  const repo = freshRepo()
  const saved: string[] = []
  const lines = await importFiles([edited, fresh], repo, now, [], (n) => saved.push(n))
  expect(saved).toEqual(['11.16 출하요청서.xlsx', '11.16 출하요청서(편집).xlsx'])
  expect(lines.filter((l) => l.level !== 'ok')).toEqual([])
  const got = (await repo.getRange('2026-11-16', '2026-11-16')).outbound
  expect(got.map((o) => [o.seq, o.dispatch?.vehicles, o.dispatch?.arrive])).toEqual([[2, '5T×1', null], [3, '11T×2', '2026-11-17'], [32, '11T×2', '2026-11-17']])
})
