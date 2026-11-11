import type { SupabaseClient } from '@supabase/supabase-js'

/** 검사 완료한 B/L 전부. shortcut: 표 전체를 읽는다, 수천 건이 넘으면 기간으로 자르기 */
export async function fetchDone(client: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await client.from('inspections').select('bl, done_at')
  if (error) throw new Error(error.message)
  return new Map((data as { bl: string; done_at: string }[]).map((r) => [r.bl, r.done_at]))
}

/** 직원·관리자 모두 가능(RLS) */
export async function setDone(client: SupabaseClient, bl: string, done: boolean): Promise<void> {
  const { error } = done
    ? await client.from('inspections').upsert({ bl }, { onConflict: 'bl' })
    : await client.from('inspections').delete().eq('bl', bl)
  if (error) throw new Error(error.message)
}

export function onDoneChange(client: SupabaseClient, cb: () => void): () => void {
  const channel = client
    .channel(`inspections:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections' }, () => cb())
    .subscribe()
  return () => { void client.removeChannel(channel) }
}
