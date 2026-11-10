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
