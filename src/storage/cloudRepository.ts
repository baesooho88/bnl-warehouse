import type { Remote } from './cloud/remote'
import type { LocalRepository } from './dexieRepository'
import type { Repository } from './repository'

/**
 * v2 앱 저장소: 읽기는 휴대폰 사본(로컬), 쓰기는 클라우드에 먼저.
 * 클라우드 저장이 성공해야 로컬에도 반영한다. 다른 기기는 동기화로 받는다.
 */
export function createCloudRepository(local: LocalRepository, remote: Remote, fileName: () => string): Repository {
  return {
    getRange: (from, to) => local.getRange(from, to),
    search: (q) => local.search(q),
    coverage: () => local.coverage(),
    latestDate: () => local.latestDate(),
    clearAll: () => local.clearAll(),
    async replaceDays(kind, baseDates, inbound, outbound) {
      await remote.replaceDays(kind, baseDates, inbound, outbound, fileName())
      await local.replaceDays(kind, baseDates, inbound, outbound)
    },
  }
}
