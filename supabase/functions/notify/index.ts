// 업로드 알림 발송 (스펙 v2 7장). 관리자만 호출 가능.
import webpush from 'npm:web-push@3.6.7'
import { env, requireAdmin, serviceClient } from '../_shared/admin.ts'
import { json, preflight } from '../_shared/http.ts'
import { buildMessage } from '../_shared/notifyText.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  const who = await requireAdmin(req)
  if (who instanceof Response) return who

  let message
  try {
    message = buildMessage(await req.json())
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
  }

  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  const admin = serviceClient()
  const { data: subs, error } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth')
  if (error) return json({ error: error.message }, 500)

  let sent = 0
  const gone: string[] = []
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: 86_400 })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) gone.push(s.endpoint) // 앱 삭제·만료된 폰
    }
  }))
  if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone)
  return json({ sent, removed: gone.length })
})
