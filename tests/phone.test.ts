import { expect, test } from 'vitest'
import { splitPhones } from '../src/lib/phone'

test('전화번호를 분리하고 숫자만 tel로', () => {
  expect(splitPhones('홍길동 010 1234 5678 연락')).toEqual([
    { text: '홍길동 ' }, { text: '010 1234 5678', tel: '01012345678' }, { text: ' 연락' },
  ])
  expect(splitPhones('담당자 010-0000-0000')).toEqual([{ text: '담당자 ' }, { text: '010-0000-0000', tel: '01000000000' }])
})

test('전화번호가 없으면 그대로', () => {
  expect(splitPhones('13시')).toEqual([{ text: '13시' }])
})
