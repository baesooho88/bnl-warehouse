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

/** [12,13,…,19,30] → '12~19, 30'. 배차표처럼 3개 이상 이어질 때만 범위로 쓴다. */
export function seqLabel(seqs: number[]): string {
  const s = [...seqs].sort((a, b) => a - b)
  const out: string[] = []
  for (let i = 0; i < s.length; ) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++
    if (j - i >= 2) out.push(`${s[i]}~${s[j]}`)
    else for (let k = i; k <= j; k++) out.push(String(s[k]))
    i = j + 1
  }
  return out.join(', ')
}

/**
 * '8T×1 · 5T×1' → 차량마다 모양과 색. 모양: 1T 이하 🛻 픽업, 8T까지 🚚 화물차, 그 이상·트레일러 🚛 대형.
 * 색(tone): t1 회색 · t5(2.5~5T) 파랑 · t8 초록 · t11 주황 · t25(15T 이상) 빨강 · ttr(트레일러 등) 보라
 */
export function vehicleChips(vehicles: string): { label: string; icon: string; tone: string }[] {
  return vehicles.split(' · ').filter(Boolean).map((label) => {
    const ton = parseFloat(label)
    if (Number.isNaN(ton)) return { label, icon: '🚛', tone: 'ttr' }
    const icon = ton <= 1 ? '🛻' : ton <= 8 ? '🚚' : '🚛'
    const tone = ton <= 1 ? 't1' : ton <= 5 ? 't5' : ton <= 8 ? 't8' : ton <= 11 ? 't11' : 't25'
    return { label, icon, tone }
  })
}
