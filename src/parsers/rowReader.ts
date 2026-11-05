import type { CellValue } from '../domain/types'
import { toIsoDate, toNumber, toText } from './cells'
import { headerIndex } from './grid'

/**
 * 열 이름(정규화된 것, 별칭 여러 개 가능)으로 행 값을 읽는다.
 * 숫자·날짜 변환에 실패한 비어 있지 않은 원문은 raw[라벨]에 남긴다.
 */
export function rowReader(header: CellValue[], now: Date) {
  const idx = headerIndex(header)
  const col = (keys: string[]) => keys.map((k) => idx.get(k)).find((i) => i !== undefined)

  return (row: CellValue[]) => {
    const raw: Record<string, string> = {}
    const cell = (keys: string[]) => {
      const i = col(keys)
      return i === undefined ? null : (row[i] ?? null)
    }
    const keep = <T>(label: string, v: CellValue, parsed: T | null) => {
      const t = toText(v)
      if (parsed === null && t !== null) raw[label] = t
      return parsed
    }
    return {
      raw,
      text: (keys: string[]) => toText(cell(keys)),
      num: (label: string, keys: string[]) => {
        const v = cell(keys)
        return keep(label, v, toNumber(v))
      },
      date: (label: string, keys: string[], notAfter?: string) => {
        const v = cell(keys)
        return keep(label, v, toIsoDate(v, now, notAfter))
      },
      cell,
    }
  }
}
