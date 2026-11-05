export type Tab = '목록' | '검색' | '통계' | '올리기'
const TABS: Tab[] = ['목록', '검색', '통계', '올리기']

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => onChange(t)}>
          {t}
        </button>
      ))}
    </nav>
  )
}
