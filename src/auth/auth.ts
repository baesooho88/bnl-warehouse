import type { Session, SupabaseClient } from '@supabase/supabase-js'

export type Role = 'admin' | 'staff' | null

/** 역할은 사용자가 스스로 바꿀 수 없는 app_metadata에서만 읽는다. */
export function roleOf(session: Session | null): Role {
  const role = session?.user?.app_metadata?.role
  return role === 'admin' || role === 'staff' ? role : null
}

export const isValidPin = (pin: string) => /^\d{6}$/.test(pin)

type StaffLoginResult = { ok: true } | { ok: false; reason: 'invalid' | 'locked' | 'network' }

/** 직원 PIN 로그인: 서버 함수가 PIN·잠금을 확인하고 직원 계정 세션을 돌려준다. */
export async function staffLogin(client: SupabaseClient, pin: string): Promise<StaffLoginResult> {
  if (!isValidPin(pin)) return { ok: false, reason: 'invalid' }
  try {
    const { data, error } = await client.functions.invoke('staff-login', { body: { pin } })
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status
      return { ok: false, reason: status === 401 ? 'invalid' : status === 423 ? 'locked' : 'network' }
    }
    const { access_token, refresh_token } = data as { access_token: string; refresh_token: string }
    const set = await client.auth.setSession({ access_token, refresh_token })
    return set.error ? { ok: false, reason: 'network' } : { ok: true }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/** 관리자는 아이디만 쳐도 된다: '@'가 없으면 회사 도메인을 붙인다. */
export const adminEmail = (id: string) => (id.trim().includes('@') ? id.trim() : `${id.trim()}@ebnl.co.kr`)

export async function adminLogin(client: SupabaseClient, email: string, password: string): Promise<{ ok: boolean }> {
  const { error } = await client.auth.signInWithPassword({ email, password })
  return { ok: !error }
}

/**
 * 로그인 상태를 지켜본다. 로그아웃·세션 무효화(PIN 변경)로 SIGNED_OUT이 오면 onSignedOut으로
 * 휴대폰 데이터를 정리한다. 구독 해제 함수를 돌려준다.
 */
export function watchAuth(client: SupabaseClient, onSignedOut: () => Promise<void>, onChange: (role: Role) => void): () => void {
  const { data } = client.auth.onAuthStateChange((event, session) => {
    onChange(roleOf(session))
    if (event === 'SIGNED_OUT') void onSignedOut()
  })
  return () => data.subscription.unsubscribe()
}

/** 정리(푸시 해제 등 로그인 상태가 필요한 일)를 먼저 하고 로그아웃한다. */
export async function logout(client: SupabaseClient, onSignedOut: () => Promise<void>): Promise<void> {
  await onSignedOut()
  await client.auth.signOut({ scope: 'local' })
}
