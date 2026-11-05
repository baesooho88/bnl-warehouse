import { useEffect, useState } from 'react'
import { formatMD } from '../lib/dates'
import type { SyncStatus } from '../sync/sync'

const hm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const localDay = (iso: string) => {
  const d = new Date(iso)
  return formatMD(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
}

export function StatusBar(props: {
  status: SyncStatus
  onRetry: () => void
  pushOn: boolean | null
  onTogglePush: () => void
  onLogout: () => void
  roleLabel: string
}) {
  const [online, setOnline] = useState(navigator.onLine)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  const { status } = props
  const last = status.lastSyncedAt
  const text = !online
    ? `오프라인 · ${last ? `마지막 동기화 ${localDay(last)} ${hm(last)}` : '아직 받은 데이터 없음'}`
    : status.state === 'syncing' ? '동기화 중…'
    : status.state === 'error' ? '동기화 실패'
    : last ? `최신 · ${hm(last)} 동기화` : '연결됨'

  return (
    <div className={`statusbar ${!online ? 'offline' : status.state}`}>
      <span role="status">{text}</span>
      {online && status.state === 'error' && <button className="link" onClick={props.onRetry}>다시 시도</button>}
      <button className="menu-btn" aria-label="메뉴" aria-expanded={menu} onClick={() => setMenu(!menu)}>⋯</button>
      {menu && (
        <div className="menu" role="menu">
          <div className="menu-who">{props.roleLabel}</div>
          {props.pushOn !== null && (
            <button role="menuitem" onClick={() => { setMenu(false); props.onTogglePush() }}>{props.pushOn ? '알림 끄기' : '알림 켜기'}</button>
          )}
          <button role="menuitem" onClick={() => { setMenu(false); props.onLogout() }}>로그아웃</button>
        </div>
      )}
    </div>
  )
}
