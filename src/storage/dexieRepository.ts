import Dexie, { type EntityTable } from 'dexie'
import type { Inbound, Kind, Outbound } from '../domain/types'
import type { Coverage, DayData, Repository } from './repository'

type DB = Dexie & {
  inbound: EntityTable<Inbound, 'id'>
  outbound: EntityTable<Outbound, 'id'>
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

const squash = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, '')

function coverageOf(dates: string[]): Coverage | null {
  const uniq = [...new Set(dates)].sort()
  return uniq.length ? { from: uniq[0], to: uniq[uniq.length - 1], days: uniq.length } : null
}

export function createDexieRepository(dbName = 'bnl-warehouse'): Repository {
  const db = new Dexie(dbName) as DB
  db.version(1).stores({
    inbound: 'id, baseDate, [port+baseDate], bl, hull, po',
    outbound: 'id, baseDate, bl, hull, po',
  })

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

    async search(query) {
      const q = squash(query)
      if (!q) return { inbound: [], outbound: [] }
      // shortcut: 전체를 읽어 메모리에서 거른다 — 하루 수십 건 규모 기준, 수만 건을 넘으면 인덱스 검색으로 교체
      const hit = (...fields: (string | null | undefined)[]) => fields.some((f) => squash(f).includes(q))
      const [inbound, outbound] = await Promise.all([db.inbound.toArray(), db.outbound.toArray()])
      return sorted({
        inbound: inbound.filter((x) => hit(x.bl, x.hull, x.po, x.item, x.destination, ...x.containers.map((c) => c.no))),
        outbound: outbound.filter((x) => hit(x.bl, x.hull, x.po, x.item, x.destination)),
      })
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

    async clearAll() {
      await db.transaction('rw', db.inbound, db.outbound, async () => {
        await db.inbound.clear()
        await db.outbound.clear()
      })
    },
  }
}
