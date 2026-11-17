import { parseRiWorkbook, type RiItem } from '../parsers/ri'
import { parseStockWorkbook, type StockItem } from '../parsers/stock'
import type { Repository } from '../storage/repository'
import { formatMD } from './dates'
import { importFiles, type ImportLine } from './importFiles'

/**
 * 관리자 업로드: 오프라인이면 막고, 파일마다 클라우드에 저장한다. 업로드 알림은 보내지 않는다(2026-11-16 사용자 요청).
 */
export async function uploadFiles(files: UploadFile[], deps: UploadDeps): Promise<ImportLine[]> {
  uploading.now = true
  try {
    return await run(files, deps)
  } finally {
    uploading.now = false
  }
}

/** 업로드 중에는 새 버전 적용(새로 고침)을 미룬다 — src/main.tsx */
export const uploading = { now: false }

type UploadFile = { name: string; data: ArrayBuffer }
type UploadDeps = {
  online: boolean; repo: Repository; now: Date; setFileName: (name: string) => void
  saveRi: (date: string, items: RiItem[]) => Promise<void>
  saveStock: (date: string, items: StockItem[]) => Promise<void>
}

async function run(files: UploadFile[], deps: UploadDeps): Promise<ImportLine[]> {
  if (!deps.online) return [{ level: 'error', text: '❌ 인터넷 연결이 필요해요' }]

  const lines: ImportLine[] = []
  const sheets: typeof files = [] // 입출고 파일은 모아서 한 번에(배차 파일을 출고표 다음에 처리하려고)
  for (const f of files) {
    const name = f.name.normalize('NFC').replace(/\.xlsx?$/i, '')
    let stock: ReturnType<typeof parseStockWorkbook> = null
    try { stock = parseStockWorkbook(new Uint8Array(f.data), f.name, deps.now) } catch { /* 못 읽는 파일은 아래 입출고 쪽에서 오류로 알린다 */ }
    if (stock) {
      if ('error' in stock) { lines.push({ level: 'error', text: `❌ ${name}: ${stock.error}` }); continue }
      try {
        await deps.saveStock(stock.date, stock.items)
        lines.push({ level: 'ok', text: `✅ ${name}: ${formatMD(stock.date)} 기준 재고 ${stock.items.length}건 반영` })
      } catch (e) {
        lines.push({ level: 'error', text: `❌ ${name}: 저장하지 못했어요 (${e instanceof Error ? e.message : String(e)})` })
      }
      continue
    }
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
    sheets.push(f)
  }
  if (sheets.length) lines.push(...(await importFiles(sheets, deps.repo, deps.now, [], deps.setFileName)))

  return lines
}
