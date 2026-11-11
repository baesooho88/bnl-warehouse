import { expect, test } from 'vitest'
import { containerTypes } from '../src/components/InboundCard'

test('구분 칸 중복은 걷고 X를 ×로', () => {
  const c = (type: string | null) => ({ no: 'C', type })
  expect(containerTypes([c('20DC X 14'), c('20DC X 14'), c(null)])).toBe('20DC×14')
  expect(containerTypes([c('40HC X 1'), c('20FR X 1')])).toBe('40HC×1 · 20FR×1')
  expect(containerTypes([])).toBe('')
})
