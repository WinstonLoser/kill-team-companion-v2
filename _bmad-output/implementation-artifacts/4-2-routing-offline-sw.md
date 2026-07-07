# Story 4.2: hash 路由与 Service Worker 离线 (routing-offline-sw)

Status: done

## Story

As a 玩家,
I want 应用刷新任意状态不 404，且首次加载后离线可用,
so that 各处（含平板桌面书签）稳定用、无网络也能打局（NFR-2）。

> 注：Story 1.1 已决策「无路由库 + Zustand 视图切换」（单入口 SPA 免 404，AQ-7 细化）。本故事**确认**该决策落实并补 Service Worker 离线（AQ-6，可选）。

## Acceptance Criteria

1. **AC1（无 404，AQ-7 已细化）**：应用只有一个入口 `index.html`（无 URL 子路径），刷新任意 Zustand `currentView` 状态（建队/对局/查询）回到入口，**无 404**——因单入口 SPA 本就无子路径路由。确认无路由库引入、无 hash 路由误配。
2. **AC2（Service Worker app-shell 缓存，AQ-6）**：首次加载后注册 Service Worker，缓存 app-shell（`index.html` + JS/CSS bundle + 数据包 JSON + 字体）；后续离线（断网/飞行模式）可加载 app-shell 进入应用。
3. **AC3（缓存版本化）**：每次构建生成新 cache version（content hash），SW 更新时激活新缓存、清理旧缓存（避免用户拿旧规则数据包——NFR-6 数据版本化护栏的离线侧）。
4. **AC4（无回归 + 离线手测）**：在线全功能正常（Epic 1-3 不回归）；离线状态建队→部署→打局→结算→VP 全流程可用（状态会话内存，D-20 刷新重置——离线不影响，因无后端调用）。
5. **AC5（可选渐进）**：Service Worker 标注为 v1 可选（AQ-6）——若实现期资源紧，先只交付 AC1（无 404 确认），SW 延后到 v1.x；但**本故事默认全做**。

## Tasks / Subtasks

- [x] **T1 — 确认单入口无 404（AC1，AQ-7 收口）**（AC1）
  - [x] 核对 `index.html` 为唯一入口；`vite.config.ts` 的 `base` 正确（`'/<repo>/'` 生产 / `'/'` dev）
  - [x] 核对无 `react-router`/`hash` 引入；`currentView` 走 Zustand（Story 1.1 T4）
  - [x] 验证：直接访问 `<user>.github.io/<repo>/` + 刷新 + 任意 view 切换后刷新，均不 404
  - [x] （可选）`public/404.html` 重定向到 index.html 作为 GH Pages 兜底——但因单入口，理论不需要，确认后可不留
- [x] **T2 — Service Worker app-shell 缓存**（AC2）
  - [x] 选 SW 工具：手写 SW（最轻，零运行时依赖）或 `vite-plugin-pwa`（workbox 生成，配置驱动）——**推荐 vite-plugin-pwa**（社区主流、与 Vite 8 兼容、自动 versioning），但保持轻配（仅 app-shell，不做 runtime cache 复杂策略）
  - [x] 安装 `vite-plugin-pwa`，配 `registerType: 'autoUpdate'`、`manifest`（name/icons/theme 与视觉基调 Story 4.3 对齐）、`workbox.globPatterns: ['**/*.{js,css,html,ico,json,woff2}']`（含数据包 JSON）
  - [x] `includeManifest: true`（PWA 安装到桌面书签，平板友好）
  - [x] 注册：`main.tsx` 调 `registerSW()`（vite-plugin-pwa 提供）
- [x] **T3 — 缓存版本化与更新**（AC3）
  - [x] vite-plugin-pwa 自动按构建 content hash 版本化 precache；新部署触发 SW update → `skipWaiting` + `clientsClaim` 激活新缓存清旧
  - [x] 数据包 JSON（规则勘误时变）进 precache——确保用户拿最新规则（NFR-6）。出现新勘误=新构建=新 SW=新缓存
  - [x] （可选）UI 提示「新版本可用，刷新加载」——v1 可不做（autoUpdate 静默）
- [x] **T4 — 离线验证**（AC4）
  - [x] Chrome DevTools Application → Service Workers + Cache Storage 核对缓存条目
  - [x] DevTools Network → Offline 模式：刷新应用 → 应从 SW 加载 app-shell 进入入口
  - [x] 离线跑全流程：建队→部署→一击结算→VP（无网络调用，D-20 会话内存）
  - [x] 真实平板加书签到桌面 → 飞行模式 → 打开 → 验证可用
- [x] **T5 — 全绿验证 + 无回归**（AC4/AC5）
  - [x] `npm run build` 产物含 SW（`sw.js` + `workbox-*.js`）；`npm test` 全绿
  - [x] Epic 1-3 e2e 回归（在线模式不变）
  - [x] 若资源紧选择只交付 AC1：在 Dev Notes 记 SW 延后，标 v1.x

## Dev Notes

### 架构合规（必须遵循）

- **AQ-7 已细化（Story 1.1）**：原架构 AQ-7 在 hash 路由 vs browser 路由间权衡；Story 1.1 决策**不用路由库**（单入口 SPA + Zustand `currentView`），因 D-20 刷新重置 + 无 URL 子路径 = 本就无 404。本故事**确认**该决策，不重新引入路由。这是对 AQ-7 的最终收口，非偏离。
- **AQ-6（可选）**：原架构 AQ-6 把 SW 列为「v1 可选，非 MVP 必需」（GH Pages 一次加载即缓存于浏览器）。本故事默认做（NFR-2 离线/无后端的完整兑现），但保留「资源紧则延后」的退路。
- **无后端（NFR-2）**：SW 仅缓存静态产物，无任何后端调用；离线 = 缓存命中 + 会话内存。
- **数据版本化（NFR-6）**：数据包 JSON 进 SW precache，新勘误=新构建=新缓存，用户不会拿过期规则。

### 关键约束

- **D-20 刷新重置**：刷新回入口、对局状态丢——这是设计（会话内存），SW 离线不改变这点。离线刷新=回入口（与在线一致），不是续局。
- **GH Pages 子路径**：`base: '/<repo>/'` 必须正确，否则 SW scope 错位缓存失效（Story 1.1 已配，核对）。
- **vite-plugin-pwa vs 手写**：推荐 plugin（轻配、自动 versioning、社区维护），但**仅 app-shell precache**，不做 runtime cache 的复杂策略（图片/字体可 runtime，但 v1 数据少，precache 够）。
- **不引路由库**：本故事是确认「无路由」正确，不是加路由。

### 不要做

- 不引入客户端路由库（react-router 等）。
- 不做全应用 event sourcing 持久化（D-20 已排除）。
- 不做复杂 runtime cache 策略（v1 不需要）。
- 不破坏 Epic 1-3 在线功能。

### References

- 架构 §1.3 部署链路 / AQ-6 SW / AQ-7 路由 / NFR-2 — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- Story 1.1 T4/T5（无路由库 + base 配置决策）：`_bmad-output/implementation-artifacts/1-1-scaffold-and-deploy.md`
- Epic 4 Story 4.2 — `planning-artifacts/epics.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
