// 직원 PIN 변경 (스펙 v2 4.4): PIN 해시 교체 → 직원 세션 무효화 → 직원 푸시 구독 삭제
import { env, requireAdmin, serviceClient } from '../_shared/admin.ts'
import { json, preflight } from '../_shared/http.ts'
import { hashPin, PIN_PATTERN } from '../_shared/pin.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  const who = await requireAdmin(req)
  if (who instanceof Response) return who

  const body = await req.json().catch(() => ({}))
  const pin = typeof body?.pin === 'string' ? body.pin : ''
  if (!PIN_PATTERN.test(pin)) return json({ error: 'PIN은 6자리 숫자여야 해요' }, 400)

  const admin = serviceClient()
  const { error: pinError } = await admin.from('staff_pin').upsert({ id: 1, pin_hash: await hashPin(pin), updated_at: new Date().toISOString() })
  if (pinError) return json({ error: pinError.message }, 500)

  const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) return json({ error: listError.message }, 500)
  const staff = users.users.find((u) => u.email === env('STAFF_EMAIL'))
  if (staff) {
    const { error: revokeError } = await admin.rpc('revoke_staff_sessions', { staff_id: staff.id })
    if (revokeError) return json({ error: revokeError.message }, 500)
    await admin.from('push_subscriptions').delete().eq('user_id', staff.id)
  }
  return json({ ok: true })
})
