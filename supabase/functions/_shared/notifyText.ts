// Node(테스트)·Deno 공용. 알림에는 날짜와 건수만 — 이름·전화번호는 들어갈 자리가 없다.
export interface UploadSummary {
  date: string
  inbound: number
  outbound: number
  sameDay: number
}

const count = (n: unknown) => {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) throw new Error('건수가 올바르지 않아요')
  return n
}

export function buildMessage(s: UploadSummary): { title: string; body: string; tag: string; url: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) throw new Error('날짜 형식이 올바르지 않아요')
  const md = `${+s.date.slice(5, 7)}.${+s.date.slice(8, 10)}`
  const same = count(s.sameDay)
  const body = `${md} 입출고가 올라왔어요 — 입고 ${count(s.inbound)} · 출고 ${count(s.outbound)}${same ? ` (당일착 ${same})` : ''}`
  return { title: '(주)부산신항로지텍', body, tag: 'bnl-upload', url: `?date=${s.date}` }
}
