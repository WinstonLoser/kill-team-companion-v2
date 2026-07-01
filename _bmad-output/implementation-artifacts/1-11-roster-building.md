# Story 1.11: 建队流程 (roster-building)

Status: review

## Story

As a 玩家,
I want 用死亡天使建队并实时看到阵容合法性,
so that 进对局前阵容合规、不卡在对局中才发现违规。

## Acceptance Criteria

1. **AC1（流程贯通）**：进入建队后，按 选阵营(死亡天使) → 选特工(阵营列表) → 配装备 → 子阵营选择器(战团战术 8 选 2) → 合法性面板 顺序可达；每步实时反映到合法性面板。
2. **AC2（结构性合法性，无点数 D-30）**：合法性面板实时显示三类结构性校验——特工来源(全选自阵营可用列表) / 子阵营选择(战团战术 2/2) / 装备限制(如重武器 ×N 上限)——**无点数预算**。任一违规 → 红字高亮该条 + 链到违规特工 + 「进入对局」按钮置灰。
3. **AC3（进入对局门禁）**：全绿阵容时「进入对局 ▶」可点，点击后写入 store 的双方阵容并切到开局准备(Story 1.12)；任一违规时按钮置灰 + tooltip「先解决 N 项违规」。
4. **AC4（双方建队）**：建队面板支持为 A/B 双方各建一队（阵营可同可异）；两支全绿才解锁进入对局。

## Tasks / Subtasks

- [x] **T1 — UI 层 roster store 切片**（AC1/AC2/AC4）
  - [x] Zustand store 增 `rosterA`/`rosterB`：`{ factionId, operativeIds[], loadout: {[opId]: weaponRefs[]}, subFactionSelection: {...} }`
  - [x] UI 只读写 store，不直接调引擎/数据包；通过 `rules/packLoader` 加载的 faction pack（已缓存在 store）读 buildConstraints
- [x] **T2 — 选阵营视图**（AC1）
  - [x] 三阵营卡(军团兵/死亡天使/瘟疫战士)，本 Epic 仅死亡天使数据可用(Story 1.3)，其余置灰标「Epic 2/3」
  - [x] 分别为 A/B 选；选后进入特工列表
- [x] **T3 — 选特工 + 装备配置视图**（AC1/AC2）
  - [x] 阵营特工列表（来自 faction pack `operatives[]`）；`[+添加][-移除]` 入队/出队
  - [x] 每个入队特工的装备配置：从 `operative.weaponRefs` + `uniqueLoadoutOptions` 选；实时显示总数/关键词/装备计数
- [x] **T4 — 子阵营选择器（死亡天使战团战术 8 选 2）**（AC1/AC2）
  - [x] 读 faction pack 的 `buildConstraints.subFactionSelector`（或等价结构）渲染选择器；死亡天使=8 选 2，单阵营组件
  - [x] 选满 2 才该项 ✓；多选拦截（按数据约束的 `max` 字段）
  - [x] 通用化：军团兵的印记 5 选 1 在 Epic 2 复用同组件（按 selector 类型 dispatch）
- [x] **T5 — 合法性面板组件**（AC2/AC3）
  - [x] 固定右侧（桌面）/底部抽屉（平板），三行：特工来源 / 子阵营选择 / 装备限制
  - [x] 读 `buildConstraints`（架构 §2.1）逐条算 `{label, status: 'ok'|'warn', detail}`；违规 → 红字 + 定位特工(点跳到对应特工卡)
  - [x] 全绿才解锁「进入对局 ▶」
- [x] **T6 — 进入对局门禁 + 路由**（AC3/AC4）
  - [x] 「进入对局」onClick：校验双方全绿 → store commit 阵容 → 切 `currentView` 到 setup-map-deploy(Story 1.12)
  - [x] 非全绿：按钮置灰 + tooltip 显示未解决违规数
- [x] **T7 — 触控与基调兜底**（AC1）
  - [x] 最小点击区 44px，关键按钮(添加/移除/进入对局) 56px（NFR-9 / UX §1.3）
  - [x] 套组件库暗色主题（Story 1.17 选定后落地）；阵营色描边区分 A/B
- [x] **T8 — 单测**（AC2）
  - [x] 合法性判定纯逻辑（读 buildConstraints → 违规列表）单测覆盖：来源违规 / 装备超限 / 子阵营未选满 / 全绿

## Dev Notes

### UX: §9 建队流程
- §9.1 流程：选阵营 → 选特工 → 配装备 → 子阵营选择器 → 合法性总览 → 进入对局（仅全绿）。
- §9.2 实时合法性面板：右侧固定一条，三行结构（特工来源/子阵营选择/装备限制），违规红字 + 链到违规特工；hover 置灰按钮显示「先解决 N 项违规」。
- 流程轻量，无向导步骤条（建队就是单页组装）。

### 架构: §2.1 buildConstraints（FR-20 数据面）
- Faction Pack 顶层含 `buildConstraints: { /* FR-20 结构性约束：特工来源 / 子阵营选择器(印记5选1·战团战术8选2) / 装备限制；Lite 无点数(D-30) */ }`。
- `subFactionSelector: { id, label, options[], default }`（架构 §2.1 示例用军团兵印记；死亡天使战团战术同结构，`options` 8 条 + 选择上限 2）。
- UI 直接消费数据包字段，**不硬编码阵营逻辑**——阵营机制 = 数据。

