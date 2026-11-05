import 'fake-indexeddb/auto'
import { expect, test } from 'vitest'
import { parseWorkbook } from '../src/parsers/workbook'
import { createCloudRepository } from '../src/storage/cloudRepository'
import { createDexieRepository } from '../src/storage/dexieRepository'
import { createFakeRemote } from './helpers/fakeRemote'
import { fixtureBytes } from './helpers/fixtures'

const s = parseWorkbook(fixtureBytes('sinhang'), 's', new Date(2026, 10, 5))
const d5 = s.inbound.filter((x) => x.baseDate === '2026-11-05')
let n = 0

test('replaceDays는 원격에 먼저 쓰고 성공하면 로컬에도 반영한다', async () => {
  const remote = createFakeRemote()
  const local = createDexieRepository(`cloud-${n++}`)
  const repo = createCloudRepository(local, remote, () => '신항.xlsx')
  await repo.replaceDays('입고-신항', ['2026-11-05'], d5, [])
  expect((await remote.fetchAll()).inbound).toHaveLength(d5.length)
  expect((await repo.getRange('2026-11-05', '2026-11-05')).inbound).toHaveLength(d5.length)
})

test('원격 실패면 예외, 로컬은 그대로', async () => {
  const remote = createFakeRemote()
  const local = createDexieRepository(`cloud-${n++}`)
  await local.replaceDays('입고-신항', ['2026-11-05'], d5, [])
  const repo = createCloudRepository(local, remote, () => 'x')
  remote.failNext('replaceDays')
  await expect(repo.replaceDays('입고-신항', ['2026-11-05'], [], [])).rejects.toThrow()
  expect((await repo.getRange('2026-11-05', '2026-11-05')).inbound).toHaveLength(d5.length)
})
