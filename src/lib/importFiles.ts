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

/** 배차 파일: 파일의 가장 최근 출고 날짜에 저장된 출고를 불러와 배차만 다시 붙여 저장한다 */
async function applyDispatch(repo: Repository, name: string, parsed: ParseResult, sheet: { sheetName: string; lines: string[] }): Promise<ImportLine[]> {
  const date = parsed.outbound.map((o) => o.baseDate).sort().at(-1)
  try {
    const stored = date ? (await repo.getRange(date, date)).outbound : []
    if (!date || !stored.length) return [{ level: 'error', text: `❌ ${name}: 배차를 붙일 ${date ? formatMD(date) + ' ' : ''}출고가 없어요 — 출고표를 먼저 올려 주세요` }]
    const d: ParseResult = { ...parsed, outbound: stored, sheets: [] }
    attachDispatch(d, sheet.sheetName, sheet.lines)
    await repo.replaceDays('출고', [date], [], stored)
    const s = d.sheets[0]
    return [
      { level: 'ok', text: `✅ ${name}: 배차 ${formatMD(date)} 차량 ${s.count}건 연결(다른 탭은 무시)` },
      ...(s.message ? [{ level: 'warn' as const, text: `⚠️ ${name} ${s.sheetName} 시트: ${s.message}` }] : []),
    ]
  } catch (e) {
    return [{ level: 'error', text: `❌ ${name}: 저장하지 못했어요 (${errorText(e)})` }]
  }
}

/**
 * 파일마다: 해석 → 종류별로 하루치 통째 교체 → 결과 메시지. 한 파일의 실패가 다른 파일을 막지 않는다.
 * 배차 탭이 있는 파일은 배차만 읽어 이미 저장된 출고에 붙인다(다른 탭은 이전 편집본일 수 있어 무시).
 * 그래서 같이 고른 파일 중 배차 파일은 출고표 다음에 처리한다.
 */
export async function importFiles(
  files: { name: string; data: ArrayBuffer }[], repo: Repository, now: Date, updated: Updated[] = [],
  setFileName: (name: string) => void = () => {},
): Promise<ImportLine[]> {
  const lines: ImportLine[] = []
  const all = files.map((f) => {
    try {
      return { f, parsed: parseWorkbook(new Uint8Array(f.data), f.name, now) as ParseResult | null, error: null }
    } catch (e) {
      return { f, parsed: null, error: e }
    }
  }).sort((a, b) => Number(!!a.parsed?.dispatchLines) - Number(!!b.parsed?.dispatchLines))

  for (const { f, parsed, error } of all) {
    const name = f.name.normalize('NFC').replace(/\.xlsx?$/i, '')
    if (!parsed) {
      lines.push({ level: 'error', text: `❌ ${name}: 파일을 읽지 못했어요 (${errorText(error)})` })
      continue
    }
    setFileName(f.name) // 업로드 기록에 남길 파일명
    if (parsed.dispatchLines) {
      lines.push(...(await applyDispatch(repo, name, parsed, parsed.dispatchLines)))
      continue
    }

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
