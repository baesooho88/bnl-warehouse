import { useEffect, useMemo, useState } from 'react'
import { BarChart, type Metric } from '../components/BarChart'
import { cbmText, tons } from '../components/format'
import { monthRange, weekRange } from '../lib/dates'
import { computeStats, type Ranked, type Stats } from '../lib/stats'
import { repo } from '../repo'

type Mode = '이번 주' | '이번 달' | '직접 지정'

export function StatsScreen({ dataVersion }: { dataVersion: number }) {
  const [mode, setMode] = useState<Mode>('이번 주')
  const [metric, setMetric] = useState<Metric>('건수')
  const [custom, setCustom] = useState(() => weekRange(new Date()))
  const range = useMemo(
    () => (mode === '이번 주' ? weekRange(new Date()) : mode === '이번 달' ? monthRange(new Date()) : custom),
    [mode, custom],
  )
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (range.from > range.to) return setStats(null)
    let alive = true
    repo.getRange(range.from, range.to).then((d) => alive && setStats(computeStats(d, range.from, range.to)))
    return () => { alive = false }
  }, [range, dataVersion])

  const inb = stats && { count: stats.inbound.북항.count + stats.inbound.신항.count, weightKg: stats.inbound.북항.weightKg + stats.inbound.신항.weightKg, cbm: stats.inbound.북항.cbm + stats.inbound.신항.cbm }

  return (
    <>
      <h1 className="screen-title">통계</h1>
      <div className="filters" role="group" aria-label="기간">
        {(['이번 주', '이번 달', '직접 지정'] as Mode[]).map((m) => (
          <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m}</button>
        ))}
      </div>
      {mode === '직접 지정' && (
        <div className="range">
          <input type="date" aria-label="시작일" value={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
          <span>~</span>
          <input type="date" aria-label="종료일" value={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
        </div>
      )}
      {range.from > range.to && <p className="empty">시작일이 종료일보다 늦어요</p>}
      {stats && inb && (
        <>
          <div className="kpi-grid">
            <Kpi title="입고" value={`${inb.count}건`} sub={`북항 ${stats.inbound.북항.count} · 신항 ${stats.inbound.신항.count}`} tone="in" />
            <Kpi title="출고" value={`${stats.outbound.count}건`} sub={`당일착 ${stats.outbound.sameDay}`} tone="out" />
            <Kpi title="중량" value={tons(inb.weightKg + stats.outbound.weightKg)} sub={`입 ${tons(inb.weightKg)} · 출 ${tons(stats.outbound.weightKg)}`} />
            <Kpi title="CBM" value={(inb.cbm + stats.outbound.cbm).toLocaleString('ko-KR', { maximumFractionDigits: 1 })} sub={`입 ${inb.cbm.toLocaleString('ko-KR', { maximumFractionDigits: 1 })} · 출 ${stats.outbound.cbm.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}`} />
          </div>

          <div className="section-row">
            <h2 className="section-title">일별 추이</h2>
            <div className="seg" role="group" aria-label="기준">
              {(['건수', '중량', 'CBM'] as Metric[]).map((m) => <button key={m} aria-pressed={metric === m} onClick={() => setMetric(m)}>{m}</button>)}
            </div>
          </div>
          <BarChart data={stats.daily} metric={metric} />

          <h2 className="section-title">입고 항구별</h2>
          <HBars tone="in" rows={(['북항', '신항'] as const).map((p) => ({
            name: p, value: stats.inbound[p].count,
            text: `${stats.inbound[p].count}건 · ${tons(stats.inbound[p].weightKg)} · ${cbmText(stats.inbound[p].cbm)} · 컨 ${stats.inbound[p].containers}대`,
          }))} />

          <h2 className="section-title">출고 도착지 상위 5</h2>
          <HBars tone="out" rows={ranked(stats.topDestinations)} />
          <h2 className="section-title">호선 상위 5 (입고+출고)</h2>
          <HBars tone="muted" rows={ranked(stats.topHulls)} />
        </>
      )}
    </>
  )
}

const ranked = (r: Ranked[]) => r.map((x) => ({ name: x.name, value: x.count, text: `${x.count}건 · ${cbmText(x.cbm)}` }))

function Kpi({ title, value, sub, tone }: { title: string; value: string; sub: string; tone?: 'in' | 'out' }) {
  return (
    <div className={`kpi${tone ? ` ${tone}` : ''}`}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  )
}

/** 가로 막대 목록: 길이로 크기를 비교, 값은 글자로 함께 */
function HBars({ rows, tone }: { rows: { name: string; value: number; text: string }[]; tone: 'in' | 'out' | 'muted' }) {
  if (!rows.length) return <p className="hint">데이터가 없어요</p>
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="hbar-top"><span className="hbar-name">{r.name}</span><span className="hbar-val">{r.text}</span></div>
          <div className="hbar-track"><div className={`hbar ${tone}`} style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}
