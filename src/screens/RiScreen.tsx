import { useEffect, useState } from 'react'
import type { Outbound } from '../domain/types'
import { inspectionList, setDone } from '../inspection/inspections'
import { useInspections } from '../inspection/useInspections'
import { addDays, formatMD } from '../lib/dates'
import { repo } from '../repo'
import { supabase } from '../storage/cloud/supabase'

const DAYS = 14 // 최근 2주 출고에서 검사 대기 건을 모은다

/** RI: 검사할 B/L 목록. 완료를 누르면 모두에게 바로 반영되고 알림이 간다. */
export function RiScreen({ onOpen, dataVersion }: { onOpen: (x: Outbound) => void; dataVersion: number }) {
  const [outbound, setOutbound] = useState<Outbound[] | null>(null)
  const { done, reload } = useInspections()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    void (async () => {
      const latest = await repo.latestDate()
      const d = latest ? await repo.getRange(addDays(latest, -(DAYS - 1)), latest) : { outbound: [] }
      if (alive) setOutbound(d.outbound)
    })()
    return () => { alive = false }
  }, [dataVersion])

  async function toggle(x: Outbound, on: boolean) {
    setBusy(x.bl)
    setMessage('')
    try {
      await setDone(supabase, x.bl!, on)
      reload()
      if (on) {
        const { error } = await supabase.functions.invoke('notify', { body: { kind: 'inspection', date: x.baseDate, bl: x.bl } })
        if (error) setMessage('완료로 바꿨지만 알림을 보내지 못했어요')
      }
    } catch {
      setMessage('저장하지 못했어요. 인터넷을 확인해 주세요')
    } finally {
      setBusy(null)
    }
  }

  if (!outbound) return <main className="empty">불러오는 중…</main>
  const list = inspectionList(outbound, done)
  const time = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const card = (x: Outbound, isDone: boolean) => (
    <div key={x.bl} className={`card ri-card${isDone ? ' ri-ok' : ''}`}>
      <button className="ri-info" onClick={() => onOpen(x)}>
        <div className="top">
          {isDone ? <span className="badge ok">완료 {time(done.get(x.bl!)!)}</span> : <span className="badge inspect">검사필요</span>}
          <b className="bl">{x.bl}</b>
        </div>
        <div className="item">{x.item ?? '(품명 없음)'}</div>
        <div className="meta">출고 {formatMD(x.baseDate)}{x.destination && ` · ${x.destination}`}{x.qtyText && ` · ${x.qtyText}`}</div>
      </button>
      <button className={`btn${isDone ? '' : ' primary'}`} disabled={busy === x.bl} onClick={() => void toggle(x, !isDone)}>
        {isDone ? '되돌리기' : '검사 완료'}
      </button>
    </div>
  )

  return (
    <>
      <h1 className="screen-title">RI 검사 목록</h1>
      <section className="summary" aria-label="요약">
        <div className="row"><span>검사 대기 <b>{list.pending.length}</b></span><span>│ 완료 <b>{list.done.length}</b></span></div>
        <div className="sub">최근 {DAYS}일 출고 중 입고 검수가 '대기'인 B/L</div>
      </section>
      {message && <p className="sheet-msg" role="alert">{message}</p>}
      {!list.pending.length && <p className="empty">검사할 건이 없어요</p>}
      {list.pending.map((x) => card(x, false))}
      {list.done.length > 0 && <h2 className="card-date">완료</h2>}
      {list.done.map((x) => card(x, true))}
    </>
  )
}
