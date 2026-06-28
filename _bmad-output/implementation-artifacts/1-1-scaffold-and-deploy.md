# Story 1.1: 项目脚手架与构建部署 (scaffold-and-deploy)

Status: review

## Story

As a 构建者（Winst）,
I want 一个可运行的 React + TypeScript 项目骨架，并自动部署到 GitHub Pages,
so that 后续所有故事有稳定基底、发布零摩擦（git push 即上线）。

## Acceptance Criteria

1. **AC1（构建部署）**：`git push` 到 `main` 触发 GitHub Actions，执行 install → test → build，并把 `dist/` 发布到 GitHub Pages；访问 `<user>.github.io/<repo>/` 能加载应用。
2. **AC2（目录与路由）**：应用加载后刷新不 404；目录结构含 `src/{engine,geometry,rules,state,dice,ui,data}`（data 下含 `packs/`）。
3. **AC3（类型与测试）**：任意源文件下 `npm run build` 与 `npm test` 均通过；`tsconfig` 为 `strict: true`，无 `any` 泄漏（`noImplicitAny`）；Vitest 可跑通至少一个示例测试。

## Tasks / Subtasks

- [x] **T1 — 仓库与忽略**（AC1/AC2）
  - [x] `git init`（当前目录非 git 仓库）
  - [x] `.gitignore`：`node_modules/`、`dist/`、`.vite/`、**`docs/rules/`**（IP 护栏，D-29——官方转 md 不入公开仓库）、编辑器/OS 临时文件
- [x] **T2 — Vite + React + TS 脚手架**（AC2/AC3）
  - [x] 用 Vite 8 官方 `react-ts` 模板初始化（CRA 已弃，勿用）
  - [x] 依赖（2026.06 最新稳定，安装时核对）：`react@19` `react-dom@19`、`typescript@5.x`、`vite@8` `@vitejs/plugin-react`、`zustand@5`、`xstate@5`、`vitest`（最新）、`@playwright/test`（最新）
  - [x] `tsconfig.json`：`"strict": true`、`"noImplicitAny": true`、`"noUncheckedIndexedAccess": true`（引擎正确性优先，NFR-1）
- [x] **T3 — 目录结构**（AC2）
  - [x] 建 `src/{engine,geometry,rules,state,dice,ui}` 与 `src/data/packs/`，各放 `index.ts`（导出占位）或 README，保证后续故事直接落位
  - [x] 顶层保留：`public/`、`index.html`、`vite.config.ts`、`package.json`、`tsconfig.json`、`.github/workflows/`
- [x] **T4 — 视图切换（无路由库）**（AC2）
  - [x] **不引入客户端路由库**：单页 `index.html` + Zustand `currentView` 状态切换（建队/对局/查询三入口）。刷新回到入口，无 404（单入口 SPA）。
  - [x] > 理由：架构 AQ-7 原提 hash 路由防刷新 404；但本应用单入口 + D-20 刷新重置，无 URL 子路径即无 404，省一个依赖。
- [x] **T5 — Vite 构建配置**（AC1）
  - [x] `vite.config.ts`：`base: '/<repo>/'`（GH Pages 项目页子路径，部署前用实际仓库名替换；本地 dev 用 `/`）
  - [x] 构建 `outDir: 'dist'`
- [x] **T6 — 测试配置**（AC3）
  - [x] `vitest.config.ts`（或合并进 vite.config）+ `tests/` 目录 + 一个示例 `sample.test.ts`（如测一个纯函数）跑通
  - [x] Playwright 装好即可（`e2e/` 目录占位），本故事不写 e2e
- [x] **T7 — GitHub Actions 部署**（AC1）
  - [x] `.github/workflows/deploy.yml`：触发 `push: main`；步骤 `actions/setup-node` → `npm ci` → `npm test` → `npm run build` → `actions/upload-pages-artifact` (`dist`) → `actions/deploy-pages`
  - [x] 仓库 Settings → Pages → Source: GitHub Actions（手动一次性配置，写进 README 提醒）
- [x] **T8 — README 与验证**（AC1/AC3）
  - [x] `README.md`：本地 `npm run dev` / 构建 / 测试 / Pages 配置说明
  - [x] 本地跑 `npm run build && npm test` 全绿；`npm run preview` 验证 `base` 路径下资源加载正常

## Dev Notes

### 架构合规（必须遵循）

- **技术栈（AR-1）**：TS strict + React 18+/19 + Vite + Zustand（状态/快照）+ XState v5（分层回合状态机，后续故事用）+ seedable PRNG（后续）。本故事只装不深入实现。
- **模块边界（AR-9）**：`src/engine`、`geometry`、`rules`、`dice` 为**纯逻辑零 UI 依赖**；`src/ui` 只消费 `src/state`。本故事建好目录边界即可，内容后续填。
- **无后端（NFR-2）**：纯静态产物，不引入任何 server/express/api 依赖。
- **IP（NFR-7 / D-29）**：`docs/rules/` **必须**在 `.gitignore`——公开仓库不含官方规则原文。

### 库/框架版本（2026.06，安装时核对最新）

| 库 | 版本 | 备注 |
|----|------|------|
| Vite | 8 | CRA 已弃，用 `npm create vite@latest` |
| React / react-dom | 19 | 函数组件 + hooks |
| TypeScript | 5.x | strict |
| Zustand | 5 | 状态管理（v5 迁移注意：`create` 用法） |
| XState | 5 | 本故事仅装，状态机在 Story 1.9 |
| Vitest | 最新 | 单测 |
| @playwright/test | 最新 | 本故事仅装 |

