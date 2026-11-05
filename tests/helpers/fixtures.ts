import fs from 'node:fs'
import * as XLSX from 'xlsx'

export const readFixture = (name: 'bukhang' | 'sinhang' | 'outbound') =>
  XLSX.read(fs.readFileSync(`tests/fixtures/${name}.xlsx`))

export const fixtureBytes = (name: 'bukhang' | 'sinhang' | 'outbound') =>
  new Uint8Array(fs.readFileSync(`tests/fixtures/${name}.xlsx`))
