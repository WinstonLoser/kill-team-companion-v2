/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 生产 base 对齐 GitHub Pages 项目页子路径（仓库名）；本地 dev 用 '/'
// 部署前若仓库名不同，改这里的 production base。
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/kill-team-companion-v2/' : '/',
  plugins: [react()],
  // 设计系统以原样导入到仓库根 design-system/（不在 src 下，故不参与 tsc 类型检查）。
  // 运行时由该别名解析 .jsx；类型由 src/ds.d.ts 的环境声明提供。
  resolve: {
    alias: {
      '@ds': fileURLToPath(new URL('./design-system', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}))
