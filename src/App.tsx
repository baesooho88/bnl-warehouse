import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { logout, roleOf, watchAuth, type Role } from './auth/auth'
import { PushCard } from './components/PushCard'
import { StatusBar } from './components/StatusBar'
import { TabBar, type Tab } from './components/TabBar'
import type { Inbound, Outbound } from './domain/types'
import { todayIso } from './lib/dates'
import { swipeTab } from './lib/swipe'
import { isPushSubscribed, pushOptedOut, pushSupported, setPushOptedOut, shouldRestorePush, subscribePush, unsubscribePush } from './push/push'
import { local, remote, repo, sync } from './repo'
import { CalendarScreen } from './screens/CalendarScreen'
import { DetailScreen, type Detail } from './screens/DetailScreen'
import { ListScreen } from './screens/ListScreen'
import { RiScreen } from './screens/RiScreen'
import { LoginScreen } from './screens/LoginScreen'
import { SearchScreen } from './screens/SearchScreen'
import { StaffScreen } from './screens/StaffScreen'
import { StatsScreen } from './screens/StatsScreen'
import { fetchAccounts, type StaffAccount } from './staff/staff'
import { UploadScreen } from './screens/UploadScreen'
import { cloudConfigured, supabase } from './storage/cloud/supabase'
import type { SyncStatus } from './sync/sync'

