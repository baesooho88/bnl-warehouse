import type { Inbound, Kind, Outbound } from '../../src/domain/types'
import { PAGE, type Remote, type UploadLog } from '../../src/storage/cloud/remote'

type Method = 'fetchAll' | 'fetchLogsAfter' | 'fetchDays' | 'replaceDays'

/** 인메모리 원격. Supabase 구현과 같은 계약을 따른다 (tests/remote.contract.test.ts). */
export function createFakeRemote() {
  let inbound: Inbound[] = []
  let outbound: Outbound[] = []
  const logs: UploadLog[] = []
  const listeners = new Set<() => void>()
  const failing = new Set<Method>()
  const calls: Record<Method, number> = { fetchAll: 0, fetchLogsAfter: 0, fetchDays: 0, replaceDays: 0 }
  const state = { pagesServed: 0 }

  const guard = (m: Method) => {
    calls[m]++
    if (failing.delete(m)) throw new Error(`가짜 원격 ${m} 실패`)
  }
  const paged = <T>(list: T[]) => {
    for (let i = 0; i <= list.length; i += PAGE) state.pagesServed++
    return [...list]
  }
  const portOf = (kind: Kind) => (kind === '입고-북항' ? '북항' : '신항')
  const clone = <T>(x: T): T => structuredClone(x)

  const remote: Remote = {
    async fetchAll() {
      guard('fetchAll')
      return { inbound: clone(paged(inbound)), outbound: clone(paged(outbound)), maxLogId: logs.at(-1)?.id ?? 0 }
    },
    async fetchLogsAfter(id) {
      guard('fetchLogsAfter')
      return clone(logs.filter((l) => l.id > id))
    },
    async fetchDays(kind, dates) {
      guard('fetchDays')
      const set = new Set(dates)
      if (kind === '출고') return { inbound: [], outbound: clone(outbound.filter((x) => set.has(x.baseDate))) }
      return { inbound: clone(inbound.filter((x) => x.port === portOf(kind) && set.has(x.baseDate))), outbound: [] }
    },
    async replaceDays(kind, dates, inRows, outRows) {
      guard('replaceDays')
      const set = new Set(dates)
      const rows = kind === '출고' ? outRows : inRows
      if (new Set(rows.map((r) => r.id)).size !== rows.length) throw new Error('중복 id (롤백)')
      if (kind === '출고') outbound = [...outbound.filter((x) => !set.has(x.baseDate)), ...clone(outRows)]
      else inbound = [...inbound.filter((x) => !(x.port === portOf(kind) && set.has(x.baseDate))), ...clone(inRows)]
      const log = { id: logs.length + 1, kind, baseDates: [...dates].sort(), createdAt: new Date().toISOString() }
      logs.push(log)
      for (const l of listeners) l()
      return log.id
    },
    onNewLog(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
  }

  // Object.assign은 getter를 값으로 굳히므로 pagesServed는 defineProperty로 붙인다
  const extra = Object.assign(remote, {
    calls,
    failNext(m: Method) { failing.add(m) },
    emitNewLog() { for (const l of listeners) l() },
  })
  return Object.defineProperty(extra, 'pagesServed', { get: () => state.pagesServed }) as typeof extra & { readonly pagesServed: number }
}
