import { expect, test } from 'vitest'
import { parseHolidays } from '../supabase/functions/_shared/holidays'

test('공휴일만, 날짜순 — 기념일은 빼고 대체공휴일은 넣는다', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260302\r\nDESCRIPTION:공휴일\r\nSUMMARY:쉬는 날 삼일절\r\nEND:VEVENT',
    'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260508\r\nDESCRIPTION:기념일\\n기념일을 숨기려면\r\nSUMMARY:어버이날\r\nEND:VEVENT',
    'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260301\r\nDESCRIPTION:공휴일\r\nSUMMARY:삼일\r\n 절\r\nEND:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  expect(parseHolidays(ics)).toEqual([
    { date: '2026-03-01', name: '삼일절' },
    { date: '2026-03-02', name: '쉬는 날 삼일절' },
  ])
})
