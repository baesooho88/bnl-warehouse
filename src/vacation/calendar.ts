// 휴가 달력 계산. 월은 'YYYY-MM', 날짜는 'YYYY-MM-DD'. UTC로 계산한다(src/lib/dates.ts와 같은 방식).
export const VACATION_TYPES = ['연차', '오전반차', '오후반차', '기타'] as const
export type VacationType = (typeof VACATION_TYPES)[number]

const pad = (n: number) => String(n).padStart(2, '0')
const parts = (ym: string) => [+ym.slice(0, 4), +ym.slice(5, 7)] as const

export const monthOf = (iso: string) => iso.slice(0, 7)

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = parts(ym)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

export function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = parts(ym)
  return { from: `${ym}-01`, to: `${ym}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}` }
}

/** 일~토 7칸씩 주 단위. 그 달이 아닌 칸은 null. */
export function monthGrid(ym: string): (string | null)[][] {
  const [y, m] = parts(ym)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (string | null)[] = Array(new Date(Date.UTC(y, m - 1, 1)).getUTCDay()).fill(null)
  for (let d = 1; d <= last; d++) cells.push(`${ym}-${pad(d)}`)
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

/** 앞뒤 공백만 제거(중간 공백 유지). 비었거나 20자 넘으면 null. */
export function normalizeName(raw: string): string | null {
  const n = raw.trim()
  return n.length >= 1 && n.length <= 20 ? n : null
}

export function cellSummary<T>(names: T[], max = 4): { shown: T[]; more: number } {
  return { shown: names.slice(0, max), more: Math.max(0, names.length - max) }
}

/** 이름 자동완성: 친 글자로 시작하는 이름(성으로 찾기), 이미 똑같이 친 이름은 빼고 최대 8개 */
export function suggestNames(names: string[], typed: string): string[] {
  const t = typed.trim()
  if (!t) return []
  return names.filter((n) => n.startsWith(t) && n !== t).slice(0, 8)
}
