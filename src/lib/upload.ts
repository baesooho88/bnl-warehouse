import type { Repository } from '../storage/repository'
import { importFiles, type ImportLine } from './importFiles'

export interface UploadSummary {
  date: string
  inbound: number
  outbound: number
  sameDay: number
}

/**
 * 관리자 업로드: 오프라인이면 막고, 파일마다 클라우드에 저장한 뒤 알림을 요청한다.
 * 알림 실패는 업로드 실패가 아니다.
 */
export async function uploadFiles(
  files: { name: string; data: ArrayBuffer }[],
  deps: { online: boolean; repo: Repository; now: Date; notify: (s: UploadSummary) => Promise<void>; setFileName: (name: string) => void },
): Promise<ImportLine[]> {
  if (!deps.online) return [{ level: 'error', text: '❌ 인터넷 연결이 필요해요' }]

  const lines: ImportLine[] = []
  for (const f of files) {
    deps.setFileName(f.name) // 업로드 기록에 남길 파일명
    lines.push(...(await importFiles([f], deps.repo, deps.now)))
  }

  if (lines.some((l) => l.level === 'ok')) {
    try {
      const date = await deps.repo.latestDate()
      if (date) {
        const d = await deps.repo.getRange(date, date)
        await deps.notify({ date, inbound: d.inbound.length, outbound: d.outbound.length, sameDay: d.outbound.filter((x) => x.sameDay).length })
      }
    } catch {
      lines.push({ level: 'warn', text: '⚠️ 알림을 보내지 못했어요' })
    }
  }
  return lines
}
