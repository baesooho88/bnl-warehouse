import type { Outbound } from '../domain/types'
import { formatMD } from '../lib/dates'
import { needsInspection } from '../lib/urgent'
import { kg } from './format'

export function OutboundCard({ item, onOpen, inspected }: { item: Outbound; onOpen: (x: Outbound) => void; inspected?: { has: (bl: string) => boolean } }) {
  return (
    <button className="card out" onClick={() => onOpen(item)}>
      <div className="top">
        <span className="badge out">출고</span>
        {item.sameDay && <span className="badge urgent">당일착</span>}
        {needsInspection(item, inspected) && <span className="badge inspect">검사필요</span>}
        <span>{item.destination ?? '도착지 없음'}{item.gateTime && ` · ${item.gateTime}`}</span>
      </div>
      <div className="item">{item.item ?? '(품명 없음)'}</div>
      <div className="meta">B/L {item.bl ?? '-'}{item.hull && ` · 호선 ${item.hull}`}</div>
      <div className="meta">
        요청 {item.qtyText ?? '-'} · {kg(item.weightKg)}{item.requester && ` · ${item.requester}`}
      </div>
      <div className="date-line">
        상차 {formatMD(item.baseDate)} → 도착 {item.arriveDate ? formatMD(item.arriveDate) : '-'} ›
      </div>
    </button>
  )
}
