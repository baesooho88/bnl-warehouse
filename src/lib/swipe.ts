const MIN_DX = 60 // 이보다 짧으면 실수로 스친 것
const EDGE = 24 // 가장자리에서 시작한 밀기는 안드로이드 뒤로 가기 제스처에 양보

/** 가로로 민 방향: 왼쪽으로 밀면 1(다음), 오른쪽으로 밀면 -1(이전). 넘기지 않으면 null. */
export function swipeDir(g: { dx: number; dy: number; startX: number; width: number }): 1 | -1 | null {
  if (Math.abs(g.dx) < MIN_DX || Math.abs(g.dx) < Math.abs(g.dy) * 1.5) return null
  if (g.startX < EDGE || g.startX > g.width - EDGE) return null
  return g.dx < 0 ? 1 : -1
}
