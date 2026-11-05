import { describe, expect, test } from 'vitest'
import { hashPin, isLocked, LOCK_THRESHOLD, LOCK_WINDOW_MIN, verifyPin } from '../supabase/functions/_shared/pin'

describe('잠금 규칙', () => {
  test('15분 안에 실패 20회부터 잠금', () => {
    expect(LOCK_WINDOW_MIN).toBe(15)
    expect(LOCK_THRESHOLD).toBe(20)
    expect(isLocked(19)).toBe(false)
    expect(isLocked(20)).toBe(true)
  })
})

describe('PIN 해시', () => {
  test('맞는 PIN만 통과', async () => {
    const stored = await hashPin('123456')
    expect(await verifyPin('123456', stored)).toBe(true)
    expect(await verifyPin('123457', stored)).toBe(false)
  })
  test('같은 PIN도 해시마다 다르고(salt) 원문이 들어 있지 않다', async () => {
    const a = await hashPin('123456')
    const b = await hashPin('123456')
    expect(a).not.toBe(b)
    expect(a).not.toContain('123456')
    expect(a.startsWith('pbkdf2$')).toBe(true)
    expect(await verifyPin('123456', b)).toBe(true)
  })
  test('깨진 저장 값은 거부', async () => {
    expect(await verifyPin('123456', 'garbage')).toBe(false)
    expect(await verifyPin('123456', 'pbkdf2$zz$')).toBe(false)
  })
})
