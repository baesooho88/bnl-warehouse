import { useEffect, useMemo, useState } from 'react'
import { BarChart } from '../components/BarChart'
import { tons } from '../components/format'
import { monthRange, weekRange } from '../lib/dates'
import { computeStats, type Stats } from '../lib/stats'
import { repo } from '../repo'

type Mode = '이번 주' | '이번 달' | '직접 지정'

export function StatsScreen({ dataVersion }: { dataVersion: number }) {
  const [mode, setMode] = useState<Mode>('이번 주')
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
      {stats && (
        <>
          <div className="stat-grid">
            <StatCard title="입고 북항" lines={[`${stats.inbound.북항.count}건`, tons(stats.inbound.북항.weightKg), `컨테이너 ${stats.inbound.북항.containers}대`]} />
            <StatCard title="입고 신항" lines={[`${stats.inbound.신항.count}건`, tons(stats.inbound.신항.weightKg), `컨테이너 ${stats.inbound.신항.containers}대`]} />
            <StatCard title="출고" lines={[`${stats.outbound.count}건`, tons(stats.outbound.weightKg), `당일착 ${stats.outbound.sameDay}건`]} />
          </div>
          <h2 className="section-title">일별 건수</h2>
          <BarChart data={stats.daily} />
          <h2 className="section-title">호선별 상위 10 (입고+출고)</h2>
          <TopList rows={stats.topHulls.map((x) => [x.hull, x.count])} />
          <h2 className="section-title">출고 도착지 상위 10</h2>
          <TopList rows={stats.topDestinations.map((x) => [x.destination, x.count])} />
        </>
      )}
    </>
  )
}

function StatCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="stat">
      <div className="stat-title">{title}</div>
      <div className="stat-main">{lines[0]}</div>
      {lines.slice(1).map((l) => <div key={l} className="stat-sub">{l}</div>)}
    </div>
  )
}

function TopList({ rows }: { rows: [string, number][] }) {
  if (!rows.length) return <p className="hint">데이터가 없어요</p>
  return (
    <ol className="toplist">
      {rows.map(([name, count]) => <li key={name}><span>{name}</span><b>{count}건</b></li>)}
    </ol>
  )
}
