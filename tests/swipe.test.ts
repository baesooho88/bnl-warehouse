import { expect, test } from 'vitest'
import { swipeDir } from '../src/lib/swipe'

const g = (dx: number, dy = 0, startX = 180) => ({ dx, dy, startX, width: 360 })

test('왼쪽으로 밀면 다음(1), 오른쪽으로 밀면 이전(-1)', () => {
  expect(swipeDir(g(-80))).toBe(1)
  expect(swipeDir(g(80))).toBe(-1)
})
test('짧게 밀거나 세로 스크롤에 가까우면 무시', () => {
  expect(swipeDir(g(-40))).toBeNull()
  expect(swipeDir(g(-80, 70))).toBeNull()
})
test('화면 가장자리(24px 안)에서 시작하면 무시(안드로이드 뒤로 가기 제스처)', () => {
  expect(swipeDir(g(80, 0, 10))).toBeNull()
  expect(swipeDir(g(-80, 0, 350))).toBeNull()
})
