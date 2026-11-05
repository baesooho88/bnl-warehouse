import { useCallback, useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import type { Inbound, Outbound } from './domain/types'
import { todayIso } from './lib/dates'
import { repo } from './repo'
import { DetailScreen, type Detail } from './screens/DetailScreen'
import { ListScreen } from './screens/ListScreen'
import { SearchScreen } from './screens/SearchScreen'
import { StatsScreen } from './screens/StatsScreen'
import { UploadScreen } from './screens/UploadScreen'

export default function App() {
  const [tab, setTab] = useState<Tab>('목록')
  const [date, setDate] = useState(() => todayIso(new Date()))
  const [detail, setDetail] = useState<Detail | null>(null)
  const [dataVersion, setDataVersion] = useState(0)

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
  // 업로드·삭제 후 목록이 최신 날짜를 다시 읽도록
  const dataChanged = useCallback(() => {
    setDataVersion((v) => v + 1)
    void jumpToLatest()
  }, [jumpToLatest])

  return (
    <div className="app">
      {tab === '목록' && (
        <ListScreen date={date} onDateChange={setDate} onOpenIn={openIn} onOpenOut={openOut}
          onGoUpload={() => setTab('올리기')} dataVersion={dataVersion} />
      )}
      {tab === '검색' && <SearchScreen onOpenIn={openIn} onOpenOut={openOut} dataVersion={dataVersion} />}
      {tab === '통계' && <StatsScreen dataVersion={dataVersion} />}
      {tab === '올리기' && <UploadScreen onDataChanged={dataChanged} dataVersion={dataVersion} />}
      {detail && <DetailScreen detail={detail} onBack={closeDetail} />}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
