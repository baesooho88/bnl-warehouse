import { expect, test } from 'vitest'
import { buildMessage } from '../supabase/functions/_shared/notifyText'

test('업로드 알림 문구', () => {
  expect(buildMessage({ date: '2026-11-06', inbound: 3, outbound: 28, sameDay: 2 })).toEqual({
    title: '(주)부산신항로지텍',
    body: '11.6 입출고가 올라왔어요 — 입고 3 · 출고 28 (당일착 2)',
    tag: 'bnl-upload',
    url: '?date=2026-11-06',
  })
})

test('당일착이 없으면 괄호를 생략', () => {
  expect(buildMessage({ date: '2026-11-06', inbound: 0, outbound: 28, sameDay: 0 }).body).toBe('11.6 입출고가 올라왔어요 — 입고 0 · 출고 28')
})

test('형식이 틀린 입력은 거부', () => {
  expect(() => buildMessage({ date: '11/6', inbound: 1, outbound: 1, sameDay: 0 })).toThrow()
  expect(() => buildMessage({ date: '2026-11-06', inbound: -1, outbound: 1, sameDay: 0 })).toThrow()
  expect(() => buildMessage({ date: '2026-11-06', inbound: '홍길동' as unknown as number, outbound: 1, sameDay: 0 })).toThrow()
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
})
