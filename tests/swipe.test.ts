import { expect, test } from 'vitest'
import { swipeTab } from '../src/lib/swipe'

const tabs = ['목록', '검색', '통계', '달력']
const g = (dx: number, dy = 0, startX = 180) => ({ dx, dy, startX, width: 360 })

test('왼쪽으로 밀면 다음 탭, 오른쪽으로 밀면 이전 탭', () => {
  expect(swipeTab(tabs, '검색', g(-80))).toBe('통계')
  expect(swipeTab(tabs, '검색', g(80))).toBe('목록')
})
test('양 끝 탭에서는 넘어가지 않음', () => {
  expect(swipeTab(tabs, '목록', g(80))).toBeNull()
  expect(swipeTab(tabs, '달력', g(-80))).toBeNull()
})
test('짧게 밀거나 세로 스크롤에 가까우면 무시', () => {
  expect(swipeTab(tabs, '검색', g(-40))).toBeNull()
  expect(swipeTab(tabs, '검색', g(-80, 70))).toBeNull()
})
test('화면 가장자리(24px 안)에서 시작하면 무시(안드로이드 뒤로 가기 제스처)', () => {
  expect(swipeTab(tabs, '검색', g(80, 0, 10))).toBeNull()
  expect(swipeTab(tabs, '검색', g(-80, 0, 350))).toBeNull()
})
