// Node(테스트)·Deno 공용. 구글 '대한민국의 휴일' 캘린더(ICS)에서 공휴일만 뽑는다(기념일 제외, 대체공휴일 포함).
export interface Holiday { date: string; name: string }

export function parseHolidays(ics: string): Holiday[] {
  const out: Holiday[] = []
  for (const ev of ics.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1)) {
    const get = (key: string) => ev.match(new RegExp(`^${key}[^:\\n]*:(.*)$`, 'm'))?.[1]?.trim() ?? ''
    const d = get('DTSTART').match(/^(\d{4})(\d{2})(\d{2})/)
    if (d && get('DESCRIPTION').startsWith('공휴일')) out.push({ date: `${d[1]}-${d[2]}-${d[3]}`, name: get('SUMMARY') })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
