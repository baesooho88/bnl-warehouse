import type { Dispatch } from '../domain/types'

const pad = (n: number) => String(n).padStart(2, '0')
const MATERIALS = ['인바', '해양'] // 비고의 자재 이름: 인바만 INVAR로 표시, 나머지는 숨김

/**
 * 출하요청서 파일의 '배차' 시트(한 칸에 한 줄)를 읽는다. 형식:
 *   당착 | 11월 11일 도착 [(인바)]      ← 머리줄: 아래 줄들의 도착일(당착 = null)
 *   1, 2 ~ 4 : 11TX1, 5TX1 (지역 - 업체 | 인바/09시)
 * 같은 순번이 또 나오면 나중 줄이 이기고, 문제로 알려 준다.
 */
export function parseDispatch(lines: string[], baseDate: string): { bySeq: Map<number, Dispatch>; problems: string[] } {
  const bySeq = new Map<number, Dispatch>()
  const problems: string[] = []
  let arrive: string | null = null
  let headerInvar = false
  let line = 0

  for (const raw of lines) {
    const text = raw.trim()
    if (!text) continue
    const head = text.match(/^(?:당착|(\d{1,2})월\s*(\d{1,2})일)[^:]*$/)
    if (head) {
      arrive = head[1] ? arriveDate(+head[1], +head[2], baseDate) : null
      headerInvar = text.includes('인바')
      continue
    }
    const m = text.match(/^([\d\s,~]+):\s*([^()]+?)\s*(?:\((.*)\))?$/)
    const seqs = m && seqList(m[1])
    const vehicles = m && vehicleText(m[2])
    if (!seqs?.length || !vehicles) { problems.push(`읽지 못한 줄: ${text}`); continue }
    line++
    const parts = (m[3] ?? '').split('/').map((s) => s.trim()).filter(Boolean)
    const note = parts.filter((p) => !MATERIALS.includes(p)).join(' · ') || null
    const d: Dispatch = { line, arrive, vehicles, note, invar: headerInvar || parts.includes('인바') }
    for (const s of seqs) {
      if (bySeq.has(s)) problems.push(`순번 ${s} 두 번 나옴`)
      bySeq.set(s, d)
    }
  }
  return { bySeq, problems }
}

/** '12 ~ 14, 30' → [12, 13, 14, 30] */
function seqList(s: string): number[] | null {
  const out: number[] = []
  for (const part of s.split(',').map((p) => p.trim()).filter(Boolean)) {
    const r = part.match(/^(\d+)(?:\s*~\s*(\d+))?$/)
    if (!r) return null
    const a = +r[1], b = r[2] ? +r[2] : a
    if (b < a || b - a > 200) return null
    for (let i = a; i <= b; i++) out.push(i)
  }
  return out
}

/** '8TX1, 5TX1' → '8T×1 · 5T×1', 'TRTX1' → 'TR×1' */
function vehicleText(s: string): string | null {
  const out = s.split(',').map((p) => p.trim().toUpperCase().match(/^(\d+(?:\.\d+)?|[A-Z]+)TX(\d+)$/))
  if (out.some((v) => !v)) return null
  return out.map((v) => (/^\d/.test(v![1]) ? `${v![1]}T×${v![2]}` : `${v![1]}×${v![2]}`)).join(' · ')
}

/** 기준일보다 반년 이상 앞선 달이면 다음 해로 본다(12월 배차 → 1월 도착) */
function arriveDate(month: number, day: number, baseDate: string): string {
  const baseYear = +baseDate.slice(0, 4)
  const year = month < +baseDate.slice(5, 7) - 6 ? baseYear + 1 : baseYear
  return `${year}-${pad(month)}-${pad(day)}`
}
