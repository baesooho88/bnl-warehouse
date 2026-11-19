import { expect, test } from 'vitest'
import { LOGIN_ID_PATTERN, PERMS, staffEmail } from '../supabase/functions/_shared/staff'
import { ALL_PERMS } from '../src/staff/staff'

test('앱과 서버의 권한 목록이 같다', () => expect([...ALL_PERMS].sort()).toEqual([...PERMS].sort()))
test('아이디 규칙과 이메일', () => {
  for (const ok of ['hong', 'kim2', 'ab']) expect(LOGIN_ID_PATTERN.test(ok)).toBe(true)
  for (const bad of ['a', 'Hong', 'kim.c', 'a@b', '']) expect(LOGIN_ID_PATTERN.test(bad)).toBe(false)
  expect(staffEmail('hong')).toBe('hong@staff.bnl.invalid')
})
