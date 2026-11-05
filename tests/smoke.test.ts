import fs from 'node:fs'
import * as XLSX from 'xlsx'
import { expect, test } from 'vitest'

test.each(['bukhang', 'sinhang', 'outbound'])('픽스처 %s 는 11.2~11.5 시트를 가진다', (name) => {
  const wb = XLSX.read(fs.readFileSync(`tests/fixtures/${name}.xlsx`))
  expect(wb.SheetNames).toEqual(['11.2', '11.3', '11.4', '11.5'])
})
