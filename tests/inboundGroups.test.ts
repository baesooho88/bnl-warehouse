import { expect, test } from 'vitest'
import type { Inbound } from '../src/domain/types'
import { groupInbound } from '../src/lib/inboundGroups'

const x = (bl: string, cs: string[], port: Inbound['port'] = '신항') =>
  ({ id: bl, port, bl, containers: cs.map((no) => ({ no, type: null })) }) as unknown as Inbound

test('컨테이너 묶음이 같은 B/L은 한 묶음, 순서는 처음 나온 자리', () => {
  const g = groupInbound([x('A', ['C1']), x('B', ['C2', 'C3']), x('C', ['C1']), x('D', ['C3', 'C2']), x('E', [])])
  expect(g.map((xs) => xs.map((i) => i.bl))).toEqual([['A', 'C'], ['B', 'D'], ['E']])
})

test('부두가 다르거나 컨테이너가 없으면 묶지 않음', () => {
  expect(groupInbound([x('A', ['C1'], '북항'), x('B', ['C1'], '신항'), x('C', []), x('D', [])])).toHaveLength(4)
})
