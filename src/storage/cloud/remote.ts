import type { SupabaseClient } from '@supabase/supabase-js'
import type { Inbound, Kind, Outbound } from '../../domain/types'
import { fromInboundRow, fromOutboundRow, toInboundRow, toOutboundRow, type InboundRow, type OutboundRow } from './mapper'

export interface UploadLog {
  id: number
  kind: Kind
  baseDates: string[]
  createdAt: string
}

/** 클라우드 쪽 저장소. 앱은 이 인터페이스만 알고, 테스트는 가짜 구현을 쓴다. */
export interface Remote {
  fetchAll(): Promise<{ inbound: Inbound[]; outbound: Outbound[]; maxLogId: number }>
  /** id보다 큰 업로드 기록, id 오름차순 */
  fetchLogsAfter(id: number): Promise<UploadLog[]>
  fetchDays(kind: Kind, baseDates: string[]): Promise<{ inbound: Inbound[]; outbound: Outbound[] }>
  /** 관리자 전용. 하루치 통째 교체 + 업로드 기록 1줄을 한 트랜잭션으로. 새 기록 id를 돌려준다. */
  replaceDays(kind: Kind, baseDates: string[], inbound: Inbound[], outbound: Outbound[], fileName: string): Promise<number>
  /** 새 업로드 기록이 생기면 cb 호출. 해제 함수를 돌려준다. */
  onNewLog(cb: () => void): () => void
}

export const PAGE = 1000

const portOf = (kind: Kind) => (kind === '입고-북항' ? '북항' : '신항')

export function createSupabaseRemote(client: SupabaseClient): Remote {
  // PostgREST는 한 번에 최대 PAGE행만 주므로 빈 페이지가 나올 때까지 이어 받는다
  async function pages<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await query(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      out.push(...(data ?? []))
      if (!data || data.length < PAGE) return out
    }
  }

  return {
    async fetchAll() {
      const [inRows, outRows, last] = await Promise.all([
        pages<InboundRow>((a, b) => client.from('inbound').select('*').order('id').range(a, b)),
        pages<OutboundRow>((a, b) => client.from('outbound').select('*').order('id').range(a, b)),
        client.from('upload_log').select('id').order('id', { ascending: false }).limit(1),
      ])
      if (last.error) throw new Error(last.error.message)
      return { inbound: inRows.map(fromInboundRow), outbound: outRows.map(fromOutboundRow), maxLogId: last.data?.[0]?.id ?? 0 }
    },

    async fetchLogsAfter(id) {
      const rows = await pages<{ id: number; kind: Kind; base_dates: string[]; created_at: string }>((a, b) =>
        client.from('upload_log').select('id, kind, base_dates, created_at').gt('id', id).order('id').range(a, b))
      return rows.map((r) => ({ id: r.id, kind: r.kind, baseDates: r.base_dates, createdAt: r.created_at }))
    },

    async fetchDays(kind, baseDates) {
      if (!baseDates.length) return { inbound: [], outbound: [] }
      if (kind === '출고') {
        const rows = await pages<OutboundRow>((a, b) => client.from('outbound').select('*').in('base_date', baseDates).order('id').range(a, b))
        return { inbound: [], outbound: rows.map(fromOutboundRow) }
      }
      const rows = await pages<InboundRow>((a, b) =>
        client.from('inbound').select('*').eq('port', portOf(kind)).in('base_date', baseDates).order('id').range(a, b))
      return { inbound: rows.map(fromInboundRow), outbound: [] }
    },

    async replaceDays(kind, baseDates, inbound, outbound, fileName) {
      const rows = kind === '출고' ? outbound.map(toOutboundRow) : inbound.map(toInboundRow)
      const { data, error } = await client.rpc('replace_days', { kind, base_dates: baseDates, rows, file_name: fileName })
      if (error) throw new Error(error.message)
      return data as number
    },

    onNewLog(cb) {
      const channel = client
        .channel('upload_log')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'upload_log' }, () => cb())
        .subscribe()
      return () => { void client.removeChannel(channel) }
    },
  }
}
