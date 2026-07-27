import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

/*
 * 样式分层，顺序有意义 —— ESM 按 import 语句出现的顺序求值依赖，
 * 所以这三行必须写在 `import { App }` **之前**：
 *
 *   1. @ds/styles.css   设计系统 token（颜色/排版/间距/效果）
 *   2. ./ds.css         DS 组件样式的 class 化转写
 *   3. ./index.css      应用全局：token 覆写（rem 标度）+ 旧屏样式
 *   4. 组件自带的 .css  由 App 的依赖图带入，最后注入
 *
 * 第 4 层排在最后是关键：像 .oap-modal / .pv-modal-combat 这类要覆盖
 * .ds-modal 的规则与被覆盖者同为单类选择器，优先级相同，只能靠先后顺序取胜。
 * 若把 App 的 import 提到前面，组件样式会先注入，这些覆盖会全部失效
 * （宽弹窗被压回 .ds-modal 的 480px）。
 */
import '@ds/styles.css'
import './ds.css'
import './index.css'

import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Story 4.2：注册 Service Worker（stale-while-revalidate，首次加载后离线可用）。仅 production 注册（避免 dev HMR 缓存干扰）。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
  })
}
