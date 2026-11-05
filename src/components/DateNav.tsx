import { addDays, formatDay } from '../lib/dates'

export function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  return (
    <div className="datenav">
      <button className="arrow" aria-label="전날" onClick={() => onChange(addDays(date, -1))}>◀</button>
      <label className="day">
        {formatDay(date)} 📅
        <input type="date" aria-label="날짜 선택" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} />
      </label>
      <button className="arrow" aria-label="다음날" onClick={() => onChange(addDays(date, 1))}>▶</button>
    </div>
  )
}
