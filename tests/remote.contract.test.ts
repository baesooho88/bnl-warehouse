import { describe, expect, test } from 'vitest'
import type { Inbound } from '../src/domain/types'
import { parseWorkbook } from '../src/parsers/workbook'
import { createFakeRemote } from './helpers/fakeRemote'
import { fixtureBytes } from './helpers/fixtures'

const now = new Date(2026, 10, 5)
const sinhang = parseWorkbook(fixtureBytes('sinhang'), 's', now)
const bukhang = parseWorkbook(fixtureBytes('bukhang'), 'b', now)
const on = (d: string) => sinhang.inbound.filter((x) => x.baseDate === d)

describe('Remote 계약 (가짜 원격)', () => {
  test('replaceDays는 업로드 기록을 남기고 새 id를 돌려준다', async () => {
    const r = createFakeRemote()
    const id = await r.replaceDays('입고-신항', ['2026-11-05'], on('2026-11-05'), [], 'sinhang.xlsx')
    expect(id).toBe(1)
    expect(await r.fetchLogsAfter(0)).toEqual([expect.objectContaining({ id: 1, kind: '입고-신항', baseDates: ['2026-11-05'] })])
    expect(await r.fetchLogsAfter(1)).toEqual([])
  })

  test('같은 날을 다시 교체해도 행 수는 그대로', async () => {
    const r = createFakeRemote()
    await r.replaceDays('입고-신항', ['2026-11-05'], on('2026-11-05'), [], 'a')
    await r.replaceDays('입고-신항', ['2026-11-05'], on('2026-11-05'), [], 'a')
    expect((await r.fetchAll()).inbound).toHaveLength(on('2026-11-05').length)
  })

  test('fetchAll은 1000행 넘는 데이터를 페이지로 끝까지 받는다', async () => {
    const r = createFakeRemote()
    const base = on('2026-11-05')[0]
    const many: Inbound[] = Array.from({ length: 2500 }, (_, i) => ({ ...base, id: `신항|2026-11-05|${i}` }))
    await r.replaceDays('입고-신항', ['2026-11-05'], many, [], 'big')
    const all = await r.fetchAll()
    expect(all.inbound).toHaveLength(2500)
    expect(all.maxLogId).toBe(1)
    expect(r.pagesServed).toBeGreaterThanOrEqual(3)
  })

  test('fetchDays는 종류(항구)와 날짜로 거른다', async () => {
    const r = createFakeRemote()
    await r.replaceDays('입고-신항', ['2026-11-05'], on('2026-11-05'), [], 's')
    await r.replaceDays('입고-북항', ['2026-11-05'], bukhang.inbound.filter((x) => x.baseDate === '2026-11-05'), [], 'b')
    const got = await r.fetchDays('입고-북항', ['2026-11-05'])
    expect(got.inbound.length).toBeGreaterThan(0)
    expect(got.inbound.every((x) => x.port === '북항')).toBe(true)
  })

  test('failNext로 다음 호출 하나를 실패시킬 수 있다', async () => {
    const r = createFakeRemote()
    r.failNext('fetchLogsAfter')
    await expect(r.fetchLogsAfter(0)).rejects.toThrow()
    await expect(r.fetchLogsAfter(0)).resolves.toEqual([])
  })

  test('onNewLog 구독은 replaceDays마다 호출되고 해제할 수 있다', async () => {
    const r = createFakeRemote()
    let n = 0
    const off = r.onNewLog(() => n++)
    await r.replaceDays('입고-신항', ['2026-11-05'], on('2026-11-05'), [], 's')
    off()
    await r.replaceDays('입고-신항', ['2026-11-05'], on('2026-11-05'), [], 's')
    expect(n).toBe(1)
  })
})
