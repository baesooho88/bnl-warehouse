// 직원 PIN 로그인 (스펙 v2 4.2). 로그인 전에 호출되므로 JWT 검증 없이 배포한다.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { env, serviceClient } from '../_shared/admin.ts'
import { json, preflight } from '../_shared/http.ts'
import { isLocked, LOCK_WINDOW_MIN, PIN_PATTERN, verifyPin } from '../_shared/pin.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  const admin = serviceClient()

  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000).toISOString()
  const { count, error: countError } = await admin.from('login_failures').select('id', { count: 'exact', head: true }).gte('at', since)
  if (countError) return json({ error: 'server' }, 500)
  if (isLocked(count ?? 0)) return json({ error: 'locked' }, 423)

  const body = await req.json().catch(() => ({}))
  const pin = typeof body?.pin === 'string' ? body.pin : ''
  const { data: row } = await admin.from('staff_pin').select('pin_hash').eq('id', 1).maybeSingle()
  const ok = PIN_PATTERN.test(pin) && row !== null && (await verifyPin(pin, row.pin_hash))

  if (!ok) {
    await admin.from('login_failures').insert({})
    // 오래된 실패 기록 정리 (하루 지난 것)
    await admin.from('login_failures').delete().lt('at', new Date(Date.now() - 86_400_000).toISOString())
    return json({ error: 'invalid' }, 401)
  }

  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email: env('STAFF_EMAIL'), password: env('STAFF_PASSWORD') })
  if (error || !data.session) return json({ error: 'server' }, 500)
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
})
