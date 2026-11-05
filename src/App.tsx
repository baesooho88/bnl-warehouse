import { useCallback, useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import type { Inbound, Outbound } from './domain/types'
import { todayIso } from './lib/dates'
import { repo } from './repo'
import { DetailScreen, type Detail } from './screens/DetailScreen'
import { ListScreen } from './screens/ListScreen'

export default function App() {
  const [tab, setTab] = useState<Tab>('목록')
  const [date, setDate] = useState(() => todayIso(new Date()))
  const [detail, setDetail] = useState<Detail | null>(null)
  const [dataVersion] = useState(0)

  // 오늘 데이터가 없으면 가장 최근 날짜로
  const jumpToLatest = useCallback(async () => {
    const today = todayIso(new Date())
    const d = await repo.getRange(today, today)
    if (d.inbound.length || d.outbound.length) return setDate(today)
    setDate((await repo.latestDate()) ?? today)
  }, [])
  useEffect(() => { void jumpToLatest() }, [jumpToLatest])

  const openIn = useCallback((item: Inbound) => setDetail({ kind: 'in', item }), [])
  const openOut = useCallback((item: Outbound) => setDetail({ kind: 'out', item }), [])
  const closeDetail = useCallback(() => setDetail(null), [])

  return (
    <div className="app">
      {tab === '목록' && (
        <ListScreen date={date} onDateChange={setDate} onOpenIn={openIn} onOpenOut={openOut}
          onGoUpload={() => setTab('올리기')} dataVersion={dataVersion} />
      )}
      {tab !== '목록' && <p className="empty">{tab} 화면은 준비 중이에요</p>}
      {detail && <DetailScreen detail={detail} onBack={closeDetail} />}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
