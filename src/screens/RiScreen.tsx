import { useCallback, useEffect, useState } from 'react'
import { DateNav } from '../components/DateNav'
import type { Outbound } from '../domain/types'
import { inspectionList, setDone } from '../inspection/inspections'
import { fetchRi, latestRiDate, onRiChange } from '../inspection/ri'
import { useInspections } from '../inspection/useInspections'
import { addDays, formatMD } from '../lib/dates'
import { riQty, riWms, type RiItem } from '../parsers/ri'
import { repo } from '../repo'
import { supabase } from '../storage/cloud/supabase'

const DAYS = 14 // 최근 2주 출고에서 검사필요 건을 모은다

const time = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** RI: 올린 RI 작업표(준비 위치별) + 출고의 검사필요 건. 검사 완료는 B/L 단위로 모두에게 바로 반영되고 알림이 간다. */
export function RiScreen({ onOpen, dataVersion }: { onOpen: (x: Outbound) => void; dataVersion: number }) {
  const [date, setDate] = useState<string | null>(null)
  const [items, setItems] = useState<RiItem[] | null>(null)
  const [outbound, setOutbound] = useState<Outbound[]>([])
  const { done, reload } = useInspections()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  // 처음엔 가장 최근 작업표 날짜로
  useEffect(() => {
    latestRiDate(supabase).then((d) => setDate((cur) => cur ?? d ?? '')).catch(() => setDate(''))
  }, [])

  const loadRi = useCallback(() => {
    if (!date) return setItems(date === '' ? [] : null)
    fetchRi(supabase, date).then(setItems).catch(() => { setItems([]); setMessage('RI 작업표를 불러오지 못했어요. 인터넷을 확인해 주세요') })
  }, [date])
  useEffect(loadRi, [loadRi])
  useEffect(() => onRiChange(supabase, loadRi), [loadRi])

  useEffect(() => {
    let alive = true
    void (async () => {
      const latest = await repo.latestDate()
      const d = latest ? await repo.getRange(addDays(latest, -(DAYS - 1)), latest) : { outbound: [] }
      if (alive) setOutbound(d.outbound)
    })()
    return () => { alive = false }
  }, [dataVersion])

  async function toggle(bl: string, baseDate: string, on: boolean) {
    setBusy(bl)
    setMessage('')
    try {
      await setDone(supabase, bl, on)
      reload()
      if (on) {
        const { error } = await supabase.functions.invoke('notify', { body: { kind: 'inspection', date: baseDate, bl } })
        if (error) setMessage('완료로 바꿨지만 알림을 보내지 못했어요')
      }
    } catch {
      setMessage('저장하지 못했어요. 인터넷을 확인해 주세요')
    } finally {
      setBusy(null)
    }
  }

  const card = (key: string, bl: string, baseDate: string, body: React.ReactNode, side: string[], note: string | null, open?: () => void) => {
    const at = done.get(bl)
    const main = (
      <>
        <div className="top">
          {at ? <span className="badge ok">완료 {time(at)}</span> : <span className="badge inspect">검사 대기</span>}
          <b className="bl">{bl}</b>
        </div>
        {body}
      </>
    )
    return (
      <div key={key} className={`card ri-card${at ? ' ri-ok' : ''}`}>
        <div className="card-row">
          {open ? <button className="card-main ri-info" onClick={open}>{main}</button> : <div className="card-main">{main}</div>}
          {side.length > 0 && <div className="cntr-list">{side.map((s) => <span key={s} className="cntr">{s}</span>)}</div>}
        </div>
        {note && <div className="note-box"><b>비고</b> {note}</div>}
        <div className="ri-actions">
          <button className={`btn${at ? '' : ' primary'}`} disabled={busy === bl} onClick={() => void toggle(bl, baseDate, !at)}>
            {at ? '되돌리기' : '검사 완료'}
          </button>
        </div>
      </div>
    )
  }

  if (date === null || items === null) return <main className="empty">불러오는 중…</main>

  // 준비 위치별로(파일에 나온 순서), 위치 안에서는 아직 안 한 것 먼저
  const groups = new Map<string, RiItem[]>()
  for (const x of items) groups.set(x.riLocation ?? '위치 없음', [...(groups.get(x.riLocation ?? '위치 없음') ?? []), x])
  const riBls = new Set(items.map((x) => x.bl))
  const out = inspectionList(outbound.filter((x) => !x.bl || !riBls.has(x.bl)), done)

  return (
    <>
      {date ? <DateNav date={date} onChange={setDate} /> : <h1 className="screen-title">RI</h1>}
      <section className="summary" aria-label="요약">
        <div className="row">
          <span>RI 작업 <b>{items.length}</b> (완료 <b>{items.filter((x) => done.has(x.bl)).length}</b>)</span>
          <span>│ 출고 검사필요 <b>{out.pending.length}</b></span>
        </div>
        {!items.length && <div className="sub">{date ? '이 날짜에 올린 RI 작업표가 없어요' : '관리자가 RI 준비자재 파일을 올리면 여기에 보여요'}</div>}
      </section>
      {message && <p className="sheet-msg" role="alert">{message}</p>}

      {[...groups].map(([loc, list]) => (
        <section key={loc}>
          <h2 className="card-date">RI 준비 위치 {loc} · {list.length}건</h2>
          {[...list].sort((a, b) => Number(done.has(a.bl)) - Number(done.has(b.bl))).map((x) => card(`ri${x.idx}`, x.bl, x.baseDate, (
            <>
              <div className="item">{x.item ?? '(품명 없음)'}</div>
              <div className="meta">{[x.hull && `호선 ${x.hull}`, x.po && `PO ${x.po}`, riQty(x.qtyText), x.box !== 'ALL' && x.box].filter(Boolean).join(' · ')}</div>
              {(x.presWork || x.presReport) && <div className="meta">PRESERVATION {[x.presWork && `작업필요 ${x.presWork}`, x.presReport && `REPORT ${x.presReport}`].filter(Boolean).join(' · ')}</div>}
            </>
          ), riWms(x.wms), x.note))}
        </section>
      ))}

      {(out.pending.length > 0 || out.done.length > 0) && (
        <section>
          <h2 className="card-date">출고 검사필요 · 최근 {DAYS}일 (입고 검수 '대기')</h2>
          {[...out.pending, ...out.done].map((x) => card(x.id, x.bl!, x.baseDate, (
            <>
              <div className="item">{x.item ?? '(품명 없음)'}</div>
              <div className="meta">출고 {formatMD(x.baseDate)}{x.destination && ` · ${x.destination}`}{x.qtyText && ` · ${x.qtyText}`}</div>
            </>
          ), [], null, () => onOpen(x)))}
        </section>
      )}
    </>
  )
}
