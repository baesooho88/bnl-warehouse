import { expect, test } from 'vitest'
import { terminalLink } from '../src/lib/terminals'

test('엑셀의 부두 칸으로 조회 주소를 찾는다', () => {
  expect(terminalLink('HBCT')?.name).toBe('HBCT') // BCT보다 먼저
  expect(terminalLink('BPT-신선대')?.name).toBe('BPT')
  expect(terminalLink('HGCT-신감만')?.name).toBe('신감만')
  expect(terminalLink('hpnt')?.name).toBe('HPNT')
  expect(terminalLink('BCT')?.url).toContain('bct2-4')
  expect(terminalLink('PNIT')?.name).toBe('PNIT')
  expect(terminalLink('BNCT')?.name).toBe('BNCT')
  expect(terminalLink('모르는부두')).toBeNull()
  expect(terminalLink(null)).toBeNull()
})
