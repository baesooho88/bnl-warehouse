import { expect, test } from 'vitest'
import { isUrgent } from '../src/lib/urgent'

test('비고에 긴급이 들어 있으면 긴급건', () => {
  expect(isUrgent('긴급 반출')).toBe(true)
  expect(isUrgent('오전 긴급건')).toBe(true)
  expect(isUrgent('일반')).toBe(false)
  expect(isUrgent(null)).toBe(false)
})
