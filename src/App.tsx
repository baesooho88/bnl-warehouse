import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { logout, roleOf, watchAuth, type Role } from './auth/auth'
import { PushCard } from './components/PushCard'
import { StatusBar } from './components/StatusBar'
import { TabBar, type Tab } from './components/TabBar'
import type { Inbound, Outbound } from './domain/types'
import { todayIso } from './lib/dates'
import { isPushSubscribed, pushSupported, subscribePush, unsubscribePush } from './push/push'
import { local, remote, repo, sync } from './repo'
import { DetailScreen, type Detail } from './screens/DetailScreen'
import { ListScreen } from './screens/ListScreen'
import { LoginScreen } from './screens/LoginScreen'
import { SearchScreen } from './screens/SearchScreen'
import { StatsScreen } from './screens/StatsScreen'
import { UploadScreen } from './screens/UploadScreen'
import { cloudConfigured, supabase } from './storage/cloud/supabase'
import type { SyncStatus } from './sync/sync'

const VAPID_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''
const dateParam = () => {
  const d = new URLSearchParams(location.search).get('date')
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined) // undefined = 확인 중
  const role: Role = roleOf(session ?? null)
  const [tab, setTab] = useState<Tab>('목록')
  const [date, setDate] = useState(() => dateParam() ?? todayIso(new Date()))
  const [detail, setDetail] = useState<Detail | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [status, setStatus] = useState<SyncStatus>(sync.status())
  const [pushOn, setPushOn] = useState<boolean | null>(null)
  const [permission, setPermission] = useState(() => (pushSupported() ? Notification.permission : 'denied'))
  const fixedDate = useRef(dateParam() !== null) // 알림으로 열었으면 그 날짜를 유지

  // 오늘 데이터가 없으면 가장 최근 날짜로
  const jumpToLatest = useCallback(async () => {
    if (fixedDate.current) return
    const today = todayIso(new Date())
    const d = await repo.getRange(today, today)
    if (d.inbound.length || d.outbound.length) return setDate(today)
    setDate((await repo.latestDate()) ?? today)
  }, [])

  // 로그아웃·세션 무효화: 이 폰의 알림 구독과 입출고 사본을 지운다
  const cleanup = useCallback(async () => {
    await unsubscribePush(supabase)
    await local.clearAll()
    setDetail(null)
    setTab('목록')
    setDataVersion((v) => v + 1)
  }, [])

  // 로그인 상태
  useEffect(() => {
    if (!cloudConfigured) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const off = watchAuth(supabase, cleanup, () => {})
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => { off(); data.subscription.unsubscribe() }
  }, [cleanup])

  // 로그인되어 있는 동안: 동기화 시점(시작·화면 복귀·재연결·새 업로드 기록)
  useEffect(() => {
    if (!role) return
    const offStatus = sync.onChange((s) => {
      setStatus(s)
      if (s.state === 'idle') {
        setDataVersion((v) => v + 1)
        void jumpToLatest()
      }
    })
    const run = () => { void sync.syncOnce() }
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    run()
    const offLog = remote.onNewLog(run)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', run)
    void isPushSubscribed().then(setPushOn)
    return () => {
      offStatus()
      offLog()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', run)
    }
  }, [role, jumpToLatest])

  // 알림을 눌러 이미 열린 앱으로 돌아온 경우
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'open-date' && /^\d{4}-\d{2}-\d{2}$/.test(e.data.date)) {
        fixedDate.current = true
        setDetail(null)
        setTab('목록')
        setDate(e.data.date)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  const openIn = useCallback((item: Inbound) => setDetail({ kind: 'in', item }), [])
  const openOut = useCallback((item: Outbound) => setDetail({ kind: 'out', item }), [])
  const closeDetail = useCallback(() => setDetail(null), [])
  const changeDate = useCallback((d: string) => { fixedDate.current = false; setDate(d) }, [])
  const dataChanged = useCallback(() => {
    setDataVersion((v) => v + 1)
    void jumpToLatest()
  }, [jumpToLatest])

  async function enablePush() {
    const r = await subscribePush(supabase, VAPID_KEY).catch(() => 'unsupported' as const)
    setPermission(pushSupported() ? Notification.permission : 'denied')
    setPushOn(r === 'subscribed')
  }
  async function togglePush() {
    if (pushOn) {
      await unsubscribePush(supabase)
      setPushOn(false)
    } else await enablePush()
  }

  if (!cloudConfigured) return <main className="empty">앱 설정(Supabase 주소·키)이 없어요. 관리자에게 알려 주세요.</main>
  if (session === undefined) return <main className="empty">불러오는 중…</main>
  if (!session || !role) return <LoginScreen />

  const tabs: Tab[] = role === 'admin' ? ['목록', '검색', '통계', '올리기'] : ['목록', '검색', '통계']
  const current = tabs.includes(tab) ? tab : '목록'

  return (
    <div className="app">
      <StatusBar status={status} onRetry={() => void sync.syncOnce()} pushOn={pushSupported() ? pushOn : null}
        onTogglePush={() => void togglePush()} onLogout={() => void logout(supabase, cleanup)}
        roleLabel={role === 'admin' ? '관리자로 로그인됨' : '직원으로 로그인됨'} />
      {current === '목록' && permission === 'default' && pushOn === false && VAPID_KEY && <PushCard onEnable={() => void enablePush()} />}
      {current === '목록' && (
        <ListScreen date={date} onDateChange={changeDate} onOpenIn={openIn} onOpenOut={openOut}
          onGoUpload={() => setTab(role === 'admin' ? '올리기' : '목록')} canUpload={role === 'admin'} dataVersion={dataVersion} />
      )}
      {current === '검색' && <SearchScreen onOpenIn={openIn} onOpenOut={openOut} dataVersion={dataVersion} />}
      {current === '통계' && <StatsScreen dataVersion={dataVersion} />}
      {current === '올리기' && role === 'admin' && <UploadScreen onDataChanged={dataChanged} dataVersion={dataVersion} />}
      {detail && <DetailScreen detail={detail} onBack={closeDetail} />}
      <TabBar tabs={tabs} tab={current} onChange={setTab} />
    </div>
  )
}
