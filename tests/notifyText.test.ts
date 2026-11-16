import { expect, test } from 'vitest'
import { buildMessage } from '../supabase/functions/_shared/notifyText'

test('업로드 알림은 없앴다: 이전 앱이 보내도, 형식이 틀려도 거부', () => {
  expect(() => buildMessage({ kind: 'upload', updates: [{ type: '출고', date: '2026-11-06', count: 28 }] } as never)).toThrow()
  expect(() => buildMessage({ date: '2026-11-06', inbound: 1, outbound: 1, sameDay: 0 } as never)).toThrow()
  expect(() => buildMessage(null as never)).toThrow()
})

test('컨테이너 반입 알림: 번호만 담고, 여러 개면 "외 N개"', () => {
  expect(buildMessage({ kind: 'container', date: '2026-11-10', containers: ['TEST1234567'] })).toEqual({
    title: '(주)부산신항로지텍', body: '컨테이너 TEST1234567 반입됐어요', tag: 'bnl-container', url: '?date=2026-11-10',
  })
  expect(buildMessage({ kind: 'container', date: '2026-11-10', containers: ['TEST1234567', 'ABCU0000001', 'ABCU0000002'] }).body).toBe('컨테이너 TEST1234567 외 2개 반입됐어요')
})
test('컨테이너 번호 형식이 틀리면 거부(이름 등 다른 글이 알림에 들어가지 않게)', () => {
  expect(() => buildMessage({ kind: 'container', date: '2026-11-10', containers: ['홍길동'] })).toThrow()
  expect(() => buildMessage({ kind: 'container', date: '2026-11-10', containers: [] })).toThrow()
  expect(buildMessage({ kind: 'container', date: '2026-11-10', containers: ['TEST1234567'], status: '입고됨' }).body).toBe('컨테이너 TEST1234567 입고됐어요')
  expect(() => buildMessage({ kind: 'container', date: '2026-11-10', containers: ['TEST1234567'], status: '입고예정' as '입고됨' })).toThrow()
})
