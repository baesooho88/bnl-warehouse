import type { Inbound, Kind, Outbound } from '../domain/types'
import type { Remote } from '../storage/cloud/remote'
import type { LocalRepository } from '../storage/dexieRepository'

export type SyncStatus = { state: 'idle' | 'syncing' | 'error'; lastSyncedAt: string | null; error?: string }

const KINDS: Kind[] = ['입고-북항', '입고-신항', '출고']
const kindOf = (x: Inbound): Kind => (x.port === '북항' ? '입고-북항' : '입고-신항')

/**
 * 클라우드 → 휴대폰 동기화.
 * 처음에는 전체를 받고, 이후에는 upload_log 기준으로 바뀐 종류·날짜만 다시 받는다.
 * 실패하면 로컬 데이터와 동기화 위치를 건드리지 않는다.
 */
export function createSync(deps: { local: LocalRepository; remote: Remote; now?: () => Date }) {
  const { local, remote } = deps
  const now = deps.now ?? (() => new Date())
  let status: SyncStatus = { state: 'idle', lastSyncedAt: null }
  const listeners = new Set<(s: SyncStatus) => void>()
  let running: Promise<void> | null = null
  let again = false

  const set = (s: SyncStatus) => {
    status = s
    for (const l of listeners) l(s)
  }

  async function replaceAll(inbound: Inbound[], outbound: Outbound[]) {
    await local.clearAll()
    for (const kind of KINDS) {
      const inb = kind === '출고' ? [] : inbound.filter((x) => kindOf(x) === kind)
      const outb = kind === '출고' ? outbound : []
      const dates = [...new Set([...inb, ...outb].map((x) => x.baseDate))]
      if (dates.length) await local.replaceDays(kind, dates, inb, outb)
    }
  }

  async function runOnce() {
    const state = await local.getSyncState()
    set({ ...status, state: 'syncing', lastSyncedAt: state.lastSyncedAt })
    try {
      let lastLogId = state.lastLogId
      if (lastLogId === 0) {
        const all = await remote.fetchAll()
        await replaceAll(all.inbound, all.outbound)
        lastLogId = all.maxLogId
      } else {
        const logs = await remote.fetchLogsAfter(lastLogId)
        if (logs.length) {
          const changed = new Map<Kind, Set<string>>()
          for (const l of logs) {
            const s = changed.get(l.kind) ?? new Set<string>()
            l.baseDates.forEach((d) => s.add(d))
            changed.set(l.kind, s)
          }
          // 모두 받은 뒤에 반영해서, 중간에 실패해도 로컬이 반쯤 바뀌지 않게 한다
          const fetched = await Promise.all([...changed].map(async ([kind, dates]) => ({ kind, dates: [...dates], data: await remote.fetchDays(kind, [...dates]) })))
          for (const f of fetched) await local.replaceDays(f.kind, f.dates, f.data.inbound, f.data.outbound)
          lastLogId = logs[logs.length - 1].id
        }
      }
      const lastSyncedAt = now().toISOString()
      await local.setSyncState({ lastLogId, lastSyncedAt })
      set({ state: 'idle', lastSyncedAt })
    } catch (e) {
      set({ state: 'error', lastSyncedAt: state.lastSyncedAt, error: e instanceof Error ? e.message : String(e) })
    }
  }

  function syncOnce(): Promise<void> {
    if (running) {
      again = true // 진행 중이면 끝난 뒤 정확히 한 번 더
      return running
    }
    running = (async () => {
      do {
        again = false
        await runOnce()
      } while (again)
      running = null
    })()
    return running
  }

  return {
    syncOnce,
    status: () => status,
    onChange(cb: (s: SyncStatus) => void) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
  }
}
