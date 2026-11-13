import { expect, test } from 'vitest'
import { buildMessage } from '../supabase/functions/_shared/notifyText'

test('업로드 알림: 바뀐 종류마다 날짜와 건수', () => {
  expect(buildMessage({ kind: 'upload', updates: [
    { type: '입고', date: '2026-11-13', count: 3 },
    { type: '출고', date: '2026-11-12', count: 28, sameDay: 2 },
    { type: '배차', date: '2026-11-12', count: 15 },
  ] })).toEqual({
    title: '(주)부산신항로지텍',
    body: '입고 11.13 3건 · 출고 11.12 28건(당일착 2) · 배차 11.12 15대 업데이트됐어요',
    tag: 'bnl-upload',
    url: '?date=2026-11-13',
  })
  expect(buildMessage({ kind: 'upload', updates: [{ type: '출고', date: '2026-11-06', count: 28, sameDay: 0 }] }).body).toBe('출고 11.6 28건 업데이트됐어요')
})

test('형식이 틀린 입력은 거부', () => {
  const up = (u: object) => () => buildMessage({ kind: 'upload', updates: [u as never] })
  expect(up({ type: '입고', date: '11/6', count: 1 })).toThrow()
  expect(up({ type: '입고', date: '2026-11-06', count: -1 })).toThrow()
  expect(up({ type: '홍길동', date: '2026-11-06', count: 1 })).toThrow()
  expect(() => buildMessage({ kind: 'upload', updates: [] })).toThrow()
  expect(() => buildMessage({ date: '2026-11-06', inbound: 1, outbound: 1, sameDay: 0 } as never)).toThrow()
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
