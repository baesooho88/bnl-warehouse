import { useEffect, useRef, useState } from 'react'
import { formatDay } from '../lib/dates'
import { dayEntries, normalizeName, suggestNames, VACATION_TYPES, type VacationType } from '../vacation/calendar'
import { addVacation, deleteVacation, type Vacation } from '../vacation/vacations'
import { supabase } from '../storage/cloud/supabase'

/** 날짜 팝업. items는 달력이 가진 목록에서 그날 것만 받으므로 실시간 변경도 그대로 반영된다. */
export function VacationSheet({ date, items, canEdit, names, onClose, onChanged }: {
  date: string
  items: Vacation[]
  canEdit: boolean
  names: string[]
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<VacationType>('연차')
  const [mode, setMode] = useState<'휴가' | '일정'>('휴가')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  // 휴대폰 뒤로가기 버튼으로 팝업만 닫는다 (DetailScreen과 같은 방식)
  useEffect(() => {
    if (!history.state?.sheet) history.pushState({ sheet: true }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onClose])
  const closing = useRef(false)
  const close = () => {
    if (closing.current) return
    closing.current = true
    history.back()
  }

  async function run(job: () => Promise<'ok' | 'duplicate' | void>) {
    setBusy(true)
    setMessage('')
    try {
      const r = await job()
      if (r === 'duplicate') return setMessage('이미 있어요')
      onChanged()
      return r
    } catch {
      setMessage('저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }

  async function add() {
    const v = mode === '일정' ? { date, name, type: '일정' as const, time } : { date, name, type }
    if ((await run(() => addVacation(supabase, v))) === 'ok') { setName(''); setTime('') }
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${formatDay(date)} 일정·휴가`} onClick={(e) => e.stopPropagation()}>
        <header>
          <strong>{formatDay(date)}</strong>
          <button className="sheet-close" onClick={close} aria-label="닫기">✕</button>
        </header>
        {items.length === 0 ? (
          <p className="muted">일정·휴가가 없어요</p>
        ) : (
          <ul className="vac-list">
            {dayEntries(items).map((v) => (
              <li key={v.id} className={v.type === '일정' ? 'event' : undefined}>
                <span>{v.type === '일정' ? <><b>{v.time ?? '종일'}</b> {v.name}</> : <>{v.name} · {v.type}</>}</span>
                {canEdit && <button className="btn danger" disabled={busy} onClick={() => void run(() => deleteVacation(supabase, v.id))}>삭제</button>}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <>
            <div className="filters vac-mode" role="group" aria-label="추가할 종류">
              {(['휴가', '일정'] as const).map((m) => <button key={m} aria-pressed={mode === m} onClick={() => { setMode(m); setName('') }}>{m}</button>)}
            </div>
            <div className="vac-add">
              {mode === '휴가' ? (
                <>
                  <input aria-label="이름" placeholder="이름 (성만 쳐도 찾아요)" autoComplete="off" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
                  <select aria-label="종류" value={type} onChange={(e) => setType(e.target.value as VacationType)}>
                    {VACATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <input aria-label="일정 내용" placeholder="예: ○○부장 방문" autoComplete="off" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
                  <input aria-label="시간(선택)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </>
              )}
              <button className="btn primary" disabled={busy || !normalizeName(name, mode === '일정' ? 30 : 20)} onClick={() => void add()}>추가</button>
            </div>
          </>
        )}
        {canEdit && mode === '휴가' && suggestNames(names, name).length > 0 && (
          <div className="vac-suggest" role="listbox" aria-label="이름 추천">
            {suggestNames(names, name).map((n) => <button key={n} role="option" aria-selected={false} onClick={() => setName(n)}>{n}</button>)}
          </div>
        )}
        {message && <p className="sheet-msg" role="alert">{message}</p>}
      </div>
    </div>
  )
}
