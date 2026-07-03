# Epic 4 Code Review（2026-07-03）

三层对抗审查：Blind Hunter / Edge Case Hunter / Acceptance Auditor。
Diff 源 `093f75e..HEAD`（5 文件 +110/−3）。

## Patch（明确修复）

- **[P1][Med] `showViz` 用 `getState().interacting` 非响应式读取**：PlayView line 189 `!useMatchStore.getState().interacting` 不经 Zustand selector → `interacting` 翻转时可能不重渲染（仅靠其他订阅间接触发）。改：用 `useMatchStore((s)=>s.interacting)` 订阅。
- **[P2][Low] `panBy` 定义但未接线**：matchStore 有 `panBy` action 但 PlayView 未调（单指平移未实现——token 拖占用了单指）。要么接线要么删。
- **[P3][Low] `onWheel` `preventDefault()` 可能在 passive 模式失效**：React onWheel 在部分浏览器为 passive → preventDefault 静默失败（页面滚动不拦）。非致命（缩放仍生效），但用户体验有噪音。

## Defer（设计如此 / v1 接受）
- **[W1] SW 单 cache key 无 content-hash 版本化**：`kt-companion-v2` 静态 key，旧 asset 仅 activate 时清。v1 可接受（NFR-6 版本护栏在 rulesetVersion 层）。
- **[W2] 4-1 AC2 拖动阈值**（~5px 区分点击 vs 拖动）未实现——当前 pointerdown 即拖；阈值细化留手测调参。
- **[W3] 4-1 AC3 性能基线测量 + AC4 按需降级**（帧率 <30fps 触发降级）未实现——overlay debounce 已做（interacting 时跳），但无帧率监控/自动降级。需运行时手测。
- **[W4] 4-1 T5 canvas 分层/空间索引**：v1 棋盘规模小（14 特工），暴力渲染够用；留手测证瓶颈后加。

## Dismiss
- **boardPoint 在视口变换下正确**：Board 的 `e.currentTarget.getBoundingClientRect()` 取的是被 transform 过的 board div 本身 → rect 已含缩放/平移 → `(clientX - rect.left) / SCALE` 坐标正确。（Edge Case Hunter 疑似 bug，实际验证无问题。）
- **SW scope**：`BASE_URL + 'sw.js'` 在 GH Pages 子路径 `/kill-team-companion-v2/` 正确注册（Vite BASE_URL = production base）。
- **4-3 design tokens 未全替换硬编码**：tokens 已定义 + 关键位替换；全量替换几百处 CSS 魔法值留 v1.x 渐进。

## 完成度真实性
4-1 AC2（拖动阈值）+ AC3（帧率）+ AC4（自动降级）为 partial（overlay debounce 已做但无阈值/帧率监控）。4-2/4-3 核心交付完整。P1-P3 修复后无 High/Med 遗留。
