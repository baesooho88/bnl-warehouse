import { describe, expect, test } from 'vitest'
import type { CellValue } from '../src/domain/types'
import { sheetToGrid } from '../src/parsers/grid'
import { parseInboundSheet } from '../src/parsers/inbound'
import { readFixture } from './helpers/fixtures'

const now = new Date(2026, 10, 5)
const sheet = (file: 'bukhang' | 'sinhang', name: string) => sheetToGrid(readFixture(file).Sheets[name])

const HEADER: CellValue[] = ['입항일', '선    명', 'B/L NO.  ', '품   명', '수량', '중량  ', '용적', '호 선', 'P.O NO.', '부두 \n및 창고', '구분', "CONT'R NO.", '도착지', '비   고']
const grid = (...rows: CellValue[][]): CellValue[][] => [['일일보세운송현황 (신항)'], ['2026.11.5(목)'], HEADER, ...rows]
const row = (o: { bl?: string | null; item?: string | null; weight?: CellValue; type?: string | null; cont?: string | null; note?: string | null }): CellValue[] =>
  ['10월 1일', 'SHIP', o.bl ?? null, o.item ?? null, 1, o.weight ?? 100, 1.5, '2607', '400', 'HPNT', o.type ?? null, o.cont ?? null, 'BNL', o.note ?? null]

describe('parseInboundSheet — 샘플', () => {
  test('신항 11.5: B/L 1건에 컨테이너 14개', () => {
    const list = parseInboundSheet(sheet('sinhang', '11.5'), '신항', '2026-11-05', now)
    expect(list).toHaveLength(1)
    const it = list[0]
    expect(it).toMatchObject({
      id: '신항|2026-11-05|0', port: '신항', baseDate: '2026-11-05', bl: 'PLISH7H51981', item: 'ANCHOR CHAIN',
      qty: 38, weightKg: 231667, hull: '2607', arrivalDate: '2026-10-25', note: '월요일 까지 컨반납',
    })
    expect(it.containers).toHaveLength(14)
    expect(it.containers[0]).toEqual({ no: 'HMMU2248146', type: '20DC X 14' })
  })

  test('북항 11.2 첫 건', () => {
    const it = parseInboundSheet(sheet('bukhang', '11.2'), '북항', '2026-11-02', now)[0]
    expect(it).toMatchObject({ bl: 'PLISH7H54985', vessel: 'EASLINE KWANGYANG', arrivalDate: '2026-10-31', terminal: 'HBCT', po: '4003579720' })
    expect(it.containers).toEqual([{ no: 'EAXU6114460', type: '40HC X 1' }])
  })

  test('신항 11.2: 선(기)명 매핑, 2건, 첫 건 컨테이너 8개', () => {
    const list = parseInboundSheet(sheet('sinhang', '11.2'), '신항', '2026-11-02', now)
    expect(list).toHaveLength(2)
    expect(list[0].vessel).toBe('ONE TRIUMPH')
    expect(list[0].containers).toHaveLength(8)
  })

  test('신항 11.3: 미병합 컨테이너 행과 컨테이너 행의 비고', () => {
    const list = parseInboundSheet(sheet('sinhang', '11.3'), '신항', '2026-11-03', now)
    expect(list.map((x) => x.bl)).toEqual(['PLISH7H53641', 'PLISH7H53647', 'HLCUDX3260805976'])
    expect(list[1].containers.map((c) => c.no)).toEqual(['HMMU7604614', 'HMMU7605903'])
    expect(list[2].containers.map((c) => c.type)).toEqual(['40HC X 1', '20FR X 1', '40FR X 1'])
    expect(list[2].note).toContain('OOG 확인필요')
  })
})

describe('parseInboundSheet — 규칙', () => {
  test('컨테이너만 있는 행은 직전 건에 붙고, 숫자 변환 실패는 원문 보존', () => {
    const list = parseInboundSheet(
      grid(row({ bl: 'BL1', item: 'ITEM', weight: '-', type: '20DC', cont: 'C1' }), [null, null, null, null, null, null, null, null, null, null, null, 'C2', null, null]),
      '신항', '2026-11-05', now,
    )
    expect(list).toHaveLength(1)
    expect(list[0].containers.map((c) => c.no)).toEqual(['C1', 'C2'])
    expect(list[0].weightKg).toBeNull()
    expect(list[0].raw['중량']).toBe('-')
  })

  test('같은 B/L이라도 품명이 다르면 별도 건', () => {
    const list = parseInboundSheet(grid(row({ bl: 'BL9', item: 'PUMP', cont: 'C1' }), row({ bl: 'BL9', item: 'VALVE', cont: 'C2' })), '신항', '2026-11-05', now)
    expect(list.map((x) => x.item)).toEqual(['PUMP', 'VALVE'])
  })

  test('빈 행은 건너뛴다', () => {
    const list = parseInboundSheet(grid(row({ bl: 'BL1', item: 'A' }), Array(14).fill(null)), '신항', '2026-11-05', now)
    expect(list).toHaveLength(1)
    expect(list[0].containers).toEqual([])
  })
})
