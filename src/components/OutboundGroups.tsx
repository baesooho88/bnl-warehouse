import { useState } from 'react'
import type { Outbound } from '../domain/types'
import { formatDay } from '../lib/dates'
import { groupByDispatch, groupOutbound } from '../lib/outboundGroups'
import { kg, tons } from './format'

/**
 * 출고를 묶어 접어 둔다. 배차가 붙은 날은 도착일 → 차량(배차 줄)으로, 아니면 도착지별로.
 * 펼치면 한 건 2줄. 날짜가 바뀌면 부모가 key로 새로 만든다(모두 접힘).
 */
export function OutboundGroups({ items, onOpen }: { items: Outbound[]; onOpen: (x: Outbound) => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(k)) n.add(k); return n })

  const group = (k: string, head: React.ReactNode, list: Outbound[], showDest = false) => {
    const isOpen = open.has(k)
    return (
      <section key={k} className="og-group">
        <button className="og-head" aria-expanded={isOpen} onClick={() => toggle(k)}>
          <span className="og-arrow" aria-hidden>{isOpen ? '▼' : '▶'}</span>
          {head}
        </button>
        {isOpen && list.map((x) => (
          <button key={x.id} className="og-row" onClick={() => onOpen(x)}>
            <span className="og-line1">
              {x.seq !== null && <span className="og-seq">{x.seq}</span>}
              {x.sameDay && <span className="badge urgent">당일착</span>}
              {x.gateTime && <b>{x.gateTime}</b>}
              <span className="og-item">{x.item ?? '(품명 없음)'}</span>
            </span>
            <span className="og-line2">{x.qtyText ?? '-'} · {kg(x.weightKg)}{showDest && x.destination ? ` · ${x.destination}` : ''}</span>
            <span className="og-chev" aria-hidden>›</span>
          </button>
        ))}
      </section>
    )
  }

  if (items.some((x) => x.dispatch)) {
    return (
      <div className="og">
        {groupByDispatch(items).map((s) => (
          <div key={`${s.arrive}|${s.invar}`}>
            <h3 className="og-section">
              {s.arrive ? `${formatDay(s.arrive)} 도착` : '당착'}
              {s.invar && <span className="badge invar">INVAR</span>}
            </h3>
            {s.groups.map((g) => group(`d|${s.arrive}|${s.invar}|${g.key}`, (
              <>
                <span className="og-dest">{g.vehicles ? `🚚 ${g.vehicles}` : '당일착 · 배차 전 출발'}{g.note && <span className="og-note"> {g.note}</span>}</span>
                <span className="og-sum">{g.items.length}건 · {tons(g.weightKg)}</span>
              </>
            ), g.items, true))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="og">
      {groupOutbound(items).map((g) => group(g.destination, (
        <>
          <span className="og-dest">{g.destination}</span>
          <span className="og-sum">{g.items.length}건 · {tons(g.weightKg)}</span>
          {g.sameDay > 0 && <span className="badge urgent">당일착 {g.sameDay}</span>}
        </>
      ), g.items))}
    </div>
  )
}
