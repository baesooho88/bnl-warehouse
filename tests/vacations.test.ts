import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from 'vitest'
import { addVacation, recentNames } from '../src/vacation/vacations'

// insert/select 결과만 정해 두는 최소 가짜 client
function fakeClient(result: { error?: { code: string; message: string } | null; data?: unknown[] }) {
  const inserted: unknown[] = []
  const chain = { order: () => chain, limit: async () => ({ data: result.data ?? [], error: null }) }
  const client = {
    from: () => ({
      insert: async (row: unknown) => { inserted.push(row); return { error: result.error ?? null } },
      select: () => chain,
    }),
  } as unknown as SupabaseClient
  return { client, inserted }
}

test('같은 날 같은 이름(23505) → duplicate', async () => {
  const { client } = fakeClient({ error: { code: '23505', message: 'dup' } })
  expect(await addVacation(client, { date: '2099-01-01', name: '테스트A', type: '연차' })).toBe('duplicate')
})
test('다른 오류는 throw', async () => {
  const { client } = fakeClient({ error: { code: '42501', message: 'denied' } })
  await expect(addVacation(client, { date: '2099-01-01', name: '테스트A', type: '연차' })).rejects.toThrow()
})
test('이름은 앞뒤 공백을 지워 저장, 빈 이름은 보내지 않고 throw', async () => {
  const { client, inserted } = fakeClient({})
  expect(await addVacation(client, { date: '2099-01-01', name: '  테스트A ', type: '오전반차' })).toBe('ok')
  expect(inserted).toEqual([{ date: '2099-01-01', name: '테스트A', type: '오전반차' }])
  await expect(addVacation(client, { date: '2099-01-01', name: '   ', type: '연차' })).rejects.toThrow()
  expect(inserted.length).toBe(1)
})
test('recentNames: 순서 유지 중복 제거', async () => {
  const { client } = fakeClient({ data: [{ name: '테스트A' }, { name: '테스트B' }, { name: '테스트A' }] })
  expect(await recentNames(client)).toEqual(['테스트A', '테스트B'])
})

test('일정: 시간과 30자 내용을 그대로 보낸다', async () => {
  const { client, inserted } = fakeClient({})
  expect(await addVacation(client, { date: '2099-01-01', name: '가'.repeat(30), type: '일정', time: '10:00' })).toBe('ok')
  expect(inserted).toEqual([{ date: '2099-01-01', name: '가'.repeat(30), type: '일정', time: '10:00' }])
})
test('recentNames: 일정 내용은 이름 추천에서 뺀다', async () => {
  const { client } = fakeClient({ data: [{ name: '테스트A', type: '연차' }, { name: '방문 일정', type: '일정' }] })
  expect(await recentNames(client)).toEqual(['테스트A'])
})
