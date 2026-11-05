import { useState } from 'react'
import { adminLogin, isValidPin, staffLogin } from '../auth/auth'
import { supabase } from '../storage/cloud/supabase'

export function LoginScreen() {
  const [mode, setMode] = useState<'staff' | 'admin'>('staff')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    if (mode === 'staff') {
      const r = await staffLogin(supabase, pin)
      if (!r.ok) {
        setMessage(r.reason === 'invalid' ? 'PIN이 맞지 않아요' : r.reason === 'locked' ? '잠시 후 다시 시도해 주세요 (약 15분)' : '연결할 수 없어요. 인터넷을 확인해 주세요')
        setPin('')
      }
    } else {
      const r = await adminLogin(supabase, email.trim(), password)
      if (!r.ok) setMessage('이메일 또는 비밀번호가 맞지 않아요')
    }
    setBusy(false)
  }

  return (
    <main className="login">
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={72} height={72} />
      <h1>BNL 입출고</h1>
      <form onSubmit={submit}>
        {mode === 'staff' ? (
          <label>
            회사 PIN (6자리)
            <input type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} pattern="\d{6}"
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus />
          </label>
        ) : (
          <>
            <label>이메일<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
            <label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          </>
        )}
        {message && <p className="login-error" role="alert">{message}</p>}
        <button className="btn primary wide" disabled={busy || (mode === 'staff' ? !isValidPin(pin) : !email || !password)}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
      <button className="link" onClick={() => { setMode(mode === 'staff' ? 'admin' : 'staff'); setMessage('') }}>
        {mode === 'staff' ? '관리자 로그인 ›' : '‹ 직원 PIN 로그인'}
      </button>
    </main>
  )
}
