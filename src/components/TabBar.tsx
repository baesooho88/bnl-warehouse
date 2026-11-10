export type Tab = '입출고' | '검색' | '통계' | '달력' | '올리기'

export function TabBar({ tabs, tab, onChange }: { tabs: Tab[]; tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => onChange(t)}>
          {t}
        </button>
      ))}
    </nav>
  )
}
