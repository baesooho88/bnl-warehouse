// 원격 Supabase 프로젝트의 권한·PIN·업로드·실시간·알림 권한을 실제로 확인한다.
// 사용: ADMIN_EMAIL=… ADMIN_PASSWORD=… STAFF_PIN=… node --env-file=.env.local scripts/verify-cloud.mjs
// 비밀 값은 출력하지 않는다. 테스트 행은 2099-01-01(신항)에만 쓰고 끝에 지운다.
// 잠금(20회 실패)은 실제 직원을 15분 막으므로 여기서 하지 않는다(tests/pin.test.ts).
import { createClient } from '@supabase/supabase-js'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, ADMIN_EMAIL, ADMIN_PASSWORD, STAFF_PIN } = process.env
if (!url || !key || !ADMIN_EMAIL || !ADMIN_PASSWORD || !STAFF_PIN) {
  console.error('필요: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY(.env.local), ADMIN_EMAIL, ADMIN_PASSWORD, STAFF_PIN')
  process.exit(2)
}

const TEST_DATE = '2099-01-01'
const KIND = '입고-신항'
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
let failed = 0
const check = (ok, text) => { if (!ok) failed++; console.log(`${ok ? '✅' : '❌'} ${text}`) }
const row = (n) => ({ id: `verify-${n}`, port: '신항', base_date: TEST_DATE, bl: `VERIFY${n}`, containers: [], raw: {} })
const countTest = async (c) => (await c.from('inbound').select('id', { count: 'exact', head: true }).eq('base_date', TEST_DATE)).count
const maxLog = async (c) => (await c.from('upload_log').select('id').order('id', { ascending: false }).limit(1)).data?.[0]?.id ?? 0
const callFn = (name, body, token) =>
  fetch(`${url}/functions/v1/${name}`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? key}` }, body: JSON.stringify(body) })

// 1. 비로그인
const anon = client()
for (const t of ['inbound', 'outbound', 'upload_log']) {
  const { data, error } = await anon.from(t).select('*').limit(1)
  check(!!error || data.length === 0, `비로그인 ${t} 읽기 차단`)
}

// 2. PIN
const wrong = String((Number(STAFF_PIN) + 1) % 1_000_000).padStart(6, '0')
check((await callFn('staff-login', { pin: wrong })).status === 401, '틀린 PIN → 401')
const res = await callFn('staff-login', { pin: STAFF_PIN })
const staff = client()
if (res.status === 200) await staff.auth.setSession(await res.json())
const staffSession = (await staff.auth.getSession()).data.session
check(staffSession?.user.app_metadata.role === 'staff', '맞는 PIN → 직원 세션(role=staff)')

// 3·4. 관리자 업로드, 직원 쓰기 차단
const admin = client()
const signin = await admin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
check(signin.data.user?.app_metadata.role === 'admin', '관리자 로그인(role=admin)')
const replace = (c, rows) => c.rpc('replace_days', { kind: KIND, base_dates: [TEST_DATE], rows, file_name: 'verify-cloud' })

// 5. 실시간: 직원이 구독한 뒤 관리자가 올린다
let gotEvent
const event = new Promise((r) => { gotEvent = r })
const channel = staff.channel('verify').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'upload_log' }, () => gotEvent(true))
await new Promise((r) => channel.subscribe((s) => { if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') r() }))

try {
  const log0 = await maxLog(admin)
  const first = await replace(admin, [row(1), row(2)])
  check(!first.error && (await countTest(admin)) === 2 && (await maxLog(admin)) > log0, '관리자 replace_days 성공 + 업로드 기록 추가')
  check(await Promise.race([event, new Promise((r) => setTimeout(() => r(false), 10_000))]), '직원이 업로드 기록을 실시간으로 받음(10초 안)')
  await replace(admin, [row(1), row(2)])
  check((await countTest(admin)) === 2, '같은 날짜 다시 올리면 행 수 그대로(통째 교체)')
  const log1 = await maxLog(admin)
  const bad = await replace(admin, [row(3), row(3)])
  check(!!bad.error && (await countTest(admin)) === 2 && (await maxLog(admin)) === log1, '잘못된 행(id 중복) → 실패하고 기존 행·기록 유지(롤백)')

  check(((await staff.from('inbound').select('id').limit(1)).data ?? []).length > 0, '직원 읽기 가능')
  check(!!(await staff.from('inbound').insert(row(9))).error, '직원 inbound 쓰기 거부')
  await staff.from('inbound').delete().eq('base_date', TEST_DATE)
  check((await countTest(admin)) === 2, '직원 inbound 삭제 무효')
  check(!!(await replace(staff, [])).error, '직원 replace_days 거부')
  check(((await staff.from('staff_pin').select('*')).data ?? []).length === 0, '직원 staff_pin 읽기 0행')

  // 6. 알림은 관리자만
  check((await callFn('notify', { date: TEST_DATE, inbound: 0, outbound: 0, sameDay: 0 }, staffSession?.access_token)).status === 403, '직원이 notify 호출 → 403')
} finally {
  const clean = await replace(admin, [])
  check(!clean.error && (await countTest(admin)) === 0, `테스트 날짜(${TEST_DATE}) 정리`)
  await staff.removeChannel(channel)
  await staff.auth.signOut({ scope: 'local' })
  await admin.auth.signOut({ scope: 'local' })
}

console.log(failed ? `\n❌ ${failed}개 실패` : '\n✅ 모두 통과')
process.exit(failed ? 1 : 0)
