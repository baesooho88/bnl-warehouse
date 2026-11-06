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
