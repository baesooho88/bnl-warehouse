import Dexie, { type EntityTable } from 'dexie'
import type { Inbound, Kind, Outbound } from '../domain/types'
import type { Coverage, DayData, Repository } from './repository'

type DB = Dexie & {
  inbound: EntityTable<Inbound, 'id'>
  outbound: EntityTable<Outbound, 'id'>
  meta: EntityTable<{ key: string; value: unknown }, 'key'>
}

export interface SyncState {
  lastLogId: number
  lastSyncedAt: string | null
}

/** 휴대폰 안 저장소. v2에서는 클라우드의 사본이며, 동기화 위치(SyncState)도 함께 보관한다. */
export interface LocalRepository extends Repository {
  getSyncState(): Promise<SyncState>
  setSyncState(s: SyncState): Promise<void>
}

const byDateDescThenId = <T extends { baseDate: string; id: string }>(a: T, b: T) =>
  a.baseDate === b.baseDate ? compareId(a.id, b.id) : a.baseDate < b.baseDate ? 1 : -1

// id 끝의 순번을 숫자로 비교해야 2 < 10 순서가 된다
const compareId = (a: string, b: string) => {
  const [pa, na] = splitId(a)
  const [pb, nb] = splitId(b)
  return pa === pb ? na - nb : pa < pb ? -1 : 1
}
const splitId = (id: string): [string, number] => {
  const i = id.lastIndexOf('|')
  return [id.slice(0, i), Number(id.slice(i + 1))]
}

const sorted = (d: DayData): DayData => ({
  inbound: d.inbound.sort(byDateDescThenId),
  outbound: d.outbound.sort(byDateDescThenId),
})


function coverageOf(dates: string[]): Coverage | null {
  const uniq = [...new Set(dates)].sort()
  return uniq.length ? { from: uniq[0], to: uniq[uniq.length - 1], days: uniq.length } : null
}

export function createDexieRepository(dbName = 'bnl-warehouse'): LocalRepository {
  const db = new Dexie(dbName) as DB
  db.version(1).stores({
    inbound: 'id, baseDate, [port+baseDate], bl, hull, po',
    outbound: 'id, baseDate, bl, hull, po',
  })
  db.version(2).stores({ meta: 'key' })

  return {
    async replaceDays(kind, baseDates, inbound, outbound) {
      await db.transaction('rw', db.inbound, db.outbound, async () => {
        if (kind === '출고') {
          await db.outbound.where('baseDate').anyOf(baseDates).delete()
          await db.outbound.bulkAdd(outbound)
        } else {
          const port = kind === '입고-북항' ? '북항' : '신항'
          await db.inbound.where('[port+baseDate]').anyOf(baseDates.map((d) => [port, d])).delete()
          await db.inbound.bulkAdd(inbound)
        }
      })
    },

    async getRange(from, to) {
      const [inbound, outbound] = await Promise.all([
        db.inbound.where('baseDate').between(from, to, true, true).toArray(),
        db.outbound.where('baseDate').between(from, to, true, true).toArray(),
      ])
      return sorted({ inbound, outbound })
    },

    async coverage() {
      const [inbound, outbound] = await Promise.all([db.inbound.toArray(), db.outbound.toArray()])
      const result: Record<Kind, Coverage | null> = {
        '입고-북항': coverageOf(inbound.filter((x) => x.port === '북항').map((x) => x.baseDate)),
        '입고-신항': coverageOf(inbound.filter((x) => x.port === '신항').map((x) => x.baseDate)),
        출고: coverageOf(outbound.map((x) => x.baseDate)),
      }
      return result
    },

    async latestDate() {
      const [a, b] = await Promise.all([db.inbound.orderBy('baseDate').last(), db.outbound.orderBy('baseDate').last()])
      const dates = [a?.baseDate, b?.baseDate].filter((d): d is string => !!d).sort()
      return dates.length ? dates[dates.length - 1] : null
    },

    async getSyncState() {
      const row = await db.meta.get('sync')
      return (row?.value as SyncState | undefined) ?? { lastLogId: 0, lastSyncedAt: null }
    },

    async setSyncState(s) {
      await db.meta.put({ key: 'sync', value: s })
    },

    async clearAll() {
      await db.transaction('rw', db.inbound, db.outbound, db.meta, async () => {
        await db.inbound.clear()
        await db.outbound.clear()
        await db.meta.clear()
      })
    },
  }
}
