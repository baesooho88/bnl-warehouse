const PHONE = /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g

/** 문장을 전화번호 조각과 나머지 조각으로 나눈다. 전화번호 조각에는 tel(숫자만)이 붙는다. */
export function splitPhones(text: string): { text: string; tel?: string }[] {
  const parts: { text: string; tel?: string }[] = []
  let last = 0
  for (const m of text.matchAll(PHONE)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ text: m[0], tel: m[0].replace(/\D/g, '') })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}
