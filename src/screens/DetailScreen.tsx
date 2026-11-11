import { useEffect, useRef, useState } from 'react'
import { CONTAINER_STATUSES, setStatus, statusKey, type ContainerStatus } from '../inbound/containerStatus'
import { useContainerStatuses } from '../inbound/useContainerStatuses'
import { supabase } from '../storage/cloud/supabase'
import { num } from '../components/format'
import type { Inbound, Outbound } from '../domain/types'
import { formatMD, todayIso } from '../lib/dates'
import { splitPhones } from '../lib/phone'
import { needsInspection } from '../lib/urgent'
import { useInspections } from '../inspection/useInspections'

export type Detail = { kind: 'in'; item: Inbound } | { kind: 'out'; item: Outbound }

function WithPhones({ text }: { text: string | null }) {
  if (!text) return <>-</>
  return (
    <>
      {splitPhones(text).map((p, i) => (p.tel ? <a key={i} href={`tel:${p.tel}`}>{p.text}</a> : <span key={i}>{p.text}</span>))}
    </>
  )
}

function Fields({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="fields">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v ?? '-'}</dd>
        </div>
      ))}
    </dl>
  )
}

const d = (iso: string | null) => (iso ? `${iso} (${formatMD(iso)})` : '-')

export function DetailScreen({ detail, onBack, canEdit = false }: { detail: Detail; onBack: () => void; canEdit?: boolean }) {
  // 휴대폰 뒤로가기 버튼으로도 닫히게 한다
  useEffect(() => {
    // StrictMode(개발 모드)에서 effect가 두 번 돌아도 기록은 한 번만 쌓는다
    if (!history.state?.detail) history.pushState({ detail: true }, '')
    const onPop = () => onBack()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onBack])

  // 빠르게 두 번 누르면 history.back()이 두 번 불려 앱 밖으로 나가므로 한 번만 처리한다
  const closing = useRef(false)
  const close = () => {
    if (closing.current) return
    closing.current = true
    history.back()
  }
  const raw = detail.item.raw

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label="상세">
      <header>
        <button onClick={close}>‹ 뒤로</button>
        <strong>{detail.kind === 'in' ? `입고·${detail.item.port}` : '출고'}</strong>
      </header>
      <div className="body">
        {detail.kind === 'in' ? <InboundBody x={detail.item} canEdit={canEdit} /> : <OutboundBody x={detail.item} />}
        {Object.keys(raw).length > 0 && (
          <>
            <h2>원문 (변환하지 못한 값)</h2>
            <Fields rows={Object.entries(raw)} />
          </>
        )}
      </div>
    </div>
  )
}

function InboundBody({ x, canEdit }: { x: Inbound; canEdit: boolean }) {
  return (
    <>
      <h2>{x.item ?? '(품명 없음)'}</h2>
      <Fields rows={[
        ['기준일', d(x.baseDate)], ['입항일', d(x.arrivalDate)], ['선명', x.vessel], ['B/L', x.bl],
        ['수량', num(x.qty)], ['중량(kg)', num(x.weightKg)], ['용적(CBM)', num(x.cbm)], ['호선', x.hull], ['P.O', x.po],
        ['부두 및 창고', x.terminal], ['도착지', x.destination], ['비고', <WithPhones text={x.note} />],
      ]} />
      <h2>컨테이너 {x.containers.length}대</h2>
      {x.containers.length > 0 && (
        <ContainerTable x={x} canEdit={canEdit} />
      )}
    </>
  )
}

function OutboundBody({ x }: { x: Outbound }) {
  const { done } = useInspections()
  const riDone = x.bl ? done.get(x.bl) : undefined
  return (
    <>
      <h2>{x.item ?? '(품명 없음)'}{x.sameDay && ' · 당일착'}</h2>
      <Fields rows={[
        ['상차일', d(x.baseDate)], ['도착 요청일', d(x.arriveDate)], ['입문시간', x.gateTime], ['도착지', x.destination],
        ['순번', num(x.seq)], ['센터', x.center], ['BNL 입하일자', d(x.bnlInDate)], ['B/L', x.bl], ['호선', x.hull], ['PO', x.po],
        ['요청수량', x.qtyText], ['중량(kg)', num(x.weightKg)], ['용적(CBM)', num(x.cbm)], ['BOX NO', x.boxNo],
        ['MEMO', <WithPhones text={x.memo} />], ['입고 검수 일자', needsInspection(x) && riDone ? <span className="badge ok">RI 검사 완료 {formatMD(todayIso(new Date(riDone)))}</span> : needsInspection(x) ? <span className="badge inspect">검사필요</span> : d(x.inspectedDate)], ['신청자', x.requester], ['Location', x.location],
      ]} />
    </>
  )
}

/** 컨테이너별 상태. 관리자는 바꿀 수 있고, 반입됨으로 바꾸면 직원들에게 알림을 보낸다. */
function ContainerTable({ x, canEdit }: { x: Inbound; canEdit: boolean }) {
  const { statuses, reload } = useContainerStatuses([x.bl])
  const [message, setMessage] = useState('')
  async function change(no: string, status: ContainerStatus) {
    setMessage('')
    try {
      await setStatus(supabase, x.bl, no, status)
      reload()
      if (status === '반입됨') {
        const { error } = await supabase.functions.invoke('notify', { body: { kind: 'container', date: x.baseDate, containers: [no] } })
        if (error) setMessage('상태는 바꿨지만 알림을 보내지 못했어요')
      }
    } catch {
      setMessage('저장하지 못했어요. 인터넷을 확인해 주세요')
    }
  }
  return (
    <>
      <table className="containers">
        <thead><tr><th>#</th><th>번호</th><th>구분</th><th>상태</th></tr></thead>
        <tbody>
          {x.containers.map((c, i) => {
            const st = statuses.get(statusKey(x.bl, c.no)) ?? '입고예정'
            return (
              <tr key={i}>
                <td>{i + 1}</td><td>{c.no}</td><td>{c.type ?? '-'}</td>
                <td>{canEdit
                  ? <select aria-label={`${c.no} 상태`} value={st} onChange={(e) => void change(c.no, e.target.value as ContainerStatus)}>{CONTAINER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                  : st}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {message && <p className="sheet-msg" role="alert">{message}</p>}
    </>
  )
}
