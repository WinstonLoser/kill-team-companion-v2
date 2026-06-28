# Kill Team 战棋助手

KT Lite 桌面战棋电子伴随——现实棋盘的数字映射，覆盖建队 → 选图 → 部署 → 对局（射击/近战结算）→ 目标点/VP/胜负全流程。静态 Web 应用，部署 GitHub Pages，无后端。

规划产物见 `_bmad-output/`（PRD / 架构 / UX / epics / sprint-status）。

## 技术栈

TypeScript strict · React 19 · Vite 8 · Zustand 5 · XState 5 · Vitest · Playwright

## 开发

```bash
npm install      # 装依赖
npm run dev      # 本地开发 (http://localhost:5173)
npm test         # 跑单测 (Vitest)
npm run build    # 类型检查 + 生产构建 → dist/
npm run preview  # 预览生产构建
```

## 部署（GitHub Pages）

1. 推到 `main` → `.github/workflows/deploy.yml` 自动 install/test/build/部署。
2. 仓库 **Settings → Pages → Source: GitHub Actions**（一次性）。
3. 若仓库名 ≠ `kill-team-companion-v2`，改 `vite.config.ts` 的 production `base`。

## 约束

- 无后端，刷新即重置对局状态（D-20）。
- `docs/rules/`（官方转 md）在 `.gitignore`，不入公开仓库（IP，D-29）。
- 规则 data-driven，加阵营 = 加数据包（`src/data/packs/`）。
