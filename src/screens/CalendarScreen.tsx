import { useCallback, useEffect, useRef, useState } from 'react'
import { VacationSheet } from '../components/VacationSheet'
import { todayIso } from '../lib/dates'
import { supabase } from '../storage/cloud/supabase'
import { cellSummary, dayEntries, monthGrid, monthOf, shiftMonth } from '../vacation/calendar'
import { fetchMonth, onVacationChange, recentNames, type Vacation } from '../vacation/vacations'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
// 칸이 좁아 이름만 쓰고 종류는 색으로 (연차·반차·기타)
// 칸이 좁아 '10:00' → '10시', '09:30' → '9:30'
const shortTime = (t: string) => (t.endsWith(':00') ? `${+t.slice(0, 2)}시` : `${+t.slice(0, 2)}:${t.slice(3)}`)
// 공휴일은 앱이 떠 있는 동안 한 번만 받는다(실패하면 다음 화면 진입 때 다시)
let holidaysReq: Promise<Map<string, string>> | null = null
const fetchHolidays = () =>
  (holidaysReq ??= supabase.functions.invoke<{ date: string; name: string }[]>('holidays').then(({ data, error }) => {
    if (error || !data) throw error ?? new Error('no data')
    return new Map(data.map((h) => [h.date, h.name]))
  }).catch((e) => { holidaysReq = null; throw e }))
const typeClass = (t: string) => (t === '일정' ? 'event' : t === '연차' ? 'full' : t === '기타' ? 'etc' : 'half')

export function CalendarScreen({ canEdit }: { canEdit: boolean }) {
  const today = todayIso(new Date())
  const [ym, setYm] = useState(() => monthOf(today))
  const [items, setItems] = useState<Vacation[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'offline' | 'error'>('loading')
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [names, setNames] = useState<string[]>([])
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map())
  useEffect(() => { fetchHolidays().then(setHolidays).catch(() => {}) }, [])
  const current = useRef(ym)
  current.current = ym
  const latest = useRef(0)

  const load = useCallback(async () => {
    const seq = ++latest.current // 가장 마지막 요청의 응답만 쓴다(달을 넘겼거나 같은 달을 다시 받은 경우)
    if (!navigator.onLine) return setState('offline')
    try {
      const rows = await fetchMonth(supabase, current.current)
      if (seq !== latest.current) return
      setItems(rows)
      setState('ok')
    } catch {
      if (seq === latest.current) setState(navigator.onLine ? 'error' : 'offline')
    }
  }, [])

  useEffect(() => {
    setItems([])
    setState('loading')
    void load()
  }, [ym, load])

  // 화면이 떠 있는 동안: 실시간 변경·재연결·앱 복귀 때 다시 받는다(백그라운드 중 놓친 실시간 이벤트는 다시 오지 않음)
  useEffect(() => {
    const off = onVacationChange(supabase, () => void load())
    const onOnline = () => void load()
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => { off(); window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible) }
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
      <div className="cal-legend"><span className="cal-name full">연차</span><span className="cal-name half">반차</span><span className="cal-name etc">기타</span><span className="cal-name event">일정</span></div>
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
            const { shown, more } = cellSummary(dayEntries(list))
            const dow = i % 7
            const holiday = holidays.get(d)
            return (
              <button key={d} className={`cal-cell${d === today ? ' today' : ''}`} onClick={() => setOpenDate(d)}>
                <span className={`cal-d${dow === 0 || holiday ? ' sun' : dow === 6 ? ' sat' : ''}`}>{+d.slice(8)}</span>
                {holiday && <span className="cal-hol">{holiday}</span>}
                {shown.map((v) => <span key={v.id} className={`cal-name ${typeClass(v.type)}`}>{v.type === '일정' && v.time ? `${shortTime(v.time)} ` : ''}{v.name}</span>)}
                {more > 0 && <span className="cal-more">+{more}</span>}
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
