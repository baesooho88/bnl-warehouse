import { useEffect, useState } from 'react'
import { InboundCard } from '../components/InboundCard'
import { useContainerStatuses } from '../inbound/useContainerStatuses'
import { OutboundCard } from '../components/OutboundCard'
import type { Inbound, Outbound } from '../domain/types'
import { formatDay } from '../lib/dates'
import { repo } from '../repo'
import type { DayData } from '../storage/repository'

export function SearchScreen(props: { onOpenIn: (x: Inbound) => void; onOpenOut: (x: Outbound) => void; dataVersion: number }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<DayData | null>(null)
  const { statuses } = useContainerStatuses(result?.inbound.map((x) => x.bl) ?? [])

  useEffect(() => {
    if (!query.trim()) return setResult(null)
    let alive = true
    const t = setTimeout(() => repo.search(query).then((r) => alive && setResult(r)), 300)
    return () => { alive = false; clearTimeout(t) }
  }, [query, props.dataVersion])

  const dates = result ? [...new Set([...result.inbound, ...result.outbound].map((x) => x.baseDate))].sort().reverse() : []

  return (
    <>
      <h1 className="screen-title">검색</h1>
      <input className="search" type="search" placeholder="B/L · 호선 · PO · 품명 · 컨테이너 · 도착지"
        aria-label="검색어" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      {result && dates.length === 0 && <p className="empty">검색 결과가 없어요</p>}
      {result && dates.length > 0 && (
        <p className="hint">입고 {result.inbound.length}건 · 출고 {result.outbound.length}건</p>
      )}
      {dates.map((d) => (
        <section key={d}>
          <div className="card-date">{formatDay(d)}</div>
          {result!.inbound.filter((x) => x.baseDate === d).map((x) => <InboundCard key={x.id} item={x} onOpen={props.onOpenIn} statuses={statuses} />)}
          {result!.outbound.filter((x) => x.baseDate === d).map((x) => <OutboundCard key={x.id} item={x} onOpen={props.onOpenOut} />)}
        </section>
      ))}
    </>
  )
}
