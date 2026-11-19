// 직원 개인 계정 만들기·지우기·PIN 바꾸기 (관리자만). 권한(perms) 수정은 앱이 표를 바로 고친다(RLS).
import { requireAdmin, serviceClient } from '../_shared/admin.ts'
import { json, preflight } from '../_shared/http.ts'
import { hashPin, PIN_PATTERN } from '../_shared/pin.ts'
import { LOGIN_ID_PATTERN, PERMS, staffEmail } from '../_shared/staff.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  const who = await requireAdmin(req)
  if (who instanceof Response) return who

  const body = await req.json().catch(() => ({}))
  const admin = serviceClient()
  const pin = typeof body?.pin === 'string' ? body.pin : ''

  if (body?.action === 'create') {
    const loginId = typeof body.loginId === 'string' ? body.loginId.trim().toLowerCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const perms = Array.isArray(body.perms) ? body.perms.filter((p: unknown) => PERMS.includes(p as never)) : []
    if (!LOGIN_ID_PATTERN.test(loginId)) return json({ error: '아이디는 영문 소문자·숫자 2~20자예요' }, 400)
    if (!name || name.length > 20) return json({ error: '이름은 1~20자예요' }, 400)
    if (!PIN_PATTERN.test(pin)) return json({ error: 'PIN은 6자리 숫자여야 해요' }, 400)
    const { data: taken } = await admin.from('staff_accounts').select('user_id').eq('login_id', loginId).maybeSingle()
    if (taken) return json({ error: '이미 있는 아이디예요' }, 409)

    // 비밀번호는 아무도 모르는 긴 난수: 로그인은 PIN을 확인한 서버 함수로만 된다
    const password = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
    const { data: created, error } = await admin.auth.admin.createUser({
      email: staffEmail(loginId), password, email_confirm: true, app_metadata: { role: 'staff' },
    })
    if (error || !created.user) return json({ error: error?.message ?? 'server' }, 500)
    const userId = created.user.id
    const { error: e1 } = await admin.from('staff_accounts').insert({ user_id: userId, login_id: loginId, name, perms })
    const { error: e2 } = e1 ? { error: null } : await admin.from('staff_account_pins').insert({ user_id: userId, pin_hash: await hashPin(pin) })
    if (e1 || e2) {
      await admin.auth.admin.deleteUser(userId) // 반쯤 만들어진 계정을 남기지 않는다
      return json({ error: (e1 ?? e2)!.message }, 500)
    }
    return json({ ok: true, userId })
  }

  const userId = typeof body?.userId === 'string' ? body.userId : ''
  const { data: account } = await admin.from('staff_accounts').select('user_id').eq('user_id', userId).maybeSingle()
  if (!account) return json({ error: '없는 계정이에요' }, 404) // 관리자·공용 계정은 여기서 건드리지 못한다

  if (body?.action === 'delete') {
    const { error } = await admin.auth.admin.deleteUser(userId) // 표·PIN·알림 구독은 함께 지워진다
    return error ? json({ error: error.message }, 500) : json({ ok: true })
  }
  if (body?.action === 'reset-pin') {
    if (!PIN_PATTERN.test(pin)) return json({ error: 'PIN은 6자리 숫자여야 해요' }, 400)
    const { error } = await admin.from('staff_account_pins').upsert({ user_id: userId, pin_hash: await hashPin(pin) })
    if (error) return json({ error: error.message }, 500)
    await admin.rpc('revoke_staff_sessions', { staff_id: userId }) // 그 직원 폰은 로그아웃
    return json({ ok: true })
  }
  return json({ error: 'bad request' }, 400)
})
