// 직원 개인 로그인(아이디 + 개인 PIN). 로그인 전에 호출되므로 JWT 검증 없이 배포한다. 공용 PIN 로그인은 없앴다(2026-11-19).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { env, serviceClient } from '../_shared/admin.ts'
import { json, preflight } from '../_shared/http.ts'
import { isLocked, LOCK_WINDOW_MIN, PIN_PATTERN, verifyPin } from '../_shared/pin.ts'
import { LOGIN_ID_PATTERN, staffEmail } from '../_shared/staff.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  const admin = serviceClient()

  // 시도를 먼저 기록하고 센다: 동시에 몰려와도 각자 앞선 시도를 보게 되어 잠금을 건너뛰지 못한다
  const { data: attempt, error: insertError } = await admin.from('login_failures').insert({}).select('id').single()
  if (insertError) return json({ error: 'server' }, 500)
  const forget = () => admin.from('login_failures').delete().eq('id', attempt.id)
  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000).toISOString()
  const { count, error: countError } = await admin.from('login_failures').select('id', { count: 'exact', head: true }).gte('at', since).lt('id', attempt.id)
  if (countError) return json({ error: 'server' }, 500)
  if (isLocked(count ?? 0)) {
    await forget() // 잠긴 동안의 시도는 실패로 세지 않는다(잠금이 끝없이 늘어나지 않게)
    return json({ error: 'locked' }, 423)
  }

  const body = await req.json().catch(() => ({}))
  const pin = typeof body?.pin === 'string' ? body.pin : ''
  const loginId = typeof body?.id === 'string' ? body.id.trim().toLowerCase() : ''
  const fail = async () => {
    // 오래된 실패 기록 정리 (하루 지난 것)
    await admin.from('login_failures').delete().lt('at', new Date(Date.now() - 86_400_000).toISOString())
    return json({ error: 'invalid' }, 401)
  }

  // 비밀번호 없이 일회용 로그인 링크로 세션을 만든다(계정 비밀번호는 아무도 모르는 난수)
  if (!LOGIN_ID_PATTERN.test(loginId) || !PIN_PATTERN.test(pin)) return fail()
  const { data: acc } = await admin.from('staff_accounts').select('user_id, staff_account_pins(pin_hash)').eq('login_id', loginId).maybeSingle()
  const hash = (acc?.staff_account_pins as { pin_hash: string } | null)?.pin_hash
  if (!hash || !(await verifyPin(pin, hash))) return fail()
  await forget()
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: staffEmail(loginId) })
  if (linkError || !link.properties?.hashed_token) return json({ error: 'server' }, 500)
  const { data, error } = await createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
    .auth.verifyOtp({ type: 'email', token_hash: link.properties.hashed_token })
  if (error || !data.session) return json({ error: 'server' }, 500)
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
})
