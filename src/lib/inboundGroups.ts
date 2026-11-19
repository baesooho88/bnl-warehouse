import type { Inbound } from '../domain/types'

/**
 * 같은 부두에서 컨테이너 묶음이 똑같은 B/L들을 한 묶음으로(혼재: 컨테이너 하나에 B/L 여러 건).
 * 순서는 처음 나온 자리. 컨테이너가 없는 건은 혼자.
 * shortcut: 컨테이너가 일부만 겹치는 B/L은 묶지 않음, 그런 파일이 나오면 겹침 기준으로 바꿀 것.
 */
export function groupInbound(items: Inbound[]): Inbound[][] {
  const groups = new Map<string, Inbound[]>()
  items.forEach((x, i) => {
    const key = x.containers.length ? `${x.port}|${[...new Set(x.containers.map((c) => c.no))].sort().join(',')}` : `#${i}`
    groups.set(key, [...(groups.get(key) ?? []), x])
  })
  return [...groups.values()]
}
