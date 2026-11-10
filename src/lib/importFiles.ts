import type { Kind, ParseResult } from '../domain/types'
import { parseWorkbook } from '../parsers/workbook'
import type { Repository } from '../storage/repository'
import { formatMD } from './dates'

export type ImportLine = { level: 'ok' | 'warn' | 'error'; text: string }

const KINDS: Kind[] = ['입고-북항', '입고-신항', '출고']
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** 파일마다: 해석 → 종류별로 하루치 통째 교체 → 결과 메시지. 한 파일의 실패가 다른 파일을 막지 않는다. */
export async function importFiles(files: { name: string; data: ArrayBuffer }[], repo: Repository, now: Date): Promise<ImportLine[]> {
  const lines: ImportLine[] = []
  for (const f of files) {
    const name = f.name.normalize('NFC').replace(/\.xlsx?$/i, '')

    let parsed: ParseResult
    try {
      parsed = parseWorkbook(new Uint8Array(f.data), f.name, now)
    } catch (e) {
      lines.push({ level: 'error', text: `❌ ${name}: 파일을 읽지 못했어요 (${errorText(e)})` })
      continue
    }

    const ok = parsed.sheets.filter((s) => s.status === 'ok')
    if (!ok.length && parsed.sheets.every((s) => s.message === '알 수 없는 양식')) {
      lines.push({ level: 'error', text: `❌ ${name}: 알 수 없는 양식` })
      continue
    }

    const okLines: ImportLine[] = []
    try {
      for (const kind of KINDS) {
        const sheets = ok.filter((s) => s.kind === kind)
        if (!sheets.length) continue
        const dates = [...new Set(sheets.map((s) => s.baseDate!))].sort()
        const set = new Set(dates)
        const inbound = kind === '출고' ? [] : parsed.inbound.filter((x) => kind.endsWith(x.port) && set.has(x.baseDate))
        const outbound = kind === '출고' ? parsed.outbound.filter((x) => set.has(x.baseDate)) : []
        await repo.replaceDays(kind, dates, inbound, outbound)

        const range = dates.length === 1 ? formatMD(dates[0]) : `${formatMD(dates[0])}~${formatMD(dates[dates.length - 1])}`
        const count = inbound.length + outbound.length
        okLines.push({ level: 'ok', text: `✅ ${name}: ${dates.length}일치(${range}) ${kind === '출고' ? '출고' : '입고'} ${count}건 반영` })
      }
    } catch (e) {
      lines.push({ level: 'error', text: `❌ ${name}: 저장하지 못했어요 (${errorText(e)})` })
      continue
    }
    lines.push(...okLines)

    for (const s of parsed.sheets) {
      if (s.status === 'ok' && s.kind === null) lines.push({ level: 'ok', text: `✅ ${name}: 배차 ${formatMD(s.baseDate!)} 차량 ${s.count}건 연결` })
      if (s.message && s.message !== '알 수 없는 양식')
        lines.push({ level: 'warn', text: `⚠️ ${name} ${s.sheetName} 시트: ${s.message}` })
    }
  }
  return lines
}
