// 공휴일 목록: 구글 공개 휴일 캘린더는 브라우저에서 직접 못 읽어(CORS) 여기서 중계한다.
import { parseHolidays } from '../_shared/holidays.ts'
import { json, preflight } from '../_shared/http.ts'

const ICS = 'https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  const res = await fetch(ICS).catch(() => null)
  if (!res?.ok) return json({ error: '공휴일을 불러오지 못했어요' }, 502)
  return json(parseHolidays(await res.text()))
})
