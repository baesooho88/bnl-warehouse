import { useEffect, useMemo, useState } from 'react'
import { DateNav } from '../components/DateNav'
import { tons } from '../components/format'
import { InboundCard, InboundGroupCard } from '../components/InboundCard'
import { groupInbound } from '../lib/inboundGroups'
import { useContainerStatuses } from '../inbound/useContainerStatuses'
import { useInspections } from '../inspection/useInspections'
import { OutboundGroups } from '../components/OutboundGroups'
import type { Inbound, Outbound } from '../domain/types'
import { repo } from '../repo'
import type { DayData } from '../storage/repository'

type Filter = '전체' | '입고' | '출고'

export function ListScreen(props: {
  date: string
  onDateChange: (d: string) => void
  onOpenIn: (x: Inbound, bls?: string[]) => void
  onOpenOut: (x: Outbound) => void
  onGoUpload: () => void
  canUpload: boolean
  dataVersion: number
  focusCntr?: string | null // 알림으로 연 컨테이너
  onFocused?: () => void
}) {
  const { date, dataVersion, focusCntr, onFocused, onOpenIn } = props
  const [data, setData] = useState<DayData | null>(null)
  const [filter, setFilter] = useState<Filter>('전체')
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(k)) n.add(k); return n })

  useEffect(() => {
    let alive = true
    repo.getRange(date, date).then((d) => alive && setData(d))
    return () => { alive = false }
  }, [date, dataVersion])

  const inbound = data?.inbound ?? []
  const groups = useMemo(() => groupInbound(data?.inbound ?? []), [data])

  // 알림의 컨테이너가 이 날짜에 있으면: 그 카드로 내려가 컨테이너를 반짝인다(묶음이면 펼쳐 B/L까지). 없으면 데이터가 들어올 때 다시 본다.
  const [flash, setFlash] = useState<string | null>(null)
  useEffect(() => {
    if (!focusCntr) return
    const g = groups.find((xs) => xs.some((x) => x.containers.some((c) => c.no === focusCntr)))
    if (!g) return
    onFocused?.()
    setFilter('전체')
    if (g.length > 1) setOpen((s) => new Set(s).add(g[0].id))
    setFlash(focusCntr)
    requestAnimationFrame(() => document.getElementById(`in-${g[0].id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }, [focusCntr, groups, onFocused])
  // 반짝임을 끝내 두어야 같은 컨테이너 알림이 또 와도 다시 반짝인다
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 4000)
    return () => clearTimeout(t)
  }, [flash])
  const { statuses } = useContainerStatuses(inbound.map((x) => x.bl))
  const outbound = data?.outbound ?? []
  const { done } = useInspections()
  const empty = data !== null && !inbound.length && !outbound.length

  return (
    <>
      <DateNav date={date} onChange={props.onDateChange} />
      {empty ? (
        <div className="empty">
          <p>이 날짜에는 데이터가 없어요</p>
          {props.canUpload
            ? <button className="btn primary" onClick={props.onGoUpload}>엑셀 올리러 가기</button>
            : <p className="hint">관리자가 올리면 바로 보여요</p>}
        </div>
      ) : (
        <>
          <section className="summary" aria-label="요약">
            <div className="row">
              <span>입고 북항 <b>{inbound.filter((x) => x.port === '북항').length}</b> · 신항 <b>{inbound.filter((x) => x.port === '신항').length}</b></span>
              <span>│ 출고 <b>{outbound.length}</b> (당일착 <b>{outbound.filter((x) => x.sameDay).length}</b>)</span>
            </div>
            <div className="sub">
              입고 {tons(inbound.reduce((s, x) => s + (x.weightKg ?? 0), 0))} / 컨테이너 {inbound.reduce((s, x) => s + x.containers.length, 0)}대
            </div>
          </section>
          <div className="filters" role="group" aria-label="구분">
            {(['전체', '입고', '출고'] as Filter[]).map((f) => (
              <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          {filter !== '출고' && groups.map((g) => (g.length === 1
            ? <InboundCard key={g[0].id} item={g[0]} onOpen={onOpenIn} statuses={statuses} flash={flash} />
            : <InboundGroupCard key={g[0].id} items={g} open={open.has(g[0].id)} onToggle={() => toggle(g[0].id)} onOpen={onOpenIn} statuses={statuses} flash={flash} />))}
          {filter !== '입고' && <OutboundGroups key={props.date} items={outbound} onOpen={props.onOpenOut} inspected={done} />}
        </>
      )}
    </>
  )
}
