import { describe, expect, test, vi } from 'vitest'
import { adminLogin, isValidPin, logout, roleOf, staffLogin, watchAuth } from '../src/auth/auth'

const session = (app: Record<string, unknown>, user: Record<string, unknown> = {}) =>
  ({ user: { app_metadata: app, user_metadata: user } }) as never

describe('roleOf', () => {
  test('app_metadata.role만 믿는다', () => {
    expect(roleOf(session({ role: 'admin' }))).toBe('admin')
    expect(roleOf(session({ role: 'staff' }))).toBe('staff')
    expect(roleOf(session({}))).toBeNull()
    expect(roleOf(session({}, { role: 'admin' }))).toBeNull() // 사용자가 바꿀 수 있는 칸은 무시
    expect(roleOf(null)).toBeNull()
  })
})

test('isValidPin: 정확히 6자리 숫자', () => {
  expect(isValidPin('012345')).toBe(true)
  for (const p of ['12345', '12345a', '1234567', '']) expect(isValidPin(p)).toBe(false)
})

const fakeClient = (invoke: () => Promise<unknown>) => {
  const setSession = vi.fn(async () => ({ error: null }))
  const signInWithPassword = vi.fn(async ({ password }: { password: string }) => ({ error: password === 'ok' ? null : { message: 'bad' } }))
  const signOut = vi.fn(async () => ({ error: null }))
  let handler: (event: string, s: unknown) => void = () => {}
  const client = {
    functions: { invoke: vi.fn(invoke) },
    auth: {
      setSession, signInWithPassword, signOut,
      onAuthStateChange: (h: typeof handler) => { handler = h; return { data: { subscription: { unsubscribe: vi.fn() } } } },
    },
  }
  return { client: client as never, setSession, signOut, emit: (e: string, s: unknown = null) => handler(e, s) }
}

describe('staffLogin', () => {
  test('성공하면 받은 세션을 저장', async () => {
    const f = fakeClient(async () => ({ data: { access_token: 'a', refresh_token: 'r' }, error: null }))
    expect(await staffLogin(f.client, '123456')).toEqual({ ok: true })
    expect(f.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' })
  })
  test('401 → invalid, 423 → locked, 그 외 → network', async () => {
    const err = (status?: number) => fakeClient(async () => ({ data: null, error: { context: status ? { status } : undefined, message: 'x' } }))
    expect(await staffLogin(err(401).client, '123456')).toEqual({ ok: false, reason: 'invalid' })
    expect(await staffLogin(err(423).client, '123456')).toEqual({ ok: false, reason: 'locked' })
    expect(await staffLogin(err().client, '123456')).toEqual({ ok: false, reason: 'network' })
  })
  test('형식이 틀린 PIN은 서버에 보내지 않는다', async () => {
    const f = fakeClient(async () => ({ data: null, error: null }))
    expect(await staffLogin(f.client, '12a')).toEqual({ ok: false, reason: 'invalid' })
    expect((f.client as { functions: { invoke: ReturnType<typeof vi.fn> } }).functions.invoke).not.toHaveBeenCalled()
  })
})

test('adminLogin', async () => {
  const f = fakeClient(async () => ({}))
  expect(await adminLogin(f.client, 'a@b.c', 'ok')).toEqual({ ok: true })
  expect(await adminLogin(f.client, 'a@b.c', 'no')).toEqual({ ok: false })
})

describe('watchAuth / logout', () => {
  test('SIGNED_OUT(세션 무효화 포함)이면 로컬 정리 콜백을 부른다', async () => {
    const f = fakeClient(async () => ({}))
    const onSignedOut = vi.fn(async () => {})
    const roles: unknown[] = []
    watchAuth(f.client, onSignedOut, (r) => roles.push(r))
    f.emit('SIGNED_IN', session({ role: 'staff' }))
    f.emit('SIGNED_OUT', null)
    expect(onSignedOut).toHaveBeenCalledTimes(1)
    expect(roles).toEqual(['staff', null])
  })
  test('logout은 정리 콜백을 먼저 부른 뒤 로그아웃', async () => {
    const f = fakeClient(async () => ({}))
    const order: string[] = []
    f.signOut.mockImplementation(async () => { order.push('signOut'); return { error: null } })
    await logout(f.client, async () => { order.push('cleanup') })
    expect(order).toEqual(['cleanup', 'signOut'])
  })
})
