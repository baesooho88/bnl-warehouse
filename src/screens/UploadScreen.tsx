import { useEffect, useState } from 'react'
import { formatMD } from '../lib/dates'
import type { ImportLine } from '../lib/importFiles'
import { uploadFiles } from '../lib/upload'
import { repo, setCurrentFileName } from '../repo'
import { supabase } from '../storage/cloud/supabase'
import { AdminPanel } from './AdminPanel'
import type { Coverage } from '../storage/repository'
import type { Kind } from '../domain/types'

const LABEL: Record<Kind, string> = { '입고-북항': '북항', '입고-신항': '신항', 출고: '출고' }

export function UploadScreen({ onDataChanged, dataVersion }: { onDataChanged: () => void; dataVersion: number }) {
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<ImportLine[]>([])
  const [coverage, setCoverage] = useState<Record<Kind, Coverage | null> | null>(null)

  useEffect(() => { repo.coverage().then(setCoverage) }, [dataVersion])

  async function onFiles(picked: File[]) {
    if (!picked.length) return
    setBusy(true)
    setLines([])
    try {
      // 저장 공간이 부족해도 Chrome이 데이터를 지우지 않도록 요청 (거절돼도 계속 진행)
      await navigator.storage?.persist?.().catch(() => false)
      const files = await Promise.all(picked.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() })))
      setLines(await uploadFiles(files, {
        online: navigator.onLine,
        repo,
        now: new Date(),
        setFileName: setCurrentFileName,
        notify: async (summary) => {
          const { error } = await supabase.functions.invoke('notify', { body: summary })
          if (error) throw error
        },
      }))
      onDataChanged()
    } catch (e) {
      setLines([{ level: 'error', text: `❌ 처리하지 못했어요 (${e instanceof Error ? e.message : String(e)})` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="screen-title">엑셀 올리기</h1>
      <p className="hint">북항·신항 보세운송현황과 한화오션 출하요청서 최신 파일을 한 번에 골라 주세요. 같은 날짜는 새 파일 내용으로 바뀌고, 직원 앱에 바로 반영돼요.</p>
      <label className={`btn primary file-btn${busy ? ' disabled' : ''}`}>
        {busy ? '처리 중…' : '파일 선택'}
        <input type="file" multiple disabled={busy}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            // 같은 파일을 다시 고를 수 있게 칸을 비우기 전에 목록을 복사해 둔다
            const picked = [...(e.target.files ?? [])]
            e.target.value = ''
            void onFiles(picked)
          }} />
      </label>
      {lines.length > 0 && (
        <ul className="results" aria-live="polite">
          {lines.map((l, i) => <li key={i} className={l.level}>{l.text}</li>)}
        </ul>
      )}
      <h2 className="section-title">저장 현황</h2>
      <dl className="fields">
        {(Object.keys(LABEL) as Kind[]).map((k) => {
          const c = coverage?.[k]
          return (
            <div key={k}>
              <dt>{LABEL[k]}</dt>
              <dd>{c ? `${formatMD(c.from)}~${formatMD(c.to)} (${c.days}일)` : '없음'}</dd>
            </div>
          )
        })}
      </dl>
      <AdminPanel />
    </>
  )
}
