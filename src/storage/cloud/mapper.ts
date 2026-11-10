import type { Container, Dispatch, Inbound, Outbound, Port } from '../../domain/types'

/** 클라우드 inbound 표의 한 행 (스펙 v2 3.1 열 이름 그대로) */
export interface InboundRow {
  id: string
  port: Port
  base_date: string
  arrival_date: string | null
  vessel: string | null
  bl: string
  item: string | null
  qty: number | null
  weight_kg: number | null
  cbm: number | null
  hull: string | null
  po: string | null
  terminal: string | null
  containers: Container[]
  destination: string | null
  note: string | null
  raw: Record<string, string>
}

/** 클라우드 outbound 표의 한 행 */
export interface OutboundRow {
  id: string
  base_date: string
  seq: number | null
  center: string | null
  bnl_in_date: string | null
  bl: string | null
  hull: string | null
  po: string | null
  item: string | null
  qty_text: string | null
  qty_requested: number | null
  qty_total: number | null
  weight_kg: number | null
  cbm: number | null
  box_no: string | null
  destination: string | null
  gate_time: string | null
  memo: string | null
  inspected_date: string | null
  requester: string | null
  arrive_date: string | null
  location: string | null
  same_day: boolean
  dispatch: Dispatch | null
  raw: Record<string, string>
}

export const toInboundRow = (x: Inbound): InboundRow => ({
  id: x.id, port: x.port, base_date: x.baseDate, arrival_date: x.arrivalDate, vessel: x.vessel, bl: x.bl,
  item: x.item, qty: x.qty, weight_kg: x.weightKg, cbm: x.cbm, hull: x.hull, po: x.po, terminal: x.terminal,
  containers: x.containers, destination: x.destination, note: x.note, raw: x.raw,
})

export const fromInboundRow = (r: InboundRow): Inbound => ({
  id: r.id, port: r.port, baseDate: r.base_date, arrivalDate: r.arrival_date, vessel: r.vessel, bl: r.bl,
  item: r.item, qty: r.qty, weightKg: r.weight_kg, cbm: r.cbm, hull: r.hull, po: r.po, terminal: r.terminal,
  containers: r.containers ?? [], destination: r.destination, note: r.note, raw: r.raw ?? {},
})

export const toOutboundRow = (x: Outbound): OutboundRow => ({
  id: x.id, base_date: x.baseDate, seq: x.seq, center: x.center, bnl_in_date: x.bnlInDate, bl: x.bl, hull: x.hull,
  po: x.po, item: x.item, qty_text: x.qtyText, qty_requested: x.qtyRequested, qty_total: x.qtyTotal,
  weight_kg: x.weightKg, cbm: x.cbm, box_no: x.boxNo, destination: x.destination, gate_time: x.gateTime,
  memo: x.memo, inspected_date: x.inspectedDate, requester: x.requester, arrive_date: x.arriveDate,
  location: x.location, same_day: x.sameDay, dispatch: x.dispatch ?? null, raw: x.raw,
})

export const fromOutboundRow = (r: OutboundRow): Outbound => ({
  id: r.id, baseDate: r.base_date, seq: r.seq, center: r.center, bnlInDate: r.bnl_in_date, bl: r.bl, hull: r.hull,
  po: r.po, item: r.item, qtyText: r.qty_text, qtyRequested: r.qty_requested, qtyTotal: r.qty_total,
  weightKg: r.weight_kg, cbm: r.cbm, boxNo: r.box_no, destination: r.destination, gateTime: r.gate_time,
  memo: r.memo, inspectedDate: r.inspected_date, requester: r.requester, arriveDate: r.arrive_date,
  location: r.location, sameDay: r.same_day, dispatch: r.dispatch ?? undefined, raw: r.raw ?? {},
})
