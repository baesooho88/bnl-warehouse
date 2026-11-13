import type { Inbound, Kind, Outbound } from '../domain/types'

export interface DayData {
  inbound: Inbound[]
  outbound: Outbound[]
}

export interface Coverage {
  from: string
  to: string
  days: number
}

/** 화면은 이 인터페이스만 안다. v1은 IndexedDB, v2에서 클라우드 구현으로 교체한다. */
export interface Repository {
  /** 같은 종류 + 같은 기준일 데이터를 통째로 교체한다(하나의 트랜잭션). */
  replaceDays(kind: Kind, baseDates: string[], inbound: Inbound[], outbound: Outbound[]): Promise<void>
  /** from~to(포함) 기간. 결과는 baseDate 내림차순, 같은 날은 id 순. */
  getRange(from: string, to: string): Promise<DayData>
  coverage(): Promise<Record<Kind, Coverage | null>>
  latestDate(): Promise<string | null>
  clearAll(): Promise<void>
}
