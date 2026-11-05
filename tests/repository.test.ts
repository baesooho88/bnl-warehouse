import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import type { ParseResult } from '../src/domain/types'
import { parseWorkbook } from '../src/parsers/workbook'
import { createDexieRepository } from '../src/storage/dexieRepository'
import type { Repository } from '../src/storage/repository'
import { fixtureBytes } from './helpers/fixtures'

const now = new Date(2026, 10, 5)
const sinhang = parseWorkbook(fixtureBytes('sinhang'), 's', now)
const bukhang = parseWorkbook(fixtureBytes('bukhang'), 'b', now)
const outbound = parseWorkbook(fixtureBytes('outbound'), 'o', now)
const days = (r: ParseResult) => r.sheets.filter((s) => s.status === 'ok').map((s) => s.baseDate!)
const day = (repo: Repository, d: string) => repo.getRange(d, d)

let repo: Repository
let n = 0
beforeEach(async () => {
  repo = createDexieRepository(`test-${n++}`)
  await repo.replaceDays('입고-신항', days(sinhang), sinhang.inbound, [])
  await repo.replaceDays('입고-북항', days(bukhang), bukhang.inbound, [])
  await repo.replaceDays('출고', days(outbound), [], outbound.outbound)
})

describe('replaceDays', () => {
  test('저장 후 하루치 조회', async () => {
    const r = await day(repo, '2026-11-05')
    expect(r.inbound.filter((x) => x.port === '신항')).toHaveLength(1)
    expect(r.outbound).toHaveLength(outbound.outbound.filter((o) => o.baseDate === '2026-11-05').length)
  })

  test('같은 파일을 두 번 올려도 중복되지 않는다', async () => {
    await repo.replaceDays('입고-신항', days(sinhang), sinhang.inbound, [])
    const all = await repo.getRange('2026-11-01', '2026-11-30')
    expect(all.inbound.filter((x) => x.port === '신항')).toHaveLength(sinhang.inbound.length)
  })

  test('지정한 종류·날짜만 교체한다', async () => {
    await repo.replaceDays('입고-신항', ['2026-11-05'], [], [])
    const d5 = await day(repo, '2026-11-05')
    const d4 = await day(repo, '2026-11-04')
    expect(d5.inbound.filter((x) => x.port === '신항')).toHaveLength(0)
    expect(d5.inbound.filter((x) => x.port === '북항')).toHaveLength(bukhang.inbound.filter((x) => x.baseDate === '2026-11-05').length)
    expect(d4.inbound.filter((x) => x.port === '신항')).toHaveLength(1)
    expect(d5.outbound.length).toBeGreaterThan(0)
  })

  test('저장 중 실패하면 기존 데이터가 그대로 남는다', async () => {
    const one = sinhang.inbound.find((x) => x.baseDate === '2026-11-05')!
    await expect(repo.replaceDays('입고-신항', ['2026-11-05'], [one, { ...one }], [])).rejects.toThrow()
    const d5 = await day(repo, '2026-11-05')
    expect(d5.inbound.filter((x) => x.port === '신항').map((x) => x.bl)).toEqual(['PLISH7H51981'])
  })

  test('최신 날짜가 먼저 온다', async () => {
    const all = await repo.getRange('2026-11-01', '2026-11-30')
    const dates = all.outbound.map((o) => o.baseDate)
    expect(dates).toEqual([...dates].sort().reverse())
  })
})

describe('search', () => {
  test('컨테이너 번호·호선, 대소문자·공백 무시', async () => {
    expect((await repo.search('hmmu2248146')).inbound.map((x) => x.item)).toContain('ANCHOR CHAIN')
    expect((await repo.search(' 2607 ')).inbound.map((x) => x.item)).toContain('ANCHOR CHAIN')
  })
  test('출고 도착지', async () => {
    expect((await repo.search('한국야나세')).outbound.length).toBeGreaterThan(0)
  })
  test('빈 검색어는 빈 결과', async () => {
    expect(await repo.search('   ')).toEqual({ inbound: [], outbound: [] })
  })
})

describe('coverage / latestDate / clearAll', () => {
  test('종류별 날짜 범위', async () => {
    const c = await repo.coverage()
    expect(c['입고-신항']).toEqual({ from: '2026-11-02', to: '2026-11-05', days: 4 })
    expect(c['출고']).toEqual({ from: '2026-11-02', to: '2026-11-05', days: 4 })
  })
  test('데이터 없는 종류는 null, 전체 삭제', async () => {
    expect(await repo.latestDate()).toBe('2026-11-05')
    await repo.clearAll()
    expect(await repo.latestDate()).toBeNull()
    expect((await repo.coverage())['입고-북항']).toBeNull()
  })
})
