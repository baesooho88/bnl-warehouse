import { useEffect, useRef, useState } from 'react'
import { formatDay } from '../lib/dates'
import { normalizeName, suggestNames, VACATION_TYPES, type VacationType } from '../vacation/calendar'
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
    if ((await run(() => addVacation(supabase, { date, name, type }))) === 'ok') setName('')
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${formatDay(date)} 휴가`} onClick={(e) => e.stopPropagation()}>
        <header>
          <strong>{formatDay(date)} 휴가</strong>
          <button className="sheet-close" onClick={close} aria-label="닫기">✕</button>
        </header>
        {items.length === 0 ? (
          <p className="muted">휴가자가 없어요</p>
        ) : (
          <ul className="vac-list">
            {items.map((v) => (
              <li key={v.id}>
                <span>{v.name} · {v.type}</span>
                {canEdit && <button className="btn danger" disabled={busy} onClick={() => void run(() => deleteVacation(supabase, v.id))}>삭제</button>}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="vac-add">
            <input aria-label="이름" placeholder="이름 (성만 쳐도 찾아요)" autoComplete="off" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
            <select aria-label="종류" value={type} onChange={(e) => setType(e.target.value as VacationType)}>
              {VACATION_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <button className="btn primary" disabled={busy || !normalizeName(name)} onClick={() => void add()}>추가</button>
          </div>
        )}
        {canEdit && suggestNames(names, name).length > 0 && (
          <div className="vac-suggest" role="listbox" aria-label="이름 추천">
            {suggestNames(names, name).map((n) => <button key={n} role="option" aria-selected={false} onClick={() => setName(n)}>{n}</button>)}
          </div>
        )}
        {message && <p className="sheet-msg" role="alert">{message}</p>}
      </div>
    </div>
  )
}
