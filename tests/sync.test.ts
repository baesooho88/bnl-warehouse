import 'fake-indexeddb/auto'
import { describe, expect, test } from 'vitest'
import type { Inbound, Kind } from '../src/domain/types'
import { parseWorkbook } from '../src/parsers/workbook'
import { createDexieRepository } from '../src/storage/dexieRepository'
import { createSync } from '../src/sync/sync'
import { createFakeRemote } from './helpers/fakeRemote'
import { fixtureBytes } from './helpers/fixtures'

const now = new Date(2026, 10, 5)
const files = { 북항: parseWorkbook(fixtureBytes('bukhang'), 'b', now), 신항: parseWorkbook(fixtureBytes('sinhang'), 's', now), 출고: parseWorkbook(fixtureBytes('outbound'), 'o', now) }
const days = (kind: Kind) => {
  const f = kind === '출고' ? files.출고 : kind === '입고-북항' ? files.북항 : files.신항
  return [...new Set(f.sheets.filter((s) => s.status === 'ok').map((s) => s.baseDate!))]
}
const upload = async (remote: ReturnType<typeof createFakeRemote>, kind: Kind, only?: string[]) => {
  const f = kind === '출고' ? files.출고 : kind === '입고-북항' ? files.북항 : files.신항
  const ds = only ?? days(kind)
  const set = new Set(ds)
  await remote.replaceDays(kind, ds, f.inbound.filter((x) => set.has(x.baseDate)), f.outbound.filter((x) => set.has(x.baseDate)), 'f')
}
let n = 0
const setup = async () => {
  const remote = createFakeRemote()
  const local = createDexieRepository(`sync-${n++}`)
  const sync = createSync({ local, remote, now: () => now })
  return { remote, local, sync }
}
const count = async (local: ReturnType<typeof createDexieRepository>) => {
  const d = await local.getRange('2000-01-01', '2999-12-31')
  return d.inbound.length + d.outbound.length
}

describe('createSync', () => {
  test('첫 동기화: 원격 전체를 받고 마지막 기록 번호를 저장', async () => {
    const { remote, local, sync } = await setup()
    await upload(remote, '입고-북항'); await upload(remote, '입고-신항'); await upload(remote, '출고')
    await sync.syncOnce()
    expect(await count(local)).toBe(files.북항.inbound.length + files.신항.inbound.length + files.출고.outbound.length)
    expect((await local.getSyncState()).lastLogId).toBe(3)
    expect(sync.status()).toMatchObject({ state: 'idle', lastSyncedAt: now.toISOString() })
  })

  test('따라잡기: 오프라인 동안의 업로드 여러 건을 한 번에, 바뀐 날짜만 받는다', async () => {
    const { remote, local, sync } = await setup()
    await upload(remote, '입고-신항')
    await sync.syncOnce()
    await upload(remote, '출고', ['2026-11-04'])
    await upload(remote, '출고', ['2026-11-05'])
    await upload(remote, '입고-북항', ['2026-11-05'])
    const before = { all: remote.calls.fetchAll, days: remote.calls.fetchDays }
    await sync.syncOnce()
    const d = await local.getRange('2026-11-04', '2026-11-05')
    expect(d.outbound.length).toBe(files.출고.outbound.filter((x) => x.baseDate >= '2026-11-04').length)
    expect(d.inbound.filter((x) => x.port === '북항').length).toBe(files.북항.inbound.filter((x) => x.baseDate === '2026-11-05').length)
    expect(remote.calls.fetchAll).toBe(before.all)
    expect(remote.calls.fetchDays - before.days).toBe(2) // 출고 1회 + 북항 1회
    expect((await local.getSyncState()).lastLogId).toBe(4)
  })

  test('실패하면 로컬과 기록 번호는 그대로, 다음 번에 반영', async () => {
    const { remote, local, sync } = await setup()
    await upload(remote, '입고-신항')
    await sync.syncOnce()
    const before = await count(local)
    await upload(remote, '출고')
    remote.failNext('fetchDays')
    await sync.syncOnce()
    expect(sync.status().state).toBe('error')
    expect(await count(local)).toBe(before)
    expect((await local.getSyncState()).lastLogId).toBe(1)
    await sync.syncOnce()
    expect(sync.status().state).toBe('idle')
    expect(await count(local)).toBe(before + files.출고.outbound.length)
  })

  test('진행 중에 더 호출되면 겹치지 않고 끝난 뒤 한 번만 더 돈다', async () => {
    const { remote, local, sync } = await setup()
    await upload(remote, '입고-신항')
    await sync.syncOnce()
    await upload(remote, '출고', ['2026-11-02'])
    const first = sync.syncOnce()
    await upload(remote, '출고', ['2026-11-03'])
    const second = sync.syncOnce()
    const third = sync.syncOnce()
    const logCallsBefore = remote.calls.fetchLogsAfter
    await Promise.all([first, second, third])
    expect(remote.calls.fetchLogsAfter - logCallsBefore).toBeLessThanOrEqual(2)
    expect((await local.getSyncState()).lastLogId).toBe(3)
    expect((await local.getRange('2026-11-03', '2026-11-03')).outbound.length).toBeGreaterThan(0)
  })

  test('1000행이 넘는 첫 동기화도 전부 받는다', async () => {
    const { remote, local, sync } = await setup()
    const base = files.신항.inbound[0]
    const many: Inbound[] = Array.from({ length: 2500 }, (_, i) => ({ ...base, baseDate: '2026-11-05', id: `신항|2026-11-05|${i}` }))
    await remote.replaceDays('입고-신항', ['2026-11-05'], many, [], 'big')
    await sync.syncOnce()
    expect((await local.getRange('2026-11-05', '2026-11-05')).inbound).toHaveLength(2500)
  })

  test('onChange는 상태가 바뀔 때 알린다', async () => {
    const { remote, sync } = await setup()
    await upload(remote, '입고-신항')
    const states: string[] = []
    sync.onChange((s) => states.push(s.state))
    await sync.syncOnce()
    expect(states).toEqual(['syncing', 'idle'])
  })

  test('로그아웃 정리(reset 후 clearAll)가 진행 중 동기화와 겹쳐도 동기화 위치를 되살리지 않는다', async () => {
    const { remote, local, sync } = await setup()
    await upload(remote, '입고-북항')
    await sync.syncOnce()
    expect((await local.getSyncState()).lastLogId).toBe(1)
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const orig = remote.fetchLogsAfter.bind(remote)
    remote.fetchLogsAfter = async (id) => { await gate; return orig(id) }
    const inflight = sync.syncOnce()
    const cleanup = (async () => { await sync.reset(); await local.clearAll() })()
    release()
    await inflight; await cleanup
    expect((await local.getSyncState()).lastLogId).toBe(0)
    expect(await count(local)).toBe(0)
  })
})
