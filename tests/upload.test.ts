import 'fake-indexeddb/auto'
import * as XLSX from 'xlsx'
import { describe, expect, test, vi } from 'vitest'
import { uploadFiles } from '../src/lib/upload'
import { createCloudRepository } from '../src/storage/cloudRepository'
import { createDexieRepository } from '../src/storage/dexieRepository'
import { createFakeRemote } from './helpers/fakeRemote'
import { fixtureBytes } from './helpers/fixtures'

const now = new Date(2026, 10, 5)
const saveRi = async () => {}
const saveStock = async () => {}
let n = 0
const setup = () => {
  const remote = createFakeRemote()
  let name = ''
  const repo = createCloudRepository(createDexieRepository(`upload-${n++}`), remote, () => name)
  return { remote, repo, setFileName: (x: string) => { name = x } }
}
const file = (name: string, k: 'sinhang' | 'outbound') => ({ name, data: fixtureBytes(k).slice().buffer })

describe('uploadFiles', () => {
  test('오프라인이면 해석·저장하지 않고 안내', async () => {
    const { remote, repo, setFileName } = setup()
    const notify = vi.fn(async () => {})
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], { online: false, repo, now, notify, setFileName, saveRi, saveStock })
    expect(lines).toEqual([{ level: 'error', text: '❌ 인터넷 연결이 필요해요' }])
    expect(remote.calls.replaceDays).toBe(0)
    expect(notify).not.toHaveBeenCalled()
  })

  test('성공하면 바뀐 종류의 날짜·건수로 알림을 한 번 요청', async () => {
    const { remote, repo, setFileName } = setup()
    const notify = vi.fn(async () => {})
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], { online: true, repo, now, notify, setFileName, saveRi, saveStock })
    expect(lines[0].level).toBe('ok')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith({ kind: 'upload', updates: [{ type: '입고', date: '2026-11-05', count: 1 }] })
    expect((await remote.fetchLogsAfter(0))[0]).toMatchObject({ kind: '입고-신항' })
  })

  test('업로드 기록에 파일명이 전달된다', async () => {
    const { repo, setFileName } = setup()
    const seen: string[] = []
    await uploadFiles([file('신항.xlsx', 'sinhang'), file('출고.xlsx', 'outbound')], {
      online: true, repo, now, notify: async () => {}, setFileName: (x) => { seen.push(x); setFileName(x) }, saveRi, saveStock,
    })
    expect(seen).toEqual(['신항.xlsx', '출고.xlsx'])
  })

  test('알림 실패는 경고 한 줄만 추가', async () => {
    const { repo, setFileName } = setup()
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], {
      online: true, repo, now, notify: async () => { throw new Error('x') }, setFileName, saveRi, saveStock,
    })
    expect(lines.at(-1)).toEqual({ level: 'warn', text: '⚠️ 알림을 보내지 못했어요' })
    expect(lines[0].level).toBe('ok')
  })

  test('전부 실패면 알림을 보내지 않는다', async () => {
    const { remote, repo, setFileName } = setup()
    remote.failNext('replaceDays')
    const notify = vi.fn(async () => {})
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], { online: true, repo, now, notify, setFileName, saveRi, saveStock })
    expect(lines.every((l) => l.level === 'error')).toBe(true)
    expect(notify).not.toHaveBeenCalled()
  })

  test('RI 작업표는 RI로 저장하고 입출고 알림은 보내지 않는다', async () => {
    const { remote, repo, setFileName } = setup()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['B/L No.', 'Description.', 'RI 준비 위치'], ['TESTBL0001', '테스트 장비', '0-E'],
    ]), 'Sheet1')
    const data = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })).buffer
    const saved = vi.fn(async () => {})
    const notify = vi.fn(async () => {})
    const lines = await uploadFiles([{ name: 'RI 준비자재(2026.11.11).xlsx', data }], { online: true, repo, now, notify, setFileName, saveRi: saved, saveStock })
    expect(lines).toEqual([{ level: 'ok', text: '✅ RI 준비자재(2026.11.11): 11.11 RI 작업표 1건 반영' }])
    expect(saved).toHaveBeenCalledWith('2026-11-11', [expect.objectContaining({ bl: 'TESTBL0001', riLocation: '0-E' })])
    expect(remote.calls.replaceDays).toBe(0)
    expect(notify).not.toHaveBeenCalled()
  })

  test('입고·출고 날짜가 달라도 각자 자기 날짜로 알린다', async () => {
    const { repo, setFileName } = setup()
    const inb = XLSX.read(fixtureBytes('sinhang'))
    const next = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(next, inb.Sheets['11.5'], '11.5')
    XLSX.utils.book_append_sheet(next, inb.Sheets['11.5'], '11.6') // 입고 파일엔 다음 날 시트가 미리 있곤 하다
    const inbound = { name: '신항.xlsx', data: new Uint8Array(XLSX.write(next, { type: 'array', bookType: 'xlsx' })).buffer }
    const day = (d: string, title: string, header: string[], row: (string | number)[]) =>
      XLSX.utils.aoa_to_sheet([[title], [null, d], header, row])
    const wb = (name: string, sheets: [string, XLSX.WorkSheet][]) => {
      const b = XLSX.utils.book_new()
      for (const [n, s] of sheets) XLSX.utils.book_append_sheet(b, s, n)
      return { name, data: new Uint8Array(XLSX.write(b, { type: 'array', bookType: 'xlsx' })).buffer }
    }
    const outHeader = ['', '센터', '입하', 'BL No', '호선', 'PO', '품명', '수량', '중량', '용적', 'BOX NO', '도착지', '입문', 'MEMO', '검수', '신청자명', '도착', 'Location']
    const outbound = wb('출고.xlsx', [['11.5', day('11/5', '일일출하요청서', outHeader, [1, 'BNL', '', 'BL1', '', '', '품목', '1/1', '100', '', '', '가', '', '', '', '', '', ''])]])
    const notify = vi.fn(async () => {})
    await uploadFiles([inbound, outbound], { online: true, repo, now, notify, setFileName, saveRi, saveStock })
    expect(notify).toHaveBeenCalledWith({ kind: 'upload', updates: [
      { type: '입고', date: '2026-11-06', count: 1 },
      { type: '출고', date: '2026-11-05', count: 1, sameDay: 0 },
    ] })
  })
})
