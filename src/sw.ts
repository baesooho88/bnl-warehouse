/// <reference lib="webworker" />
// 직접 작성하는 서비스 워커: 오프라인 캐시(v1과 동일) + 푸시 알림
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// 새 버전은 바로 적용 (v1의 autoUpdate와 같은 동작)
self.addEventListener('install', () => { void self.skipWaiting() })
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

type Message = { title: string; body: string; tag: string; url: string }

self.addEventListener('push', (event) => {
  const m = (event.data?.json() ?? {}) as Partial<Message>
  event.waitUntil(
    self.registration.showNotification(m.title ?? '(주)부산신항로지텍', {
      body: m.body ?? '새 입출고가 올라왔어요',
      // 알림마다 다른 tag: 같은 종류여도 앞 알림을 덮어쓰지 않아, 확인 안 한 알림이 알림창에 쌓여 남는다
      tag: `${m.tag ?? 'bnl-upload'}-${Date.now()}`,
      icon: 'pwa-192x192.png',
      badge: 'badge-96x96.png', // 상단 상태바 아이콘: 안드로이드는 알파만 써서 흰 BNL 글자로 보임
      data: { url: m.url ?? '' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = String(event.notification.data?.url ?? '')
  const date = new URLSearchParams(url.replace(/^\?/, '')).get('date')
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const win = wins[0] as WindowClient | undefined
    if (win) {
      await win.focus()
      if (date) win.postMessage({ type: 'open-date', date })
      return
    }
    await self.clients.openWindow(self.registration.scope + url)
  })())
})
