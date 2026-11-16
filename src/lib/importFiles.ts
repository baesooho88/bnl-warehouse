import type { Kind, Outbound, ParseResult } from '../domain/types'
import { attachDispatch, parseWorkbook } from '../parsers/workbook'
import type { Repository } from '../storage/repository'
import { formatMD } from './dates'

export type ImportLine = { level: 'ok' | 'warn' | 'error'; text: string }
/** 실제로 반영된 종류와 그 파일의 가장 최근 날짜(알림용) */
export type Updated = { type: '입고' | '출고' | '배차'; date: string }

const KINDS: Kind[] = ['입고-북항', '입고-신항', '출고']
/**
 * 배차는 파일의 가장 최근 날짜에만 붙는다. 같이 들어온 전날 시트가 저장된 배차를 지우지 않도록,
 * 배차 없이 들어온 날은 저장돼 있던 배차를 순번으로 이어 붙인다.
 */
async function keepDispatch(repo: Repository, dates: string[], outbound: Outbound[]) {
  const bare = dates.filter((d) => !outbound.some((o) => o.baseDate === d && o.dispatch))
  if (!bare.length) return
  const old = (await repo.getRange(bare[0], bare[bare.length - 1])).outbound.filter((o) => o.dispatch)
  for (const d of bare) {
    const bySeq = new Map(old.filter((o) => o.baseDate === d && o.seq !== null).map((o) => [o.seq, o.dispatch!]))
    if (!old.some((o) => o.baseDate === d)) continue
    for (const o of outbound) if (o.baseDate === d) o.dispatch = bySeq.get(o.seq) ?? { line: 0, arrive: null, vehicles: '', note: null, invar: false }
  }
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** 출고 파일의 가장 최근 날짜(배차가 붙는 날) */
const lastOutDate = (p: ParseResult) => p.outbound.map((o) => o.baseDate).sort().at(-1)

/**
 * 파일마다: 해석 → 종류별로 하루치 통째 교체 → 결과 메시지. 한 파일의 실패가 다른 파일을 막지 않는다.
 * 같이 고른 파일은 수정 시각 순으로 저장해 같은 날짜는 최신 파일이 이긴다. 최신 파일에 배차 탭이 없으면
 * 같은 날짜 배차 탭을 가진 다른 파일에서 빌려 붙인다(예: 새 출고표 + 배차 탭만 붙인 이전 편집본).
 */
export async function importFiles(
  files: { name: string; data: ArrayBuffer; modified?: number }[], repo: Repository, now: Date, updated: Updated[] = [],
  setFileName: (name: string) => void = () => {},
): Promise<ImportLine[]> {
  const lines: ImportLine[] = []
  const all = [...files].sort((a, b) => (a.modified ?? 0) - (b.modified ?? 0)).map((f) => {
    try {
      return { f, parsed: parseWorkbook(new Uint8Array(f.data), f.name, now) as ParseResult | null, error: null }
    } catch (e) {
      return { f, parsed: null, error: e }
    }
  })
  for (const [i, { parsed }] of all.entries()) {
    const date = parsed && lastOutDate(parsed)
    if (!parsed || parsed.dispatchLines || !date) continue
    // 같은 날짜 배차 탭: 이 파일보다 오래된 파일에서만 (더 최신 파일은 어차피 이 파일을 덮어쓴다)
    const lender = all.slice(0, i).map((x) => x.parsed).findLast((p) => p?.dispatchLines && lastOutDate(p) === date)
    if (!lender) continue
    attachDispatch(parsed, lender.dispatchLines!.sheetName, lender.dispatchLines!.lines)
    lender.sheets = lender.sheets.filter((s) => !(s.kind === null && s.baseDate === date)) // 덮어써질 파일의 배차 경고는 빼기
  }

  for (const { f, parsed, error } of all) {
    const name = f.name.normalize('NFC').replace(/\.xlsx?$/i, '')
    if (!parsed) {
      lines.push({ level: 'error', text: `❌ ${name}: 파일을 읽지 못했어요 (${errorText(error)})` })
      continue
    }
    setFileName(f.name) // 업로드 기록에 남길 파일명

    const ok = parsed.sheets.filter((s) => s.status === 'ok')
    if (!ok.length && parsed.sheets.every((s) => s.message === '알 수 없는 양식')) {
      lines.push({ level: 'error', text: `❌ ${name}: 알 수 없는 양식` })
      continue
    }

    const okLines: ImportLine[] = []
    const okUpdated: Updated[] = []
    try {
      for (const kind of KINDS) {
        const sheets = ok.filter((s) => s.kind === kind)
        if (!sheets.length) continue
        const dates = [...new Set(sheets.map((s) => s.baseDate!))].sort()
        const set = new Set(dates)
        const inbound = kind === '출고' ? [] : parsed.inbound.filter((x) => kind.endsWith(x.port) && set.has(x.baseDate))
        const outbound = kind === '출고' ? parsed.outbound.filter((x) => set.has(x.baseDate)) : []
        if (kind === '출고') await keepDispatch(repo, dates, outbound)
        await repo.replaceDays(kind, dates, inbound, outbound)
        okUpdated.push({ type: kind === '출고' ? '출고' : '입고', date: dates[dates.length - 1] })

        const range = dates.length === 1 ? formatMD(dates[0]) : `${formatMD(dates[0])}~${formatMD(dates[dates.length - 1])}`
        const count = inbound.length + outbound.length
        okLines.push({ level: 'ok', text: `✅ ${name}: ${dates.length}일치(${range}) ${kind === '출고' ? '출고' : '입고'} ${count}건 반영` })
      }
    } catch (e) {
      lines.push({ level: 'error', text: `❌ ${name}: 저장하지 못했어요 (${errorText(e)})` })
      continue
    }
    lines.push(...okLines)
    updated.push(...okUpdated)

    for (const s of parsed.sheets) {
      if (s.status === 'ok' && s.kind === null) {
        lines.push({ level: 'ok', text: `✅ ${name}: 배차 ${formatMD(s.baseDate!)} 차량 ${s.count}건 연결` })
        updated.push({ type: '배차', date: s.baseDate! })
      }
      if (s.message && s.message !== '알 수 없는 양식')
        lines.push({ level: 'warn', text: `⚠️ ${name} ${s.sheetName} 시트: ${s.message}` })
    }
  }
  return lines
}
