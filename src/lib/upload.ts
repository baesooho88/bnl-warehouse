import { parseRiWorkbook, type RiItem } from '../parsers/ri'
import type { Repository } from '../storage/repository'
import { addDays, formatMD } from './dates'
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
  deps: {
    online: boolean; repo: Repository; now: Date; notify: (s: UploadSummary) => Promise<void>; setFileName: (name: string) => void
    saveRi: (date: string, items: RiItem[]) => Promise<void>
  },
): Promise<ImportLine[]> {
  if (!deps.online) return [{ level: 'error', text: '❌ 인터넷 연결이 필요해요' }]

  const lines: ImportLine[] = []
  let inOut = false // 입출고 알림은 입출고 파일이 반영됐을 때만
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
    const got = await importFiles([f], deps.repo, deps.now)
    inOut ||= got.some((l) => l.level === 'ok')
    lines.push(...got)
  }

  if (inOut) {
    try {
      // 입고 파일엔 다음 날 시트가 미리 들어 있곤 해서, 가장 최근 날짜를 그대로 쓰면 출고가 0으로 나간다 → 출고가 있는 가장 최근 날짜
      const latest = await deps.repo.latestDate()
      const week = latest ? (await deps.repo.getRange(addDays(latest, -7), latest)).outbound : []
      const date = week.map((x) => x.baseDate).sort().at(-1) ?? latest
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
