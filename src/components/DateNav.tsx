import { addDays, formatDay } from '../lib/dates'
import { slideIn } from '../lib/swipe'

export function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  return (
    <div className="datenav">
      <button className="arrow" aria-label="전날" onClick={(e) => { onChange(addDays(date, -1)); slideIn(e.currentTarget, -1) }}>◀</button>
      <label className="day">
        {formatDay(date)} 📅
        <input type="date" aria-label="날짜 선택" value={date} onChange={(e) => {
          const d = e.target.value
          if (!d || d === date) return
          onChange(d)
          slideIn(e.currentTarget, d > date ? 1 : -1) // ISO 날짜는 문자열 비교로 앞뒤가 맞다
        }} />
      </label>
      <button className="arrow" aria-label="다음날" onClick={(e) => { onChange(addDays(date, 1)); slideIn(e.currentTarget, 1) }}>▶</button>
    </div>
  )
}
