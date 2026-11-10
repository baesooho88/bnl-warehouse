import type { SupabaseClient } from '@supabase/supabase-js'

export const CONTAINER_STATUSES = ['입고예정', '입고됨', '반입됨'] as const
export type ContainerStatus = (typeof CONTAINER_STATUSES)[number]
export const statusKey = (bl: string, no: string) => `${bl}|${no}`

/** 그 B/L들의 컨테이너 상태. 없는 컨테이너는 입고예정으로 본다. */
export async function fetchStatuses(client: SupabaseClient, bls: string[]): Promise<Map<string, ContainerStatus>> {
  const unique = [...new Set(bls)]
  if (!unique.length) return new Map()
  const { data, error } = await client.from('container_status').select('bl, container_no, status').in('bl', unique)
  if (error) throw new Error(error.message)
  return new Map((data as { bl: string; container_no: string; status: ContainerStatus }[]).map((r) => [statusKey(r.bl, r.container_no), r.status]))
}

/** 관리자 전용(RLS) */
export async function setStatus(client: SupabaseClient, bl: string, no: string, status: ContainerStatus): Promise<void> {
  const { error } = await client.from('container_status').upsert({ bl, container_no: no, status }, { onConflict: 'bl,container_no' })
  if (error) throw new Error(error.message)
}

export function onStatusChange(client: SupabaseClient, cb: () => void): () => void {
  const channel = client
    .channel(`container_status:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'container_status' }, () => cb())
    .subscribe()
  return () => { void client.removeChannel(channel) }
}
