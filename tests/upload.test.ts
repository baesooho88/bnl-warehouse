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
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], { online: false, repo, now, setFileName, saveRi, saveStock })
    expect(lines).toEqual([{ level: 'error', text: '❌ 인터넷 연결이 필요해요' }])
    expect(remote.calls.replaceDays).toBe(0)
  })

  test('성공하면 저장하고 업로드 기록을 남긴다', async () => {
    const { remote, repo, setFileName } = setup()
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], { online: true, repo, now, setFileName, saveRi, saveStock })
    expect(lines[0].level).toBe('ok')
    expect((await remote.fetchLogsAfter(0))[0]).toMatchObject({ kind: '입고-신항' })
  })

  test('업로드 기록에 파일명이 전달된다', async () => {
    const { repo, setFileName } = setup()
    const seen: string[] = []
    await uploadFiles([file('신항.xlsx', 'sinhang'), file('출고.xlsx', 'outbound')], {
      online: true, repo, now, setFileName: (x) => { seen.push(x); setFileName(x) }, saveRi, saveStock,
    })
    expect(seen).toEqual(['신항.xlsx', '출고.xlsx'])
  })

  test('저장 실패는 오류로 알린다', async () => {
    const { remote, repo, setFileName } = setup()
    remote.failNext('replaceDays')
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], { online: true, repo, now, setFileName, saveRi, saveStock })
    expect(lines.every((l) => l.level === 'error')).toBe(true)
  })

  test('RI 작업표는 RI로 저장한다', async () => {
    const { remote, repo, setFileName } = setup()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['B/L No.', 'Description.', 'RI 준비 위치'], ['TESTBL0001', '테스트 장비', '0-E'],
    ]), 'Sheet1')
    const data = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })).buffer
    const saved = vi.fn(async () => {})
    const lines = await uploadFiles([{ name: 'RI 준비자재(2026.11.11).xlsx', data }], { online: true, repo, now, setFileName, saveRi: saved, saveStock })
    expect(lines).toEqual([{ level: 'ok', text: '✅ RI 준비자재(2026.11.11): 11.11 RI 작업표 1건 반영' }])
    expect(saved).toHaveBeenCalledWith('2026-11-11', [expect.objectContaining({ bl: 'TESTBL0001', riLocation: '0-E' })])
    expect(remote.calls.replaceDays).toBe(0)
  })

})
