import 'fake-indexeddb/auto'
import { describe, expect, test, vi } from 'vitest'
import { uploadFiles } from '../src/lib/upload'
import { createCloudRepository } from '../src/storage/cloudRepository'
import { createDexieRepository } from '../src/storage/dexieRepository'
import { createFakeRemote } from './helpers/fakeRemote'
import { fixtureBytes } from './helpers/fixtures'

const now = new Date(2026, 10, 5)
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
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], { online: false, repo, now, notify, setFileName })
    expect(lines).toEqual([{ level: 'error', text: '❌ 인터넷 연결이 필요해요' }])
    expect(remote.calls.replaceDays).toBe(0)
    expect(notify).not.toHaveBeenCalled()
  })

  test('성공하면 가장 최근 기준일 건수로 알림을 한 번 요청', async () => {
    const { remote, repo, setFileName } = setup()
    const notify = vi.fn(async () => {})
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], { online: true, repo, now, notify, setFileName })
    expect(lines[0].level).toBe('ok')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith({ date: '2026-11-05', inbound: 1, outbound: 0, sameDay: 0 })
    expect((await remote.fetchLogsAfter(0))[0]).toMatchObject({ kind: '입고-신항' })
  })

  test('업로드 기록에 파일명이 전달된다', async () => {
    const { repo, setFileName } = setup()
    const seen: string[] = []
    await uploadFiles([file('신항.xlsx', 'sinhang'), file('출고.xlsx', 'outbound')], {
      online: true, repo, now, notify: async () => {}, setFileName: (x) => { seen.push(x); setFileName(x) },
    })
    expect(seen).toEqual(['신항.xlsx', '출고.xlsx'])
  })

  test('알림 실패는 경고 한 줄만 추가', async () => {
    const { repo, setFileName } = setup()
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], {
      online: true, repo, now, notify: async () => { throw new Error('x') }, setFileName,
    })
    expect(lines.at(-1)).toEqual({ level: 'warn', text: '⚠️ 알림을 보내지 못했어요' })
    expect(lines[0].level).toBe('ok')
  })

  test('전부 실패면 알림을 보내지 않는다', async () => {
    const { remote, repo, setFileName } = setup()
    remote.failNext('replaceDays')
    const notify = vi.fn(async () => {})
    const lines = await uploadFiles([file('신항.xlsx', 'sinhang')], { online: true, repo, now, notify, setFileName })
    expect(lines.every((l) => l.level === 'error')).toBe(true)
    expect(notify).not.toHaveBeenCalled()
  })
})
