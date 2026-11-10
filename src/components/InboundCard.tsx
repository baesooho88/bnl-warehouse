import type { Inbound } from '../domain/types'
import { isUrgent } from '../lib/urgent'
import { kg } from './format'

export function InboundCard({ item, onOpen }: { item: Inbound; onOpen: (x: Inbound) => void }) {
  const urgent = isUrgent(item.note)
  return (
    <button className={`card in${urgent ? ' urgent' : ''}`} onClick={() => onOpen(item)}>
      <div className="top">
        {urgent && <span className="badge urgent">★ 긴급</span>}
        <span className="badge in">입고·{item.port}</span>
        {item.vessel && <span>{item.vessel}</span>}
      </div>
      <div className="item">{item.item ?? '(품명 없음)'}</div>
      <div className="meta">B/L {item.bl}{item.hull && ` · 호선 ${item.hull}`}</div>
      <div className="meta">
        {item.qty ?? '-'}개 · {kg(item.weightKg)} · 컨테이너 {item.containers.length} ›
      </div>
      {item.note && <div className="note-box"><b>비고</b> {item.note}</div>}
    </button>
  )
}
