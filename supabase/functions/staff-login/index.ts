// 직원 PIN 로그인 (스펙 v2 4.2). 로그인 전에 호출되므로 JWT 검증 없이 배포한다.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { env, serviceClient } from '../_shared/admin.ts'
import { json, preflight } from '../_shared/http.ts'
import { isLocked, LOCK_WINDOW_MIN, PIN_PATTERN, verifyPin } from '../_shared/pin.ts'

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
  const { data: row } = await admin.from('staff_pin').select('pin_hash').eq('id', 1).maybeSingle()
  const ok = PIN_PATTERN.test(pin) && row !== null && (await verifyPin(pin, row.pin_hash))

  if (!ok) {
    // 오래된 실패 기록 정리 (하루 지난 것)
    await admin.from('login_failures').delete().lt('at', new Date(Date.now() - 86_400_000).toISOString())
    return json({ error: 'invalid' }, 401)
  }
  await forget()

  // 직원 세션은 실제 계정이라 누군가 비밀번호를 바꿀 수 있다. 실패하면 서버 비밀 값으로 되돌리고 한 번 더 시도한다.
  const signIn = () =>
    createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
      .auth.signInWithPassword({ email: env('STAFF_EMAIL'), password: env('STAFF_PASSWORD') })
  let { data, error } = await signIn()
  if (error || !data.session) {
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const staff = users?.users.find((u) => u.email === env('STAFF_EMAIL'))
    if (staff) await admin.auth.admin.updateUserById(staff.id, { password: env('STAFF_PASSWORD') })
    ;({ data, error } = await signIn())
  }
  if (error || !data.session) return json({ error: 'server' }, 500)
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
})
