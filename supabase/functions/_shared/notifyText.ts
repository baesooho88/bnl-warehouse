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

/** 컨테이너 반입 알림: 컨테이너 번호(영문 대문자·숫자)만 싣는다 */
export interface ContainerArrival {
  kind: 'container'
  date: string
  containers: string[]
}

/** RI 검사 완료 알림: B/L 번호(영문 대문자·숫자·-)만 싣는다. 직원도 보낼 수 있는 유일한 알림. */
export interface InspectionDone {
  kind: 'inspection'
  date: string
  bl: string
}

type Message = { title: string; body: string; tag: string; url: string }

const md = (date: unknown) => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('날짜 형식이 올바르지 않아요')
  return `${+date.slice(5, 7)}.${+date.slice(8, 10)}`
}

export function buildMessage(s: UploadSummary | ContainerArrival | InspectionDone): Message {
  if (s.kind !== 'upload') md(s.date)
  if ('kind' in s && s.kind === 'container') {
    const list = Array.isArray(s.containers) ? s.containers : []
    if (!list.length || list.some((c) => typeof c !== 'string' || !/^[A-Z0-9]{4,15}$/.test(c))) throw new Error('컨테이너 번호가 올바르지 않아요')
    const body = `컨테이너 ${list[0]}${list.length > 1 ? ` 외 ${list.length - 1}개` : ''} 반입됐어요`
    return { title: '(주)부산신항로지텍', body, tag: 'bnl-container', url: `?date=${s.date}` }
  }
  if ('kind' in s && s.kind === 'inspection') {
    if (typeof s.bl !== 'string' || !/^[A-Z0-9-]{4,25}$/.test(s.bl)) throw new Error('B/L 번호가 올바르지 않아요')
    return { title: '(주)부산신항로지텍', body: `B/L ${s.bl} 검사 완료됐어요`, tag: 'bnl-inspection', url: `?date=${s.date}` }
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
