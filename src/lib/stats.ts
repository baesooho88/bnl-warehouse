import type { Inbound, Outbound, Port } from '../domain/types'
import { daysBetween } from './dates'

export interface Totals { count: number; weightKg: number; cbm: number }
export interface Ranked { name: string; count: number; cbm: number }

export interface Stats {
  inbound: Record<Port, Totals & { containers: number }>
  outbound: Totals & { sameDay: number }
  daily: { date: string; inbound: Totals; outbound: Totals }[]
  topHulls: Ranked[]
  topDestinations: Ranked[]
}

// null 중량·CBM은 0으로 더한다
const totals = (list: (Inbound | Outbound)[]): Totals => ({
  count: list.length,
  weightKg: list.reduce((s, x) => s + (x.weightKg ?? 0), 0),
  cbm: list.reduce((s, x) => s + (x.cbm ?? 0), 0),
})

/** 이름별 건수 상위 5 (같으면 가나다순), null 이름 제외 */
function top(list: (Inbound | Outbound)[], key: (x: Inbound | Outbound) => string | null): Ranked[] {
  const map = new Map<string, Ranked>()
  for (const x of list) {
    const name = key(x)
    if (!name) continue
    const r = map.get(name) ?? { name, count: 0, cbm: 0 }
    r.count++
    r.cbm += x.cbm ?? 0
    map.set(name, r)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5)
}

export function computeStats(data: { inbound: Inbound[]; outbound: Outbound[] }, from: string, to: string): Stats {
  const port = (p: Port) => {
    const list = data.inbound.filter((x) => x.port === p)
    return { ...totals(list), containers: list.reduce((s, x) => s + x.containers.length, 0) }
  }
  return {
    inbound: { 북항: port('북항'), 신항: port('신항') },
    outbound: { ...totals(data.outbound), sameDay: data.outbound.filter((x) => x.sameDay).length },
    daily: daysBetween(from, to).map((date) => ({
      date,
      inbound: totals(data.inbound.filter((x) => x.baseDate === date)),
      outbound: totals(data.outbound.filter((x) => x.baseDate === date)),
    })),
    topHulls: top([...data.inbound, ...data.outbound], (x) => x.hull),
    topDestinations: top(data.outbound, (x) => (x as Outbound).destination),
  }
}
