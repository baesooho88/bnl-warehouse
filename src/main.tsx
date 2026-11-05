import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'

if (import.meta.env.DEV) {
  // 개발용: 브라우저 콘솔에서 엑셀을 직접 넣어 볼 수 있게
  void Promise.all([import('./lib/importFiles'), import('./repo')]).then(([m, r]) => {
    Object.assign(window, {
      __seed: (files: { name: string; data: ArrayBuffer }[]) => m.importFiles(files, r.repo, new Date()),
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
