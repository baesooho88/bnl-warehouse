import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'

// 새 버전 적용: 안드로이드 PWA는 닫아도 화면이 살아 있어 이전 코드로 엑셀을 읽는다.
// 앱으로 돌아올 때마다 새 버전을 확인하고, 새 서비스 워커가 넘겨받으면(첫 설치 제외) 새로 고친다.
// shortcut: 업로드 도중 넘겨받으면 그 업로드가 끊길 수 있음 — 확인은 앱을 열거나 돌아온 순간에만 해서 드묾
if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) location.reload()
    hadController = true
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void navigator.serviceWorker.getRegistration().then((r) => r?.update())
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
