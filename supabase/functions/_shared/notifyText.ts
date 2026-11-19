// Node(테스트)·Deno 공용. 알림에는 날짜와 컨테이너 번호만 — 이름·전화번호는 들어갈 자리가 없다.

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

export function buildMessage(s: ContainerArrival): Message {
  if (s?.kind === 'container') {
    md(s.date)
    const list = Array.isArray(s.containers) ? s.containers : []
    if (!list.length || list.some((c) => typeof c !== 'string' || !/^[A-Z0-9]{4,15}$/.test(c))) throw new Error('컨테이너 번호가 올바르지 않아요')
    const status = s.status ?? '반입됨'
    if (status !== '입고됨' && status !== '반입됨') throw new Error('상태가 올바르지 않아요')
    const body = `컨테이너 ${list[0]}${list.length > 1 ? ` 외 ${list.length - 1}개` : ''} ${status === '입고됨' ? '입고' : '반입'}됐어요`
    return { title: '(주)부산신항로지텍', body, tag: 'bnl-container', url: `?date=${s.date}&cntr=${list[0]}` } // 알림을 누르면 그 컨테이너의 B/L로
  }
  // 업로드 알림은 없앴다(2026-11-16). 캐시된 이전 앱이 보내도 울리지 않게 거부한다.
  throw new Error('알림 종류가 올바르지 않아요')
}
