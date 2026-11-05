import type { Inbound } from '../domain/types'
import { kg } from './format'

export function InboundCard({ item, onOpen }: { item: Inbound; onOpen: (x: Inbound) => void }) {
  return (
    <button className="card in" onClick={() => onOpen(item)}>
      <div className="top">
        <span className="badge in">입고·{item.port}</span>
        {item.vessel && <span>{item.vessel}</span>}
      </div>
      <div className="item">{item.item ?? '(품명 없음)'}</div>
      <div className="meta">B/L {item.bl}{item.hull && ` · 호선 ${item.hull}`}</div>
      <div className="meta">
        {item.qty ?? '-'}개 · {kg(item.weightKg)} · 컨테이너 {item.containers.length} ›
      </div>
    </button>
  )
}
