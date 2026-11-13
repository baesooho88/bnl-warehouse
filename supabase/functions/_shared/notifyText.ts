// Node(테스트)·Deno 공용. 알림에는 날짜와 건수만 — 이름·전화번호는 들어갈 자리가 없다.
/** 업로드 알림: 이번에 바뀐 종류(입고·출고·배차)마다 날짜와 그날 건수 */
export interface UploadSummary {
  kind: 'upload'
  updates: { type: '입고' | '출고' | '배차'; date: string; count: number; sameDay?: number }[]
}

const count = (n: unknown) => {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) throw new Error('건수가 올바르지 않아요')
  return n
}

/** 컨테이너 입고·반입 알림: 컨테이너 번호(영문 대문자·숫자)만 싣는다 */
export interface ContainerArrival {
  kind: 'container'
  date: string
  containers: string[]
  status?: '입고됨' | '반입됨' // 없으면 반입됨(이전 앱)
}

type Message = { title: string; body: string; tag: string; url: string }

const md = (date: unknown) => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('날짜 형식이 올바르지 않아요')
  return `${+date.slice(5, 7)}.${+date.slice(8, 10)}`
}

export function buildMessage(s: UploadSummary | ContainerArrival): Message {
  if (s.kind !== 'upload') md(s.date)
  if ('kind' in s && s.kind === 'container') {
    const list = Array.isArray(s.containers) ? s.containers : []
    if (!list.length || list.some((c) => typeof c !== 'string' || !/^[A-Z0-9]{4,15}$/.test(c))) throw new Error('컨테이너 번호가 올바르지 않아요')
    const status = s.status ?? '반입됨'
    if (status !== '입고됨' && status !== '반입됨') throw new Error('상태가 올바르지 않아요')
    const body = `컨테이너 ${list[0]}${list.length > 1 ? ` 외 ${list.length - 1}개` : ''} ${status === '입고됨' ? '입고' : '반입'}됐어요`
    return { title: '(주)부산신항로지텍', body, tag: 'bnl-container', url: `?date=${s.date}` }
  }
  const ups = Array.isArray(s.updates) ? s.updates : []
  if (!ups.length || ups.length > 3) throw new Error('바뀐 내용이 올바르지 않아요')
  const parts = ups.map((u) => {
    if (!['입고', '출고', '배차'].includes(u?.type)) throw new Error('종류가 올바르지 않아요')
    const same = u.type === '출고' ? count(u.sameDay ?? 0) : 0
    return `${u.type} ${md(u.date)} ${count(u.count)}${u.type === '배차' ? '대' : '건'}${same ? `(당일착 ${same})` : ''}`
  })
  const last = ups.map((u) => u.date).sort().at(-1)!
  return { title: '(주)부산신항로지텍', body: `${parts.join(' · ')} 업데이트됐어요`, tag: 'bnl-upload', url: `?date=${last}` }
}
