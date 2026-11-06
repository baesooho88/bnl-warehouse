import type { SupabaseClient } from '@supabase/supabase-js'

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const toKey = (base64url: string) => {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** 알림 권한을 묻고, 이 폰을 구독 목록에 등록한다. */
export async function subscribePush(client: SupabaseClient, vapidKey: string): Promise<'subscribed' | 'denied' | 'unsupported'> {
  if (!pushSupported() || !vapidKey) return 'unsupported'
  if ((await Notification.requestPermission()) !== 'granted') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidKey) }))
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { data } = await client.auth.getUser()
  if (!data.user) return 'unsupported'
  const { error } = await client.from('push_subscriptions').upsert({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_id: data.user.id })
  if (error) throw new Error(error.message)
  return 'subscribed'
}

/** 이 폰의 구독을 해제하고 목록에서 지운다. 실패해도 조용히 넘어간다(로그아웃을 막지 않게). */
export async function unsubscribePush(client: SupabaseClient): Promise<void> {
  try {
    if (!pushSupported()) return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await client.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch {
    // 무시
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  return Boolean(await reg?.pushManager.getSubscription())
}

/** PIN 변경 등으로 재로그인하면 구독이 지워져 있다. 권한은 이미 있고 사용자가 직접 끈 게 아니면 다시 켠다. */
export const shouldRestorePush = (s: { permission: NotificationPermission; subscribed: boolean; optedOut: boolean }) =>
  s.permission === 'granted' && !s.subscribed && !s.optedOut

const OPT_OUT = 'bnl-push-off'
export const pushOptedOut = () => { try { return localStorage.getItem(OPT_OUT) === '1' } catch { return false } }
export const setPushOptedOut = (off: boolean) => { try { if (off) localStorage.setItem(OPT_OUT, '1'); else localStorage.removeItem(OPT_OUT) } catch { /* 무시 */ } }
