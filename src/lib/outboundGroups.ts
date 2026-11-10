import type { Outbound } from '../domain/types'

export interface OutboundGroup {
  destination: string
  items: Outbound[]
  weightKg: number
  sameDay: number
}

// 게이트 시간 없음은 맨 뒤로
const gate = (x: Outbound) => x.gateTime?.trim() || '￿'
const byUrgency = (a: Outbound, b: Outbound) => Number(b.sameDay) - Number(a.sameDay) || gate(a).localeCompare(gate(b))

/** 도착지별로 묶는다. 그룹·그룹 안 모두 당일착 먼저, 그다음 이른 게이트 시간 순. */
export function groupOutbound(items: Outbound[]): OutboundGroup[] {
  const map = new Map<string, Outbound[]>()
  for (const x of items) {
    const key = x.destination?.trim() || '도착지 없음'
    map.set(key, [...(map.get(key) ?? []), x])
  }
  return [...map]
    .map(([destination, xs]) => {
      const earliest = xs.map(gate).sort()[0]
      return { destination, items: xs.sort(byUrgency), earliest, weightKg: xs.reduce((s, x) => s + (x.weightKg ?? 0), 0), sameDay: xs.filter((x) => x.sameDay).length }
    })
    .sort((a, b) => Number(b.sameDay > 0) - Number(a.sameDay > 0) || a.earliest.localeCompare(b.earliest))
    .map(({ earliest: _, ...g }) => g)
}

export interface DispatchGroup { key: number; vehicles: string; note: string | null; items: Outbound[]; weightKg: number }
export interface DispatchSection { arrive: string | null; invar: boolean; groups: DispatchGroup[] }

/**
 * 배차가 붙은 날: 도착일 구역(당착 먼저, 같은 날은 INVAR가 뒤) → 배차 줄(차 한 대분) 순서.
 * 배차에 없는 건(line 0, 이미 나간 당착)은 당착 구역 맨 끝.
 */
export function groupByDispatch(items: Outbound[]): DispatchSection[] {
  const sections = new Map<string, DispatchSection>()
  for (const x of items) {
    const d = x.dispatch ?? { line: 0, arrive: null, vehicles: '', note: null, invar: false }
    const sk = `${d.arrive ?? ''}|${d.invar}`
    const sec = sections.get(sk) ?? { arrive: d.arrive, invar: d.invar, groups: [] }
    sections.set(sk, sec)
    let g = sec.groups.find((y) => y.key === d.line)
    if (!g) sec.groups.push((g = { key: d.line, vehicles: d.vehicles, note: d.note, items: [], weightKg: 0 }))
    g.items.push(x)
    g.weightKg += x.weightKg ?? 0
  }
  const order = (s: DispatchSection) => `${s.arrive ?? '0000'}|${s.invar ? 1 : 0}`
  return [...sections.values()]
    .sort((a, b) => order(a).localeCompare(order(b)))
    .map((s) => ({
      ...s,
      groups: s.groups
        .sort((a, b) => (a.key || Infinity) - (b.key || Infinity))
        .map((g) => ({ ...g, items: g.items.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)) })),
    }))
}
