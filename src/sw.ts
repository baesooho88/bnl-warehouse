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
    self.registration.showNotification(m.title ?? 'BNL 입출고', {
      body: m.body ?? '새 입출고가 올라왔어요',
      tag: m.tag ?? 'bnl-upload',
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
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
