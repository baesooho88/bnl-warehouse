import { formatMD } from '../lib/dates'

export function BarChart({ data }: { data: { date: string; inbound: number; outbound: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.inbound, d.outbound]))
  return (
    <div className="chart">
      <div className="legend"><span className="dot in" />입고 <span className="dot out" />출고</div>
      <div className="bars" role="img" aria-label={data.map((d) => `${formatMD(d.date)} 입고 ${d.inbound} 출고 ${d.outbound}`).join(', ')}>
        {data.map((d) => (
          <div key={d.date} className="col">
            <div className="pair">
              <div className="bar in" style={{ height: `${(d.inbound / max) * 100}%` }} title={`입고 ${d.inbound}`} />
              <div className="bar out" style={{ height: `${(d.outbound / max) * 100}%` }} title={`출고 ${d.outbound}`} />
            </div>
            <div className="label">{formatMD(d.date)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
