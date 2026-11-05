export function PushCard({ onEnable }: { onEnable: () => void }) {
  return (
    <button className="pushcard" onClick={onEnable}>
      🔔 <b>새 입출고 알림 받기</b>
      <span>업로드되면 앱이 꺼져 있어도 알려 드려요</span>
    </button>
  )
}
