import type { SupabaseClient } from '@supabase/supabase-js'
import type { Outbound } from '../domain/types'
import { needsInspection } from '../lib/urgent'

/**
 * RI 목록: 출고 중 입고검수일자가 '대기'인 건을 B/L 하나로 모은다.
 * 같은 B/L이 여러 날 시트에 반복되므로 가장 최근 날짜 것만 보고, 그게 더 이상 대기가 아니면(엑셀에 검수일이 채워짐) 뺀다.
 */
export function inspectionList(outbound: Outbound[], done: { has: (bl: string) => boolean }) {
  const latest = new Map<string, Outbound>()
  for (const x of outbound) if (x.bl && (latest.get(x.bl)?.baseDate ?? '') <= x.baseDate) latest.set(x.bl, x)
  const all = [...latest.values()].filter((x) => needsInspection(x)).sort((a, b) => b.baseDate.localeCompare(a.baseDate) || a.id.localeCompare(b.id))
  return { pending: all.filter((x) => !done.has(x.bl!)), done: all.filter((x) => done.has(x.bl!)) }
}

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
