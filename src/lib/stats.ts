import type { Inbound, Outbound, Port } from '../domain/types'
import { daysBetween } from './dates'

export interface Stats {
  inbound: Record<Port, { count: number; weightKg: number; containers: number }>
  outbound: { count: number; weightKg: number; sameDay: number }
  daily: { date: string; inbound: number; outbound: number }[]
  topHulls: { hull: string; count: number }[]
  topDestinations: { destination: string; count: number }[]
}

function top<K extends string>(values: (string | null)[], key: K) {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([name, count]) => ({ [key]: name, count }) as Record<K, string> & { count: number })
}

export function computeStats(data: { inbound: Inbound[]; outbound: Outbound[] }, from: string, to: string): Stats {
  const port = (p: Port) => {
    const list = data.inbound.filter((x) => x.port === p)
    return {
      count: list.length,
      weightKg: list.reduce((s, x) => s + (x.weightKg ?? 0), 0),
      containers: list.reduce((s, x) => s + x.containers.length, 0),
    }
  }
  return {
    inbound: { 북항: port('북항'), 신항: port('신항') },
    outbound: {
      count: data.outbound.length,
      weightKg: data.outbound.reduce((s, x) => s + (x.weightKg ?? 0), 0),
      sameDay: data.outbound.filter((x) => x.sameDay).length,
    },
    daily: daysBetween(from, to).map((date) => ({
      date,
      inbound: data.inbound.filter((x) => x.baseDate === date).length,
      outbound: data.outbound.filter((x) => x.baseDate === date).length,
    })),
    topHulls: top([...data.inbound, ...data.outbound].map((x) => x.hull), 'hull'),
    topDestinations: top(data.outbound.map((x) => x.destination), 'destination'),
  }
}
