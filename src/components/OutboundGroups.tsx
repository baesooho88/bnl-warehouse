import { useState } from 'react'
import type { Outbound } from '../domain/types'
import { groupOutbound } from '../lib/outboundGroups'
import { kg, tons } from './format'

/** 출고를 도착지별로 묶어 접어 둔다. 펼치면 한 건 2줄. 날짜가 바뀌면 부모가 key로 새로 만든다(모두 접힘). */
export function OutboundGroups({ items, onOpen }: { items: Outbound[]; onOpen: (x: Outbound) => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (d: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(d)) n.add(d); return n })

  return (
    <div className="og">
      {groupOutbound(items).map((g) => {
        const isOpen = open.has(g.destination)
        return (
          <section key={g.destination} className="og-group">
            <button className="og-head" aria-expanded={isOpen} onClick={() => toggle(g.destination)}>
              <span className="og-arrow" aria-hidden>{isOpen ? '▼' : '▶'}</span>
              <span className="og-dest">{g.destination}</span>
              <span className="og-sum">{g.items.length}건 · {tons(g.weightKg)}</span>
              {g.sameDay > 0 && <span className="badge urgent">당일착 {g.sameDay}</span>}
            </button>
            {isOpen && g.items.map((x) => (
              <button key={x.id} className="og-row" onClick={() => onOpen(x)}>
                <span className="og-line1">
                  {x.sameDay && <span className="badge urgent">당일착</span>}
                  {x.gateTime && <b>{x.gateTime}</b>}
                  <span className="og-item">{x.item ?? '(품명 없음)'}</span>
                </span>
                <span className="og-line2">{x.qtyText ?? '-'} · {kg(x.weightKg)}</span>
                <span className="og-chev" aria-hidden>›</span>
              </button>
            ))}
          </section>
        )
      })}
    </div>
  )
}