> 不引入：客户端路由库（react-router 等）、Redux、CSS-in-JS 重框架（视觉基调用组件库暗色主题，D-31 后置——本故事可先不选 UI 库，留 Story 1.17/4.3）。

### 项目结构（架构 §9，对齐 AR-10）

```
kill-team-companion/
├─ src/
│  ├─ engine/        # 结算引擎（纯逻辑，零 React 依赖）— 后续
│  ├─ geometry/      # 自由坐标几何 — 后续
│  ├─ rules/         # 数据层（data-driven）— 后续
│  ├─ state/         # Zustand store + XState FSM — 后续
│  ├─ dice/          # 骰源无关 — 后续
│  ├─ ui/            # React 组件 — 后续
│  └─ data/packs/    # 规则数据包 JSON — 后续
├─ tests/            # Vitest 单测
├─ e2e/              # Playwright（占位）
├─ public/
├─ .github/workflows/deploy.yml
├─ .gitignore        # 含 docs/rules/
├─ index.html
├─ vite.config.ts    # base: '/<repo>/'
├─ tsconfig.json     # strict
└─ package.json
```

### 测试标准

- Vitest：本故事交付 1 个示例单测（验证测试管线通）。
- 覆盖率门槛：本故事不设；引擎/enforcer 高覆盖在 Story 1.3/1.4 起（golden tests，AR-3）。

### Project Structure Notes

- 与架构 §9 完全对齐，无冲突。
- `_bmad-output/`（规划产物）保留在仓库（非源码），可入 git 供追溯；`docs/rules/` 不入。
- 视图切换不用路由库——这是对 AQ-7 的细化（单入口 SPA 免 404，省依赖），非偏离硬约束。

### References

- 架构 §1 技术栈 / §1.3 部署链路 / §9 目录结构 / AQ-7 路由 — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- PRD D-29（IP）/ D-20（刷新重置）/ NFR-1/2/7/8 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- Epic 1 Story 1.1 — `planning-artifacts/epics.md`
- 栈版本调研（2026.06）：Vite 8 / React 19 / Zustand 5 / XState 5

## Dev Agent Record

### Agent Model Used

GLM（本会话，经 bmad-dev-story 实现）

### Debug Log References

- `npm test` → 3/3 通过（viewStore 视图切换）
- `npm run build` → tsc --noEmit（strict）+ vite build 通过，产出 dist/

### Completion Notes List

- **AC1（部署）**：`.github/workflows/deploy.yml` 就位（push main → npm ci/test/build → Pages）；`package-lock.json` 已生成（npm ci 可用）；`vite.config.ts` production `base='/kill-team-companion-v2/'`（dev 用 '/'）。**CI 实际触发待用户 push 到 GitHub**（本环境无 remote）。
- **AC2（目录/路由）**：`src/{engine,geometry,rules,state,dice,ui}` + `src/data/packs/` 全建；单入口 SPA + Zustand `currentView` 切换，无路由库 → 刷新回根入口、无 404。
- **AC3（类型/测试）**：`tsconfig.json` strict + noImplicitAny + noUncheckedIndexedAccess；`tsc --noEmit` 零错误（无 any 泄漏）；Vitest 3/3 通过。
- **T1 git**：`git init` 完成；`.gitignore` 含 `node_modules/dist/.vite/coverage` + `docs/rules/`（IP D-29，已 git check-ignore 确认）。**未 commit**（按约定 commit 由用户发起）。
- **依赖实际版本（npm 解析，2026.06）**：react 19.2.7 / react-dom 19.2.7 / zustand 5.0.14 / xstate 5.32.2 / typescript **6.0.3** / vite 8.1.0 / vitest 4.1.9 / @vitejs/plugin-react 6.0.3 / @playwright/test 1.61.1。
- **实现偏离（已记录）**：原故事隐含 project references（tsconfig.node.json），但 **TS6 报 TS6310**（被引用 composite 项目不可 noEmit）→ 简化为单一 `tsconfig.json`（含 vite.config.ts）+ build 用 `tsc --noEmit`。功能等价，类型检查通过。
- **待用户决策**：`git add -A` 暂存 950 文件含 `_bmad/`、`.claude/`（开发工具）。如希望公开仓库精简，可把开发工具目录加进 `.gitignore`——留用户定。
- **Service Worker / Playwright e2e**：本 story 仅装占位（AQ-6 / 后续 story），符合范围。

### File List

新增：
- `.gitignore`
- `.github/workflows/deploy.yml`
- `README.md`
- `index.html`
- `package.json`（后由 npm install 补 dependencies/devDependencies）
- `package-lock.json`（npm 生成）
- `tsconfig.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`
- `src/vite-env.d.ts`
- `src/state/viewStore.ts`
- `src/state/index.ts`
- `src/engine/index.ts`、`src/geometry/index.ts`、`src/rules/index.ts`、`src/dice/index.ts`、`src/ui/index.ts`（占位）
- `src/data/packs/.gitkeep`
- `e2e/.gitkeep`
- `tests/sample.test.ts`

删除：
- `tsconfig.node.json`（TS6310，改单一 tsconfig）

### Change Log

- 2026-06-28：Story 1.1 实现完成——脚手架 + 构建/部署 + 目录 + 视图切换 + 测试，状态 → review。
