import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from 'vitest'
import { CONTAINER_STATUSES, fetchStatuses, setStatus, statusKey } from '../src/inbound/containerStatus'

test('상태는 입고예정 → 입고됨 → 반입됨 순서', () => {
  expect(CONTAINER_STATUSES).toEqual(['입고예정', '입고됨', '반입됨'])
})
test('fetchStatuses: B/L 목록으로 한 번에 읽어 (B/L|번호) 표로', async () => {
  const calls: unknown[] = []
  const client = { from: () => ({ select: () => ({ in: async (col: string, v: string[]) => { calls.push([col, v]); return { data: [{ bl: 'B1', container_no: 'C1', status: '반입됨' }], error: null } } }) }) } as unknown as SupabaseClient
  const m = await fetchStatuses(client, ['B1', 'B1', 'B2'])
  expect(calls).toEqual([['bl', ['B1', 'B2']]])
  expect(m.get(statusKey('B1', 'C1'))).toBe('반입됨')
  expect(await fetchStatuses(client, [])).toEqual(new Map())
})
test('setStatus: (B/L, 번호)로 덮어쓰기', async () => {
  const sent: unknown[] = []
  const client = { from: () => ({ upsert: async (row: unknown, opt: unknown) => { sent.push([row, opt]); return { error: null } } }) } as unknown as SupabaseClient
  await setStatus(client, 'B1', 'C1', '입고됨')
  expect(sent).toEqual([[{ bl: 'B1', container_no: 'C1', status: '입고됨' }, { onConflict: 'bl,container_no' }]])
})
