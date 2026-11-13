import type { SupabaseClient } from '@supabase/supabase-js'
import type { StockItem } from '../parsers/stock'

type Row = {
  idx: number; base_date: string; bl: string; item: string | null; box: string | null; qty: number | null; weight_kg: number | null; cbm: number | null
  location: string | null; in_date: string | null; in_no: string | null; po: string | null; project: string | null
  customs_no: string | null; cargo_no: string | null; note: string | null
}

/** 재고 전체를 새 파일 내용으로 교체(관리자 전용, 서버 함수 한 번 = 한 트랜잭션) */
export async function saveStock(client: SupabaseClient, date: string, items: StockItem[]): Promise<void> {
  const rows: Row[] = items.map((x) => ({
    idx: x.idx, base_date: date, bl: x.bl, item: x.item, box: x.box, qty: x.qty, weight_kg: x.weightKg, cbm: x.cbm, location: x.location,
    in_date: x.inDate, in_no: x.inNo, po: x.po, project: x.project, customs_no: x.customsNo, cargo_no: x.cargoNo, note: x.note,
  }))
  const { error } = await client.rpc('replace_stock', { rows })
  if (error) throw new Error(error.message)
}

/** 재고 전체와 기준일. shortcut: 한 번에 다 읽어 휴대폰에서 거른다(파일 하나 1~2천 줄 기준), 수만 줄이 되면 서버 검색으로 */
export async function fetchStock(client: SupabaseClient): Promise<{ date: string | null; items: StockItem[] }> {
  const items: StockItem[] = []
  let date: string | null = null
  for (let from = 0; ; from += 1000) { // PostgREST 기본 최대 1000줄씩
    const { data, error } = await client.from('stock_items').select('*').order('idx').range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of data as Row[]) {
      date = r.base_date
      items.push({
        idx: r.idx, bl: r.bl, item: r.item, box: r.box, qty: r.qty, weightKg: r.weight_kg, cbm: r.cbm, location: r.location,
        inDate: r.in_date, inNo: r.in_no, po: r.po, project: r.project, customsNo: r.customs_no, cargoNo: r.cargo_no, note: r.note,
      })
    }
    if (data.length < 1000) return { date, items }
  }
}

const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '').toUpperCase()

/** 공백·대소문자 무시, B/L·품명·PO·Project·Location·BOX·입고번호·수입신고번호·화물관리번호 중 하나라도 들어 있으면 */
export function searchStock(items: StockItem[], query: string): StockItem[] {
  const q = squash(query)
  if (!q) return []
  return items.filter((x) => [x.bl, x.item, x.po, x.project, x.location, x.box, x.inNo, x.customsNo, x.cargoNo].some((f) => squash(f).includes(q)))
}
