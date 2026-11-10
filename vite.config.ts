import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages는 /<저장소이름>/ 아래에서 서비스되므로 배포 때 BASE_PATH로 지정
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 푸시 처리를 위해 서비스 워커를 직접 작성한다 (src/sw.ts)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'] },
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.png'],
      manifest: {
        name: '(주)부산신항로지텍',
        short_name: '부산신항로지텍',
        description: '보세운송 입고·한화오션 출고 내역 조회',
        lang: 'ko',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        theme_color: '#1f6feb',
        background_color: '#f4f5f7',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
