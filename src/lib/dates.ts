// 날짜는 항상 'YYYY-MM-DD' 문자열로 다룬다. 계산은 UTC로 해서 시간대·서머타임 영향을 받지 않게 한다.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')
const fromUtc = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const toUtc = (iso: string) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)))

/** 휴대폰 시계 기준 오늘 */
export function todayIso(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUtc(d)
}

/** '2026-11-05' → '11.5' */
export function formatMD(iso: string): string {
  return `${+iso.slice(5, 7)}.${+iso.slice(8, 10)}`
}

/** '2026-11-05' → '11.5 (목)' */
export function formatDay(iso: string): string {
  return `${formatMD(iso)} (${WEEKDAYS[toUtc(iso).getUTCDay()]})`
}

export function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  return days
}

/** 월요일~일요일 */
export function weekRange(now: Date): { from: string; to: string } {
  const today = todayIso(now)
  const back = (toUtc(today).getUTCDay() + 6) % 7
  const from = addDays(today, -back)
  return { from, to: addDays(from, 6) }
}

export function monthRange(now: Date): { from: string; to: string } {
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  const lastDay = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).getUTCDate()
  return { from, to: `${from.slice(0, 8)}${pad(lastDay)}` }
}
