/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 生产 base 对齐 GitHub Pages 项目页子路径（仓库名）；本地 dev 用 '/'
// 部署前若仓库名不同，改这里的 production base。
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/kill-team-companion-v2/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}))
