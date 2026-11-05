import { useState } from 'react'
import { isValidPin } from '../auth/auth'
import { supabase } from '../storage/cloud/supabase'

export function AdminPanel() {
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6)

  async function change(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidPin(pin)) return setMessage('PIN은 6자리 숫자여야 해요')
    if (pin !== again) return setMessage('두 번 입력한 PIN이 달라요')
    setBusy(true)
    const { error } = await supabase.functions.invoke('set-staff-pin', { body: { pin } })
    setBusy(false)
    setPin('')
    setAgain('')
    setMessage(error ? '바꾸지 못했어요. 다시 시도해 주세요' : 'PIN을 바꿨어요. 직원 폰은 1시간 안에 로그아웃돼요')
  }

  return (
    <section>
      <h2 className="section-title">직원 PIN 변경</h2>
      <form className="pin-form" onSubmit={change}>
        <input type="password" inputMode="numeric" placeholder="새 PIN 6자리" aria-label="새 PIN" value={pin} onChange={(e) => setPin(digits(e.target.value))} />
        <input type="password" inputMode="numeric" placeholder="한 번 더" aria-label="새 PIN 확인" value={again} onChange={(e) => setAgain(digits(e.target.value))} />
        <button className="btn" disabled={busy || pin.length !== 6 || again.length !== 6}>{busy ? '바꾸는 중…' : 'PIN 바꾸기'}</button>
      </form>
      {message && <p className="hint" role="status">{message}</p>}
    </section>
  )
}
