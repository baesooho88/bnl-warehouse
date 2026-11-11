import type { SupabaseClient } from '@supabase/supabase-js'
import type { RiItem } from '../parsers/ri'

type Row = {
  base_date: string; idx: number; bl: string; po: string | null; hull: string | null; qty_text: string | null; item: string | null; wms: string | null
  pres_work: string | null; pres_report: string | null; box: string | null; ri_location: string | null; note: string | null
}
const toRow = (x: RiItem): Row => ({
  base_date: x.baseDate, idx: x.idx, bl: x.bl, po: x.po, hull: x.hull, qty_text: x.qtyText, item: x.item, wms: x.wms,
  pres_work: x.presWork, pres_report: x.presReport, box: x.box, ri_location: x.riLocation, note: x.note,
})
const fromRow = (r: Row): RiItem => ({
  baseDate: r.base_date, idx: r.idx, bl: r.bl, po: r.po, hull: r.hull, qtyText: r.qty_text, item: r.item, wms: r.wms,
  presWork: r.pres_work, presReport: r.pres_report, box: r.box, riLocation: r.ri_location, note: r.note,
})

/** 하루치 통째 교체(관리자 전용, 서버 함수 한 번 = 한 트랜잭션) */
export async function saveRi(client: SupabaseClient, date: string, items: RiItem[]): Promise<void> {
  const { error } = await client.rpc('replace_ri', { base_date: date, rows: items.map(toRow) })
  if (error) throw new Error(error.message)
}

/** 가장 최근 작업표 날짜, 없으면 null */
export async function latestRiDate(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.from('ri_items').select('base_date').order('base_date', { ascending: false }).limit(1)
  if (error) throw new Error(error.message)
  return (data as { base_date: string }[])[0]?.base_date ?? null
}

export async function fetchRi(client: SupabaseClient, date: string): Promise<RiItem[]> {
  const { data, error } = await client.from('ri_items').select('*').eq('base_date', date).order('idx')
  if (error) throw new Error(error.message)
  return (data as Row[]).map(fromRow)
}

export function onRiChange(client: SupabaseClient, cb: () => void): () => void {
  const channel = client
    .channel(`ri_items:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ri_items' }, () => cb())
    .subscribe()
  return () => { void client.removeChannel(channel) }
}
