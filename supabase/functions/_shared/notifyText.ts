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

/** 컨테이너 반입 알림: 컨테이너 번호(영문 대문자·숫자)만 싣는다 */
export interface ContainerArrival {
  kind: 'container'
  date: string
  containers: string[]
}

type Message = { title: string; body: string; tag: string; url: string }

export function buildMessage(s: UploadSummary | ContainerArrival): Message {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) throw new Error('날짜 형식이 올바르지 않아요')
  if ('kind' in s && s.kind === 'container') {
    const list = Array.isArray(s.containers) ? s.containers : []
    if (!list.length || list.some((c) => typeof c !== 'string' || !/^[A-Z0-9]{4,15}$/.test(c))) throw new Error('컨테이너 번호가 올바르지 않아요')
    const body = `컨테이너 ${list[0]}${list.length > 1 ? ` 외 ${list.length - 1}개` : ''} 반입됐어요`
    return { title: '(주)부산신항로지텍', body, tag: 'bnl-container', url: `?date=${s.date}` }
  }
  s = s as UploadSummary
  const md = `${+s.date.slice(5, 7)}.${+s.date.slice(8, 10)}`
  const same = count(s.sameDay)
  const body = `${md} 입출고가 올라왔어요 — 입고 ${count(s.inbound)} · 출고 ${count(s.outbound)}${same ? ` (당일착 ${same})` : ''}`
  return { title: '(주)부산신항로지텍', body, tag: 'bnl-upload', url: `?date=${s.date}` }
}
