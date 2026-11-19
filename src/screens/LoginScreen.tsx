import { useState } from 'react'
import { adminEmail, adminLogin, isValidPin, staffLogin } from '../auth/auth'
import { supabase } from '../storage/cloud/supabase'

const ID_KEY = 'bnl-admin-id' // 이 기기에 저장한 관리자 아이디
const STAFF_ID_KEY = 'bnl-staff-id' // 이 기기에 저장한 직원 개인 아이디
const saved = (k: string) => { try { return localStorage.getItem(k) ?? '' } catch { return '' } }

export function LoginScreen() {
  const [mode, setMode] = useState<'staff' | 'admin'>('staff')
  const [staffId, setStaffId] = useState(() => saved(STAFF_ID_KEY))
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState(() => saved(ID_KEY))
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    if (mode !== 'admin') {
      const r = await staffLogin(supabase, pin, staffId)
      if (!r.ok) {
        setMessage(r.reason === 'invalid' ? '아이디 또는 PIN이 맞지 않아요' : r.reason === 'locked' ? '잠시 후 다시 시도해 주세요 (약 15분)' : '연결할 수 없어요. 인터넷을 확인해 주세요')
        setPin('')
      } else try { localStorage.setItem(STAFF_ID_KEY, staffId.trim()) } catch { /* 저장 못 해도 로그인은 됨 */ }
    } else {
      const r = await adminLogin(supabase, adminEmail(email), password)
      if (!r.ok) setMessage('아이디 또는 비밀번호가 맞지 않아요')
      else try { localStorage.setItem(ID_KEY, email.trim()) } catch { /* 저장 못 해도 로그인은 됨 */ }
    }
    setBusy(false)
  }

  return (
    <main className="login">
      <img className="login-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="BNL" width={220} height={82} />
      <h1>(주)부산신항로지텍</h1>
      <form onSubmit={submit}>
        {mode !== 'admin' ? (
          <>
          <label>아이디<input autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" value={staffId} onChange={(e) => setStaffId(e.target.value)} autoFocus={!staffId} /></label>
          <label>
            개인 PIN (6자리)
            <input type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} pattern="\d{6}"
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus={!!staffId} />
          </label>
          </>
        ) : (
          <>
            <label>아이디<input autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!email} /></label>
            <label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={!!email} /></label>
          </>
        )}
        {message && <p className="login-error" role="alert">{message}</p>}
        <button className="btn primary wide" disabled={busy || (mode === 'admin' ? !email || !password : !isValidPin(pin) || !staffId.trim())}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
      <button className="link" onClick={() => { setMode(mode === 'staff' ? 'admin' : 'staff'); setPin(''); setMessage('') }}>
        {mode === 'staff' ? '관리자 로그인 ›' : '‹ 직원 로그인'}
      </button>
    </main>
  )
}
