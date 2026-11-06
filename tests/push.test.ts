import { expect, test } from 'vitest'
import { shouldRestorePush } from '../src/push/push'

test('재로그인 후: 권한 허용·구독 없음·직접 끈 적 없음 → 알림 자동 복구', () => {
  expect(shouldRestorePush({ permission: 'granted', subscribed: false, optedOut: false })).toBe(true)
})
test('직접 끈 사람·이미 구독·권한 미허용은 건드리지 않음', () => {
  expect(shouldRestorePush({ permission: 'granted', subscribed: false, optedOut: true })).toBe(false)
  expect(shouldRestorePush({ permission: 'granted', subscribed: true, optedOut: false })).toBe(false)
  expect(shouldRestorePush({ permission: 'default', subscribed: false, optedOut: false })).toBe(false)
  expect(shouldRestorePush({ permission: 'denied', subscribed: false, optedOut: false })).toBe(false)
})
