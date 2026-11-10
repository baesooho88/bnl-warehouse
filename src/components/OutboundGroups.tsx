import { useState } from 'react'
import type { Outbound } from '../domain/types'
import { formatDay } from '../lib/dates'
import { groupByDispatch, groupOutbound, seqLabel, vehicleChips } from '../lib/outboundGroups'
import { needsInspection } from '../lib/urgent'
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
              {needsInspection(x) && <span className="badge inspect">검사필요</span>}
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
            <button className="og-section" aria-expanded={!open.has(`h|${s.arrive}|${s.invar}`)} onClick={() => toggle(`h|${s.arrive}|${s.invar}`)}>
              <span className="og-arrow" aria-hidden>{open.has(`h|${s.arrive}|${s.invar}`) ? '▶' : '▼'}</span>
              {s.arrive ? `${formatDay(s.arrive)} 도착` : '당착'}
              {s.invar && <span className="badge invar">INVAR</span>}
              <span className="og-section-sum">{s.groups.reduce((n, g) => n + g.items.length, 0)}건</span>
            </button>
            {!open.has(`h|${s.arrive}|${s.invar}`) && s.groups.map((g) => group(`d|${s.arrive}|${s.invar}|${g.key}`, (
              // 출고 담당자는 '몇 번에 무슨 차'를 본다: 순번 먼저, 그 옆에 차량, 아래에 도착지
              <span className="og-disp">
                <span className="og-disp1">
                  <b className="og-seqs">{seqLabel(g.items.flatMap((x) => (x.seq === null ? [] : [x.seq])))}</b>
                  {g.vehicles
                    ? vehicleChips(g.vehicles).map((c, i) => <span key={i} className={`og-veh ${c.tone}`}>{c.icon} {c.label}</span>)
                    : <span className="og-veh none">배차 전 출발</span>}
                  {g.note && <span className="og-note">{g.note}</span>}
                </span>
                <span className="og-disp2">
                  {[...new Set(g.items.map((x) => x.destination ?? '도착지 없음'))].join(' · ')} · {g.items.length}건 · {tons(g.weightKg)}
                </span>
              </span>
            ), g.items))}
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
