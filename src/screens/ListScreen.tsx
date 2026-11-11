import { useEffect, useState } from 'react'
import { DateNav } from '../components/DateNav'
import { tons } from '../components/format'
import { InboundCard } from '../components/InboundCard'
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
  onOpenIn: (x: Inbound) => void
  onOpenOut: (x: Outbound) => void
  onGoUpload: () => void
  canUpload: boolean
  dataVersion: number
}) {
  const { date, dataVersion } = props
  const [data, setData] = useState<DayData | null>(null)
  const [filter, setFilter] = useState<Filter>('전체')

  useEffect(() => {
    let alive = true
    repo.getRange(date, date).then((d) => alive && setData(d))
    return () => { alive = false }
  }, [date, dataVersion])

  const inbound = data?.inbound ?? []
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
          {filter !== '출고' && inbound.map((x) => <InboundCard key={x.id} item={x} onOpen={props.onOpenIn} statuses={statuses} />)}
          {filter !== '입고' && <OutboundGroups key={props.date} items={outbound} onOpen={props.onOpenOut} inspected={done} />}
        </>
      )}
    </>
  )
}
