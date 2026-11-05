import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages는 /<저장소이름>/ 아래에서 서비스되므로 배포 때 BASE_PATH로 지정
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