const VAPID_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''
const dateParam = () => {
  const d = new URLSearchParams(location.search).get('date')
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}
const cntrParam = () => new URLSearchParams(location.search).get('cntr')

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined) // undefined = 확인 중
  const role: Role = roleOf(session ?? null)
  const [tab, setTabState] = useState<Tab>('입출고')
  const [slide, setSlide] = useState<'' | 'from-right' | 'from-left'>('')
  const touch = useRef<{ x: number; y: number } | null>(null)
  const [date, setDate] = useState(() => dateParam() ?? todayIso(new Date()))
  const [detail, setDetail] = useState<Detail | null>(null)
  const [focusCntr, setFocusCntr] = useState(() => (dateParam() ? cntrParam() : null)) // 알림으로 연 컨테이너: 입출고 화면에서 그 컨테이너를 반짝인다
  const [dataVersion, setDataVersion] = useState(0)
  const [status, setStatus] = useState<SyncStatus>(sync.status())
  const [pushOn, setPushOn] = useState<boolean | null>(null)
  const [me, setMe] = useState<StaffAccount | null>(null) // 직원 계정의 이름·권한
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
    await sync.reset() // 진행 중 동기화가 지운 뒤에 옛 위치를 되살리지 않게 (clearAll 바로 앞)
    await local.clearAll()
    setDetail(null)
    setMe(null)
    setTabState('입출고')
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
    // 권한은 관리자가 바꾸면 바로 적용되게 화면에 돌아올 때마다 다시 읽는다(서버도 같은 표로 막는다)
    const loadMe = () => { if (role === 'staff') void fetchAccounts(supabase).then((l) => setMe(l[0] ?? null)).catch(() => {}) }
    loadMe()
    const run = () => { loadMe(); void sync.syncOnce() }
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    run()
    const offLog = remote.onNewLog(run)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', run)
    void isPushSubscribed().then(async (subscribed) => {
      if (VAPID_KEY && pushSupported() && shouldRestorePush({ permission: Notification.permission, subscribed, optedOut: pushOptedOut() })) {
        subscribed = (await subscribePush(supabase, VAPID_KEY).catch(() => 'unsupported' as const)) === 'subscribed'
      }
      setPushOn(subscribed)
    })
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
        setTabState('입출고')
        setDate(e.data.date)
        setFocusCntr(typeof e.data.cntr === 'string' ? e.data.cntr : null)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  const openIn = useCallback((item: Inbound, bls?: string[]) => setDetail({ kind: 'in', item, bls }), [])
  const focused = useCallback(() => setFocusCntr(null), [])
  const openOut = useCallback((item: Outbound) => setDetail({ kind: 'out', item }), [])
  const closeDetail = useCallback(() => setDetail(null), [])
  const changeDate = useCallback((d: string) => { fixedDate.current = false; setFocusCntr(null); setDate(d) }, [])
  const dataChanged = useCallback(() => {
    setDataVersion((v) => v + 1)
    void jumpToLatest()
  }, [jumpToLatest])

  async function enablePush() {
    setPushOptedOut(false)
    const r = await subscribePush(supabase, VAPID_KEY).catch(() => 'unsupported' as const)
    setPermission(pushSupported() ? Notification.permission : 'denied')
    setPushOn(r === 'subscribed')
  }
  async function togglePush() {
    if (pushOn) {
      setPushOptedOut(true)
      await unsubscribePush(supabase)
      setPushOn(false)
    } else await enablePush()
  }

  if (!cloudConfigured) return <main className="empty">앱 설정(Supabase 주소·키)이 없어요. 관리자에게 알려 주세요.</main>
  if (session === undefined) return <main className="empty">불러오는 중…</main>
  if (!session || !role) return <LoginScreen />

  // 직원은 관리자가 숨긴 탭을 빼고 본다(화면만 숨김: 데이터 읽기 권한은 그대로)
  const tabs: Tab[] = role === 'admin' ? ['입출고', 'RI', '통계', '달력', '검색', '올리기', '직원']
    : (['입출고', 'RI', '통계', '달력', '검색'] as const).filter((t) => !(me?.hidden_tabs as string[] | undefined)?.includes(t))
  const can = (p: 'container' | 'calendar') => role === 'admin' || !!me?.perms.includes(p)
  const current = tabs.includes(tab) ? tab : '입출고'
  const goTab = (t: Tab) => {
    if (t === current) return
    setSlide(tabs.indexOf(t) > tabs.indexOf(current) ? 'from-right' : 'from-left')
    setTabState(t)
  }
  const onTouchStart = (e: React.TouchEvent) => {
    // 팝업(휴가 입력 등) 안에서 민 것은 탭 넘기기가 아니다
    touch.current = (e.target as Element).closest('[role=dialog]') ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const next = swipeTab(tabs, current, { dx: t.clientX - touch.current.x, dy: t.clientY - touch.current.y, startX: touch.current.x, width: window.innerWidth })
    touch.current = null
    if (next) goTab(next)
  }

  return (
    <div className="app">
      <StatusBar status={status} onRetry={() => void sync.syncOnce()} pushOn={pushSupported() ? pushOn : null}
        onTogglePush={() => void togglePush()} onLogout={() => void logout(supabase, cleanup)}
        roleLabel={role === 'admin' ? '관리자로 로그인됨' : me ? `${me.name}(${me.login_id})으로 로그인됨` : '직원으로 로그인됨'} />
      <div key={current} className={`tab-page ${slide}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {current === '입출고' && permission === 'default' && pushOn === false && VAPID_KEY && <PushCard onEnable={() => void enablePush()} />}
      {current === '입출고' && (
        <ListScreen date={date} onDateChange={changeDate} onOpenIn={openIn} onOpenOut={openOut}
          onGoUpload={() => goTab(role === 'admin' ? '올리기' : '입출고')} canUpload={role === 'admin'} dataVersion={dataVersion}
          focusCntr={focusCntr} onFocused={focused} />
      )}
      {current === 'RI' && <RiScreen />}
      {current === '검색' && <SearchScreen />}
      {current === '통계' && <StatsScreen dataVersion={dataVersion} />}
      {current === '달력' && <CalendarScreen canEdit={can('calendar')} />}
      {current === '올리기' && role === 'admin' && <UploadScreen onDataChanged={dataChanged} dataVersion={dataVersion} />}
      {current === '직원' && role === 'admin' && <StaffScreen />}
      </div>
      {detail && <DetailScreen detail={detail} onBack={closeDetail} canEdit={can('container')} />}
      <TabBar tabs={tabs} tab={current} onChange={goTab} />
    </div>
  )
}
