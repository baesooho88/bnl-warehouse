import { useCallback, useEffect, useState } from 'react'
import { isValidPin } from '../auth/auth'
import { accountAction, ALL_PERMS, fetchAccounts, PERM_LABELS, setPerms, type Perm, type StaffAccount } from '../staff/staff'
import { supabase } from '../storage/cloud/supabase'
import { AdminPanel } from './AdminPanel'

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6)

/** 관리자 전용: 직원 개인 계정과 권한. 공용 PIN 직원은 보기만 한다. */
export function StaffScreen() {
  const [list, setList] = useState<StaffAccount[] | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', loginId: '', pin: '', perms: [] as Perm[] })
  const [pinFor, setPinFor] = useState<{ id: string; pin: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(() => { fetchAccounts(supabase).then(setList).catch(() => setMessage('목록을 불러오지 못했어요')) }, [])
  useEffect(load, [load])

  async function run(fn: () => Promise<void>, done: string) {
    setBusy(true)
    setMessage('')
    try { await fn(); setMessage(done) } catch (e) { setMessage(e instanceof Error ? e.message : '처리하지 못했어요') }
    setBusy(false)
    load()
  }
  const toggle = (ps: Perm[], p: Perm) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p])

  return (
    <>
      <h1 className="screen-title">직원관리</h1>
      <p className="hint">공용 PIN으로 들어온 직원은 보기만 해요. 권한이 필요한 직원은 개인 계정을 만들어 주세요. 직원은 로그인 화면의 '개인 로그인'에서 아이디와 개인 PIN으로 들어와요.</p>
      {message && <p className="hint" role="status">{message}</p>}

      {list?.length === 0 && <p className="empty">아직 개인 계정이 없어요</p>}
      {list?.map((a) => (
        <div key={a.user_id} className="card staff-card">
          <div className="top"><b>{a.name}</b><span>아이디 {a.login_id}</span></div>
          {ALL_PERMS.map((p) => (
            <label key={p} className="staff-perm">
              <input type="checkbox" checked={a.perms.includes(p)} disabled={busy}
                onChange={() => void run(() => setPerms(supabase, a.user_id, toggle(a.perms, p)), `${a.name}: ${PERM_LABELS[p]} ${a.perms.includes(p) ? '끔' : '켬'}`)} />
              {PERM_LABELS[p]}
            </label>
          ))}
          {pinFor?.id === a.user_id ? (
            <form className="pin-form" onSubmit={(e) => { e.preventDefault(); const pin = pinFor.pin; setPinFor(null); void run(() => accountAction(supabase, { action: 'reset-pin', userId: a.user_id, pin }), `${a.name}의 PIN을 바꿨어요. 그 폰은 다시 로그인해야 해요`) }}>
              <input type="password" inputMode="numeric" placeholder="새 개인 PIN 6자리" aria-label={`${a.name} 새 PIN`} value={pinFor.pin} onChange={(e) => setPinFor({ id: a.user_id, pin: digits(e.target.value) })} autoFocus />
              <button className="btn" disabled={busy || !isValidPin(pinFor.pin)}>PIN 바꾸기</button>
            </form>
          ) : (
            <div className="staff-actions">
              <button className="btn" disabled={busy} onClick={() => { setDeleting(null); setPinFor({ id: a.user_id, pin: '' }) }}>PIN 바꾸기</button>
              {deleting === a.user_id
                ? <button className="btn danger" disabled={busy} onClick={() => { setDeleting(null); void run(() => accountAction(supabase, { action: 'delete', userId: a.user_id }), `${a.name} 계정을 지웠어요`) }}>정말 지우기</button>
                : <button className="btn danger" disabled={busy} onClick={() => setDeleting(a.user_id)}>계정 지우기</button>}
            </div>
          )}
        </div>
      ))}

      <h2 className="section-title">개인 계정 추가</h2>
      <form className="staff-form" onSubmit={(e) => {
        e.preventDefault()
        const f = form
        void run(async () => { await accountAction(supabase, { action: 'create', ...f }); setForm({ name: '', loginId: '', pin: '', perms: [] }) }, `${f.name} 계정을 만들었어요`)
      }}>
        <input placeholder="이름" aria-label="이름" maxLength={20} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="아이디 (영문 소문자·숫자)" aria-label="아이디" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20}
          value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })} />
        <input type="password" inputMode="numeric" placeholder="개인 PIN 6자리" aria-label="개인 PIN" value={form.pin} onChange={(e) => setForm({ ...form, pin: digits(e.target.value) })} />
        {ALL_PERMS.map((p) => (
          <label key={p} className="staff-perm">
            <input type="checkbox" checked={form.perms.includes(p)} onChange={() => setForm({ ...form, perms: toggle(form.perms, p) })} />
            {PERM_LABELS[p]}
          </label>
        ))}
        <button className="btn primary" disabled={busy || !form.name.trim() || form.loginId.length < 2 || !isValidPin(form.pin)}>계정 만들기</button>
      </form>

      <AdminPanel />
    </>
  )
}
