import { useEffect, useMemo, useState } from 'react'
import { formatMD } from '../lib/dates'
import type { StockItem } from '../parsers/stock'
import { supabase } from '../storage/cloud/supabase'
import { fetchStock, searchStock } from '../stock/stock'

const SHOW = 100 // 한두 글자 검색에 천 장 넘는 카드를 그리지 않게

/** 검색: 관리자가 올린 최신 재고 파일만 검색한다(입출고 내역은 날짜 화면에서). */
export function SearchScreen() {
  const [query, setQuery] = useState('')
  const [stock, setStock] = useState<{ date: string | null; items: StockItem[] } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetchStock(supabase).then((s) => alive && setStock(s)).catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [])

  const hits = useMemo(() => (stock ? searchStock(stock.items, query) : []), [stock, query])
  const kg = (n: number | null) => (n === null ? null : `${n.toLocaleString()}kg`)

  return (
    <>
      <h1 className="screen-title">재고 검색</h1>
      <input className="search" type="search" placeholder="B/L · 품명 · PO · Project · Location · BOX"
        aria-label="검색어" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      {failed && <p className="empty">재고를 불러오지 못했어요. 인터넷을 확인해 주세요</p>}
      {!failed && !stock && <p className="hint">재고 불러오는 중…</p>}
      {stock && !stock.date && <p className="empty">아직 올라온 재고 파일이 없어요</p>}
      {stock?.date && (
        <p className="hint">
          {formatMD(stock.date)} 기준 재고 {stock.items.length}건
          {query.trim() && ` · 검색 결과 ${hits.length}건${hits.length > SHOW ? ` (앞 ${SHOW}건만 표시)` : ''}`}
        </p>
      )}
      {stock?.date && query.trim() && hits.length === 0 && <p className="empty">검색 결과가 없어요</p>}
      {hits.slice(0, SHOW).map((x) => (
        <div key={x.idx} className="card">
          <div className="top"><b className="bl">{x.bl}</b>{x.location && <span className="badge in">{x.location}</span>}</div>
          <div className="item">{x.item ?? '(품명 없음)'}</div>
          <div className="meta">{[x.box && `BOX ${x.box}`, x.qty !== null && `${x.qty}개`, kg(x.weightKg), x.cbm !== null && `${x.cbm}㎥`].filter(Boolean).join(' · ')}</div>
          <div className="meta">{[x.inDate && `입고 ${formatMD(x.inDate)}`, x.po && `PO ${x.po}`, x.project && `Project ${x.project}`].filter(Boolean).join(' · ')}</div>
          {x.note && <div className="note-box"><b>비고</b> {x.note}</div>}
        </div>
      ))}
    </>
  )
}