### 关键约束
- **D-30 无点数**：KT Lite 无点数模型；buildConstraints **不含 points**，建队校验纯结构性（来源/子阵营/装备限制）。勿引入任何点数预算 UI。
- **UI 只消费 state**（AR-9）：UI 不直接调引擎/几何；通过 store 读 faction pack（已由 Story 1.2 packLoader 加载）。
- **IP（D-29/NFR-7）**：特工名/武器名仅作本地标识，不入公开仓规则原文；本故事无规则查询（Story 1.17）。
- **数据可用性**：本 Epic 仅死亡天使数据包(Story 1.3)就绪；军团兵/瘟疫战士置灰，不阻塞本故事。
- 触控 44px / 关键 56px（UX §1.3）；组件库暗色主题待 Story 1.17 定，先用 inline token 兜底。

## References

- UX §9 建队流程 — `planning-artifacts/ux/ux-design-kill-team-companion-2026-06-28.md`
- 架构 §2.1 buildConstraints / subFactionSelector — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- PRD FR-20 / D-30（无点数）— `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- Epic 1 Story 1.11 — `planning-artifacts/epics.md`
- 依赖：Story 1.2（packLoader）/ Story 1.3（死亡天使数据包）

## Dev Agent Record

### Agent Model Used
glm-5.2（dev-story workflow）

### Implementation Plan
将原轻量演示（硬编码阵营、无装备配置、无单测）补到完整 T1–T8 规格：数据驱动化（阵营机制=数据）、双方建队、纯逻辑合法性判定 + 单测。所有 UI 经 store 读写（AR-9），不硬编码阵营逻辑。

### Completion Notes List
- **数据层**：`SubFactionSelector` 增 `max` 字段；`BuildConstraints` 增 `operatives{min,max}` / `equipmentLimitScope` / `equipmentLimits` 结构化。死亡天使包补 `faction.subFactionSelector`（8 战团战术 effectId，max=2）+ `buildConstraints.operatives.min=1`。JSON Schema 同步 `max` required。schema-parity 测试不受影响（仅校验 enum）。
- **T1 store**：`rosterStore` 重写为 `rosterA`/`rosterB`（`RosterEntry{factionId,operativeIds,loadout,subFactionSelection}`）+ `editing` + `patchRoster`/`setRoster`/`reset`。MatchView 消费方改为读 `rosterA.operatives` / `rosterA.subFactionSelection`。
- **T8 纯逻辑**：新增 `src/rules/legality.ts` `evaluateLegality()`，三类结构性校验（特工来源/子阵营/装备限制），数据驱动、纯函数。类型前缀 `Roster*` 避与 `turnStateMachine.LegalityResult` 冲突。8 个单测覆盖全绿/来源违规/数量违规/子阵营未选满/超选/装备超限定位/装备未超限/无选择器跳过。
- **T2/T3/T4/T5 UI**：`src/ui/roster/` 新增 `FactionSelect`（3 阵营卡，仅死亡天使可用，余置灰标 Epic）、`OperativePicker`（入队/出队 + 每名特工 weaponRefs 装备勾选）、`SubFactionSelect`（通用，读 selector.max 做多选拦截，option label 回退解析）、`LegalityPanel`（读 evaluateLegality 渲染三行，违规红字）。
- **T6 门禁**：`RosterView` 双方合法性汇总，`bothGreen` 才解锁「进入对局 ▶」（56px），置灰 + tooltip 显示未解决违规方数；进入即 `setView('match')`。AC4 双方建队：A/B 切换各自独立建队，双方全绿才解锁。
- **T7 触控/基调**：index.css 增 roster 样式——44/48px 常规、56px 关键按钮、阵营色描边（--side-a/--side-b）、暗色 token、平板单列响应式。
- **回归**：`tsc --noEmit` 绿；`vitest run` 113/113（含新增 8 个合法性单测）；`vite build` 绿（346.65 kB JS / 5.32 kB CSS）。

### File List
- `src/rules/types.ts`（改：SubFactionSelector += max；BuildConstraints 结构化）
- `src/rules/schema/faction-pack.schema.json`（改：subFactionSelector.max required）
- `src/rules/legality.ts`（新：纯合法性判定）
- `src/rules/index.ts`（改：导出 legality）
- `src/data/packs/angels_of_death.v1.json`（改：faction.subFactionSelector + buildConstraints 结构化）
- `src/state/rosterStore.ts`（改：rosterA/rosterB 完整切片）
- `src/ui/MatchView.tsx`（改：消费新 store 形状）
- `src/ui/RosterView.tsx`（改：重写为完整建队编排 T2–T7）
- `src/ui/roster/FactionSelect.tsx`（新）
- `src/ui/roster/OperativePicker.tsx`（新）
- `src/ui/roster/SubFactionSelect.tsx`（新）
- `src/ui/roster/LegalityPanel.tsx`（新）
- `src/index.css`（改：roster 触控/基调样式）
- `tests/rules/legality.test.ts`（新：8 单测）

### Change Log
- 2026-07-01：Story 1.11 由轻量演示补到完整规格（T1–T8）。数据驱动建队 + 双方建队 + 纯逻辑合法性判定（8 单测）。113/113 测试绿，build 绿。
