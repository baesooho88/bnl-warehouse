import { useCallback, useEffect, useRef, useState } from 'react'
import { VacationSheet } from '../components/VacationSheet'
import { todayIso } from '../lib/dates'
import { supabase } from '../storage/cloud/supabase'
import { cellSummary, monthGrid, monthOf, shiftMonth } from '../vacation/calendar'
import { fetchMonth, onVacationChange, recentNames, type Vacation } from '../vacation/vacations'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
// 칸이 좁아 이름만 쓰고 종류는 색으로 (연차·반차·기타)
const typeClass = (t: string) => (t === '연차' ? 'full' : t === '기타' ? 'etc' : 'half')

export function CalendarScreen({ canEdit }: { canEdit: boolean }) {
  const today = todayIso(new Date())
  const [ym, setYm] = useState(() => monthOf(today))
  const [items, setItems] = useState<Vacation[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'offline' | 'error'>('loading')
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [names, setNames] = useState<string[]>([])
  const current = useRef(ym)
  current.current = ym

  const load = useCallback(async () => {
    const target = current.current
    if (!navigator.onLine) return setState('offline')
    try {
      const rows = await fetchMonth(supabase, target)
      if (target !== current.current) return // 그사이 달을 넘겼으면 늦게 온 응답은 버린다
      setItems(rows)
      setState('ok')
    } catch {
      if (target === current.current) setState(navigator.onLine ? 'error' : 'offline')
    }
  }, [])

  useEffect(() => {
    setItems([])
    setState('loading')
    void load()
  }, [ym, load])

  // 화면이 떠 있는 동안: 실시간 변경·재연결 때 다시 받는다
  useEffect(() => {
    const off = onVacationChange(supabase, () => void load())
    const onOnline = () => void load()
    window.addEventListener('online', onOnline)
    return () => { off(); window.removeEventListener('online', onOnline) }
  }, [load])

  const refreshNames = useCallback(() => {
    if (canEdit) void recentNames(supabase).then(setNames).catch(() => {})
  }, [canEdit])
  useEffect(refreshNames, [refreshNames])

  const closeSheet = useCallback(() => setOpenDate(null), [])
  const changed = useCallback(() => { void load(); refreshNames() }, [load, refreshNames])

  const byDate = new Map<string, Vacation[]>()
  for (const v of items) byDate.set(v.date, [...(byDate.get(v.date) ?? []), v])

  return (
    <main>
      <div className="cal-head">
        <button onClick={() => setYm(shiftMonth(ym, -1))} aria-label="이전 달">◀</button>
        <strong>{+ym.slice(0, 4)}년 {+ym.slice(5, 7)}월</strong>
        <button onClick={() => setYm(shiftMonth(ym, 1))} aria-label="다음 달">▶</button>
      </div>
      <div className="cal-legend"><span className="cal-name full">연차</span><span className="cal-name half">반차</span><span className="cal-name etc">기타</span></div>
      {state === 'offline' || state === 'error' ? (
        <div className="empty">
          <p>{state === 'offline' ? '인터넷 연결이 필요해요' : '불러오지 못했어요'}</p>
          <button className="btn" onClick={() => void load()}>다시 시도</button>
        </div>
      ) : (
        <div className="cal" aria-busy={state === 'loading'}>
          {WEEK.map((w, i) => <div key={w} className={`cal-w${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{w}</div>)}
          {monthGrid(ym).flat().map((d, i) => {
            if (!d) return <div key={`x${i}`} className="cal-cell blank" />
            const list = byDate.get(d) ?? []
            const { shown, more } = cellSummary(list)
            const dow = i % 7
            return (
              <button key={d} className={`cal-cell${d === today ? ' today' : ''}`} onClick={() => setOpenDate(d)}>
                <span className={`cal-d${dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}`}>{+d.slice(8)}</span>
                {shown.map((v) => <span key={v.id} className={`cal-name ${typeClass(v.type)}`}>{v.name}</span>)}
                {more > 0 && <span className="cal-more">+{more}명</span>}
              </button>
            )
          })}
        </div>
      )}
      {openDate && (
        <VacationSheet date={openDate} items={byDate.get(openDate) ?? []} canEdit={canEdit} names={names} onClose={closeSheet} onChanged={changed} />
      )}
    </main>
  )
}
