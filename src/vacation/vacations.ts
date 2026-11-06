import type { SupabaseClient } from '@supabase/supabase-js'
import { monthBounds, normalizeName, type VacationType } from './calendar'

export interface Vacation {
  id: number
  date: string
  name: string
  type: VacationType
}

/** 그 달(1일~말일) 휴가, 날짜·이름 순 */
export async function fetchMonth(client: SupabaseClient, ym: string): Promise<Vacation[]> {
  const { from, to } = monthBounds(ym)
  const { data, error } = await client.from('vacations').select('id, date, name, type').gte('date', from).lte('date', to).order('date').order('name')
  if (error) throw new Error(error.message)
  return data as Vacation[]
}

/** 관리자 전용(RLS). 같은 날 같은 이름이면 'duplicate'. */
export async function addVacation(client: SupabaseClient, v: { date: string; name: string; type: VacationType }): Promise<'ok' | 'duplicate'> {
  const name = normalizeName(v.name)
  if (!name) throw new Error('이름이 비었거나 너무 길어요')
  const { error } = await client.from('vacations').insert({ date: v.date, name, type: v.type })
  if (error?.code === '23505') return 'duplicate'
  if (error) throw new Error(error.message)
  return 'ok'
}

export async function deleteVacation(client: SupabaseClient, id: number): Promise<void> {
  const { error } = await client.from('vacations').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** 자동완성용: 최근 200줄의 이름, 중복 제거 */
export async function recentNames(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from('vacations').select('name').order('id', { ascending: false }).limit(200)
  if (error) throw new Error(error.message)
  return [...new Set((data as { name: string }[]).map((r) => r.name))]
}

/** 휴가 표가 바뀌면 cb. 해제 함수를 돌려준다. */
export function onVacationChange(client: SupabaseClient, cb: () => void): () => void {
  const channel = client
    .channel(`vacations:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vacations' }, () => cb())
    .subscribe()
  return () => { void client.removeChannel(channel) }
}
