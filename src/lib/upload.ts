import { parseRiWorkbook, type RiItem } from '../parsers/ri'
import type { Repository } from '../storage/repository'
import { formatMD } from './dates'
import { importFiles, type ImportLine, type Updated } from './importFiles'

/** 알림: 이번 업로드로 바뀐 종류마다 그 날짜와 그날 건수 */
export interface UploadSummary {
  kind: 'upload'
  updates: { type: Updated['type']; date: string; count: number; sameDay?: number }[]
}

/**
 * 관리자 업로드: 오프라인이면 막고, 파일마다 클라우드에 저장한 뒤 알림을 요청한다.
 * 알림 실패는 업로드 실패가 아니다.
 */
export async function uploadFiles(
  files: { name: string; data: ArrayBuffer }[],
  deps: {
    online: boolean; repo: Repository; now: Date; notify: (s: UploadSummary) => Promise<void>; setFileName: (name: string) => void
    saveRi: (date: string, items: RiItem[]) => Promise<void>
  },
): Promise<ImportLine[]> {
  if (!deps.online) return [{ level: 'error', text: '❌ 인터넷 연결이 필요해요' }]

  const lines: ImportLine[] = []
  const updated: Updated[] = [] // 알림은 입출고·배차가 반영됐을 때만
  for (const f of files) {
    const name = f.name.normalize('NFC').replace(/\.xlsx?$/i, '')
    let ri: ReturnType<typeof parseRiWorkbook> = null
    try { ri = parseRiWorkbook(new Uint8Array(f.data), f.name) } catch { /* 못 읽는 파일은 아래 입출고 쪽에서 오류로 알린다 */ }
    if (ri) {
      if ('error' in ri) { lines.push({ level: 'error', text: `❌ ${name}: ${ri.error}` }); continue }
      try {
        await deps.saveRi(ri.date, ri.items)
        lines.push({ level: 'ok', text: `✅ ${name}: ${formatMD(ri.date)} RI 작업표 ${ri.items.length}건 반영` })
      } catch (e) {
        lines.push({ level: 'error', text: `❌ ${name}: 저장하지 못했어요 (${e instanceof Error ? e.message : String(e)})` })
      }
      continue
    }
    deps.setFileName(f.name) // 업로드 기록에 남길 파일명
    lines.push(...(await importFiles([f], deps.repo, deps.now, updated)))
  }

  if (updated.length) {
    try {
      // 종류마다 가장 최근 날짜 하나(입고 파일의 다음 날 시트가 출고 날짜를 끌고 가지 않게 종류별로 따로)
      const latest = new Map<Updated['type'], string>()
      for (const u of updated) if (u.date > (latest.get(u.type) ?? '')) latest.set(u.type, u.date)
      const updates: UploadSummary['updates'] = []
      for (const type of ['입고', '출고', '배차'] as const) {
        const date = latest.get(type)
        if (!date) continue
        const d = await deps.repo.getRange(date, date)
        if (type === '입고') updates.push({ type, date, count: d.inbound.length })
        if (type === '출고') updates.push({ type, date, count: d.outbound.length, sameDay: d.outbound.filter((x) => x.sameDay).length })
        if (type === '배차') updates.push({ type, date, count: d.outbound.filter((x) => x.dispatch?.vehicles).length })
      }
      await deps.notify({ kind: 'upload', updates })
    } catch {
      lines.push({ level: 'warn', text: '⚠️ 알림을 보내지 못했어요' })
    }
  }
  return lines
}
