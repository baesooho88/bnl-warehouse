import { useCallback, useEffect, useState } from 'react'
import { DateNav } from '../components/DateNav'
import { setDone } from '../inspection/inspections'
import { fetchRi, latestRiDate, onRiChange } from '../inspection/ri'
import { useInspections } from '../inspection/useInspections'
import { todayIso } from '../lib/dates'
import { riQty, riWms, type RiItem } from '../parsers/ri'
import { supabase } from '../storage/cloud/supabase'

const time = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** RI: 관리자가 올린 RI 작업표만(B/L 하나에 카드 하나). 검사 완료는 B/L 단위로 모두에게 바로 반영된다(알림은 없음). */
export function RiScreen() {
  const [date, setDate] = useState<string | null>(null)
  const [items, setItems] = useState<RiItem[] | null>(null)
  const { done, reload } = useInspections()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  // 처음엔 가장 최근 작업표 날짜로(없으면 오늘)
  useEffect(() => {
    const today = todayIso(new Date())
    latestRiDate(supabase).then((d) => setDate((cur) => cur ?? d ?? today)).catch(() => setDate((cur) => cur ?? today))
  }, [])

  const loadRi = useCallback(() => {
    if (!date) return
    fetchRi(supabase, date).then(setItems).catch(() => { setItems([]); setMessage('RI 작업표를 불러오지 못했어요. 인터넷을 확인해 주세요') })
  }, [date])
  useEffect(loadRi, [loadRi])
  useEffect(() => onRiChange(supabase, loadRi), [loadRi])

  async function toggle(bl: string, on: boolean) {
    setBusy(bl)
    setMessage('')
    try {
      await setDone(supabase, bl, on)
      reload()
    } catch {
      setMessage('저장하지 못했어요. 인터넷을 확인해 주세요')
    } finally {
      setBusy(null)
    }
  }

  const card = (key: string, bl: string, body: React.ReactNode, side: string[], note: string | null) => {
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
          <div className="card-main">{main}</div>
          {side.length > 0 && <div className="cntr-list">{side.map((s) => <span key={s} className="cntr">{s}</span>)}</div>}
        </div>
        {note && <div className="note-box"><b>비고</b> {note}</div>}
        <div className="ri-actions">
          <button className={`btn${at ? '' : ' primary'}`} disabled={busy === bl} onClick={() => void toggle(bl, !at)}>
            {at ? '되돌리기' : '검사 완료'}
          </button>
        </div>
      </div>
    )
  }

  if (date === null || items === null) return <main className="empty">불러오는 중…</main>

  // 분류 없이 한 목록. 검사 완료가 B/L 단위라 같은 B/L 여러 줄은 카드 하나로, 아직 안 한 것 먼저
  const byBl = new Map<string, RiItem[]>()
  for (const x of items) byBl.set(x.bl, [...(byBl.get(x.bl) ?? []), x])
  const cards = [...byBl.values()].sort((a, b) => Number(done.has(a[0].bl)) - Number(done.has(b[0].bl)))

  return (
    <>
      <DateNav date={date} onChange={setDate} />
      {items.length ? (
        <section className="summary" aria-label="요약">
          <div className="row"><span>RI 작업 <b>{cards.length}</b> (완료 <b>{cards.filter((r) => done.has(r[0].bl)).length}</b>)</span></div>
        </section>
      ) : <p className="empty">이 날짜에는 RI 작업이 없어요</p>}
      {message && <p className="sheet-msg" role="alert">{message}</p>}

      {cards.map((rows) => card(`ri${rows[0].idx}`, rows[0].bl, rows.map((x) => (
        <div key={x.idx}>
          <div className="item">{x.item ?? '(품명 없음)'}</div>
          <div className="meta">{[x.riLocation && `준비 위치 ${x.riLocation}`, x.hull && `호선 ${x.hull}`, x.po && `PO ${x.po}`, riQty(x.qtyText), x.box !== 'ALL' && x.box].filter(Boolean).join(' · ')}</div>
          {(x.presWork || x.presReport) && <div className="meta">PRESERVATION {[x.presWork && `작업필요 ${x.presWork}`, x.presReport && `REPORT ${x.presReport}`].filter(Boolean).join(' · ')}</div>}
        </div>
      )), [...new Set(rows.flatMap((x) => riWms(x.wms)))], rows.map((x) => x.note).filter(Boolean).join(' / ') || null))}

    </>
  )
}
