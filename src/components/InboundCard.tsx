import type { Inbound } from '../domain/types'
import { statusKey, type ContainerStatus } from '../inbound/containerStatus'
import { isUrgent } from '../lib/urgent'
import { kg } from './format'

const CNTR_CLASS = { 입고예정: 'plan', 입고됨: 'in', 반입됨: 'done' } as const

export function InboundCard({ item, onOpen, statuses }: { item: Inbound; onOpen: (x: Inbound) => void; statuses?: Map<string, ContainerStatus> }) {
  const urgent = isUrgent(item.note)
  return (
    <button className={`card in${urgent ? ' urgent' : ''}`} onClick={() => onOpen(item)}>
      <div className="card-row">
        <div className="card-main">
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
        </div>
        {item.containers.length > 0 && (
          // 상태는 글자 대신 색으로(회색 입고예정 · 파랑 입고됨 · 초록 반입됨), 글자는 화면낭독기용
          <div className="cntr-list">{item.containers.map((c, i) => {
            const st = statuses?.get(statusKey(item.bl, c.no)) ?? '입고예정'
            return <span key={`${c.no}${i}`} className={`cntr s-${CNTR_CLASS[st]}`} title={st} aria-label={`${c.no} ${st}`}>{c.no}</span>
          })}</div>
        )}
      </div>
      {item.note && <div className="note-box"><b>비고</b> {item.note}</div>}
    </button>
  )
}
