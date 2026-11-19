import type { Inbound } from '../domain/types'
import { statusKey, type ContainerStatus } from '../inbound/containerStatus'
import { isUrgent } from '../lib/urgent'
import { kg, tons } from './format'

const CNTR_CLASS = { 입고예정: 'plan', 입고됨: 'in', 반입됨: 'done' } as const

// 파일의 '구분' 칸은 이미 B/L 합계('20DC X 14')이고 병합 셀이라 컨테이너마다 반복된다 → 중복만 걷어 낸다
export const containerTypes = (cs: Inbound['containers']) =>
  [...new Set(cs.flatMap((c) => (c.type ? [c.type.replace(/\s*[xX×]\s*/, '×')] : [])))].join(' · ')

export function InboundCard({ item, onOpen, statuses, flash }: { item: Inbound; onOpen: (x: Inbound) => void; statuses?: Map<string, ContainerStatus>; flash?: string | null }) {
  const urgent = isUrgent(item.note)
  return (
    <button id={`in-${item.id}`} className={`card in${urgent ? ' urgent' : ''}`} onClick={() => onOpen(item)}>
      <div className="card-row">
        <div className="card-main">
          <div className="top">
            {urgent && <span className="badge urgent">★ 긴급</span>}
            <span className="badge in">입고·{item.port}</span>
            <b className="bl">{item.bl}</b>
          </div>
          <div className="item">{item.item ?? '(품명 없음)'}</div>
          {/* 무슨 컨테이너가 몇 개 오는지 */}
          <div className="meta">{[item.hull && `호선 ${item.hull}`, containerTypes(item.containers)].filter(Boolean).join(' · ')}</div>
        </div>
        {item.containers.length > 0 && (
          // 상태는 글자 대신 색으로(회색 입고예정 · 파랑 입고됨 · 초록 반입됨), 글자는 화면낭독기용
          <div className="cntr-list">{item.containers.map((c, i) => {
            const st = statuses?.get(statusKey(item.bl, c.no)) ?? '입고예정'
            return <span key={`${c.no}${i}`} className={`cntr s-${CNTR_CLASS[st]}${c.no === flash ? ' flash' : ''}`} title={st} aria-label={`${c.no} ${st}`}>{c.no}</span>
          })}</div>
        )}
      </div>
      {item.note && <div className="note-box"><b>비고</b> {item.note}</div>}
    </button>
  )
}

/**
 * 혼재: 같은 컨테이너에 실린 B/L 여러 건을 카드 하나로 접는다. 펼치면 B/L마다 한 줄(누르면 상세).
 * 컨테이너 색은 B/L 중 가장 덜 진행된 상태(하나라도 입고예정이면 입고예정).
 */
export function InboundGroupCard({ items, open, onToggle, onOpen, statuses, flash }: {
  items: Inbound[]; open: boolean; onToggle: () => void; onOpen: (x: Inbound, bls: string[]) => void; statuses?: Map<string, ContainerStatus>; flash?: string | null
}) {
  const first = items[0]
  const bls = items.map((x) => x.bl)
  const urgent = items.some((x) => isUrgent(x.note))
  const names = [...new Set(items.map((x) => x.item ?? '(품명 없음)'))]
  const hulls = [...new Set(items.flatMap((x) => (x.hull ? [x.hull] : [])))]
  const order = ['입고예정', '입고됨', '반입됨'] as const
  const status = (no: string) => order[Math.min(...bls.map((bl) => order.indexOf(statuses?.get(statusKey(bl, no)) ?? '입고예정')))]
  return (
    <section id={`in-${first.id}`} className={`card in in-group${urgent ? ' urgent' : ''}`}>
      <button className="in-group-head" aria-expanded={open} onClick={onToggle}>
        <div className="card-row">
          <div className="card-main">
            <div className="top">
              <span className="og-arrow" aria-hidden>{open ? '▼' : '▶'}</span>
              {urgent && <span className="badge urgent">★ 긴급</span>}
              <span className="badge in">입고·{first.port}</span>
              <b className="bl">같은 컨테이너 B/L {items.length}건</b>
            </div>
            <div className="item">{names[0]}{names.length > 1 && ` 외 ${names.length - 1}종`}</div>
            <div className="meta">{[hulls.length && `호선 ${hulls.join('·')}`, containerTypes(first.containers), tons(items.reduce((s, x) => s + (x.weightKg ?? 0), 0))].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="cntr-list">{[...new Set(first.containers.map((c) => c.no))].map((no) => {
            const st = status(no)
            return <span key={no} className={`cntr s-${CNTR_CLASS[st]}${no === flash ? ' flash' : ''}`} title={st} aria-label={`${no} ${st}`}>{no}</span>
          })}</div>
        </div>
      </button>
      {open && items.map((x) => (
        <button key={x.id} className="og-row" onClick={() => onOpen(x, bls)}>
          <span className="og-line1">
            {isUrgent(x.note) && <span className="badge urgent">긴급</span>}
            <b className="og-item">{x.bl || '-'}</b>
          </span>
          <span className="og-line2">{x.item ?? '(품명 없음)'} · {kg(x.weightKg)}</span>
          <span className="og-chev" aria-hidden>›</span>
        </button>
      ))}
    </section>
  )
}
