import { useState } from 'react'
import { formatMD } from '../lib/dates'
import type { Totals } from '../lib/stats'
import { cbmText, tons } from './format'

export type Metric = '건수' | '중량' | 'CBM'
const pick = (t: Totals, m: Metric) => (m === '건수' ? t.count : m === '중량' ? t.weightKg : t.cbm)
export const metricText = (v: number, m: Metric) => (m === '건수' ? `${v}건` : m === '중량' ? tons(v) : cbmText(v))

/** 일별 입고·출고 막대. 막대를 누르면 그날 값이 위에 나온다(휴대폰에는 마우스 올리기가 없어서). */
export function BarChart({ data, metric }: { data: { date: string; inbound: Totals; outbound: Totals }[]; metric: Metric }) {
  const [sel, setSel] = useState<string | null>(null)
  const max = Math.max(1e-9, ...data.flatMap((d) => [pick(d.inbound, metric), pick(d.outbound, metric)]))
  const every = Math.ceil(data.length / 8) // 날짜 글자는 8개 정도만
  const s = data.find((d) => d.date === sel)
  return (
    <div className="chart">
      <div className="legend">
        <span className="dot in" />입고 <span className="dot out" />출고
        <span className="chart-sel">{s ? `${formatMD(s.date)} · 입고 ${metricText(pick(s.inbound, metric), metric)} · 출고 ${metricText(pick(s.outbound, metric), metric)}` : '막대를 누르면 값이 보여요'}</span>
      </div>
      <div className="bars" role="img" aria-label={data.map((d) => `${formatMD(d.date)} 입고 ${metricText(pick(d.inbound, metric), metric)} 출고 ${metricText(pick(d.outbound, metric), metric)}`).join(', ')}>
        {data.map((d, i) => (
          <button key={d.date} className={`col${sel === d.date ? ' on' : ''}`} onClick={() => setSel(sel === d.date ? null : d.date)} aria-label={formatMD(d.date)}>
            <span className="pair">
              <span className="bar in" style={{ height: `${(pick(d.inbound, metric) / max) * 100}%` }} />
              <span className="bar out" style={{ height: `${(pick(d.outbound, metric) / max) * 100}%` }} />
            </span>
            <span className="label">{i % every === 0 ? formatMD(d.date) : ''}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
