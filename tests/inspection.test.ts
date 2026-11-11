import { expect, test } from 'vitest'
import type { Outbound } from '../src/domain/types'
import { inspectionList } from '../src/inspection/inspections'

let n = 0
const o = (p: Partial<Outbound>): Outbound => ({
  id: `o${n++}`, baseDate: '2026-11-05', seq: null, center: null, bnlInDate: null, bl: null, hull: null, po: null, item: null,
  qtyText: null, qtyRequested: null, qtyTotal: null, weightKg: null, cbm: null, boxNo: null, destination: null, gateTime: null,
  memo: null, inspectedDate: null, requester: null, arriveDate: null, location: null, sameDay: false, raw: {}, ...p,
})
const wait = { raw: { 입고검수일자: '대기' } }

test('B/L마다 가장 최근 날짜 것만, 그게 대기일 때만 목록에. 완료한 B/L은 완료 쪽으로', () => {
  const list = inspectionList([
    o({ bl: 'A', baseDate: '2026-11-04', ...wait }),
    o({ bl: 'A', baseDate: '2026-11-05', ...wait }), // 같은 B/L 이틀 연속 → 하나
    o({ bl: 'B', baseDate: '2026-11-04', ...wait }),
    o({ bl: 'B', baseDate: '2026-11-05', inspectedDate: '2026-11-05' }), // 엑셀에서 검수일이 채워짐 → 빠짐
    o({ bl: 'C', baseDate: '2026-11-03', ...wait }),
    o({ bl: 'D' }), // 검사 대상 아님
    o({ bl: null, ...wait }), // B/L 없으면 체크할 수 없어 뺀다
  ], new Set(['C']))
  expect(list.pending.map((x) => [x.bl, x.baseDate])).toEqual([['A', '2026-11-05']])
  expect(list.done.map((x) => x.bl)).toEqual(['C'])
})
