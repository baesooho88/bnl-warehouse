import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { uploading } from './lib/upload'
import './styles.css'

// 새 버전 적용: 안드로이드 PWA는 닫아도 화면이 살아 있어 이전 코드로 엑셀을 읽는다.
// 앱으로 돌아올 때와 켜져 있는 동안 5분마다 새 버전을 확인하고, 새 서비스 워커가 넘겨받으면(첫 설치 제외) 새로 고친다.
// 업로드 중이면 끝날 때까지 새로 고침을 미룬다(업로드가 끊기지 않게).
if ('serviceWorker' in navigator) {
  const check = () => void navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {})
  const reload = () => (uploading.now ? setTimeout(reload, 1000) : location.reload())
  let hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) reload()
    hadController = true
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') check()
  }, 5 * 60_000)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
