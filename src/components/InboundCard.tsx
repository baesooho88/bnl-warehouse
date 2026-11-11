import type { Inbound } from '../domain/types'
import { statusKey, type ContainerStatus } from '../inbound/containerStatus'
import { isUrgent } from '../lib/urgent'

const CNTR_CLASS = { 입고예정: 'plan', 입고됨: 'in', 반입됨: 'done' } as const

// 파일의 '구분' 칸은 이미 B/L 합계('20DC X 14')이고 병합 셀이라 컨테이너마다 반복된다 → 중복만 걷어 낸다
export const containerTypes = (cs: Inbound['containers']) =>
  [...new Set(cs.flatMap((c) => (c.type ? [c.type.replace(/\s*[xX×]\s*/, '×')] : [])))].join(' · ')

export function InboundCard({ item, onOpen, statuses }: { item: Inbound; onOpen: (x: Inbound) => void; statuses?: Map<string, ContainerStatus> }) {
  const urgent = isUrgent(item.note)
  return (
    <button className={`card in${urgent ? ' urgent' : ''}`} onClick={() => onOpen(item)}>
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
            return <span key={`${c.no}${i}`} className={`cntr s-${CNTR_CLASS[st]}`} title={st} aria-label={`${c.no} ${st}`}>{c.no}</span>
          })}</div>
        )}
      </div>
      {item.note && <div className="note-box"><b>비고</b> {item.note}</div>}
    </button>
  )
}
