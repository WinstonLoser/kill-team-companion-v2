# Story 1.11: 建队流程 (roster-building)

Status: ready-for-dev

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

- [ ] **T1 — UI 层 roster store 切片**（AC1/AC2/AC4）
  - [ ] Zustand store 增 `rosterA`/`rosterB`：`{ factionId, operativeIds[], loadout: {[opId]: weaponRefs[]}, subFactionSelection: {...} }`
  - [ ] UI 只读写 store，不直接调引擎/数据包；通过 `rules/packLoader` 加载的 faction pack（已缓存在 store）读 buildConstraints
- [ ] **T2 — 选阵营视图**（AC1）
  - [ ] 三阵营卡(军团兵/死亡天使/瘟疫战士)，本 Epic 仅死亡天使数据可用(Story 1.3)，其余置灰标「Epic 2/3」
  - [ ] 分别为 A/B 选；选后进入特工列表
- [ ] **T3 — 选特工 + 装备配置视图**（AC1/AC2）
  - [ ] 阵营特工列表（来自 faction pack `operatives[]`）；`[+添加][-移除]` 入队/出队
  - [ ] 每个入队特工的装备配置：从 `operative.weaponRefs` + `uniqueLoadoutOptions` 选；实时显示总数/关键词/装备计数
- [ ] **T4 — 子阵营选择器（死亡天使战团战术 8 选 2）**（AC1/AC2）
  - [ ] 读 faction pack 的 `buildConstraints.subFactionSelector`（或等价结构）渲染选择器；死亡天使=8 选 2，单阵营组件
  - [ ] 选满 2 才该项 ✓；多选拦截（按数据约束的 `max` 字段）
  - [ ] 通用化：军团兵的印记 5 选 1 在 Epic 2 复用同组件（按 selector 类型 dispatch）
- [ ] **T5 — 合法性面板组件**（AC2/AC3）
  - [ ] 固定右侧（桌面）/底部抽屉（平板），三行：特工来源 / 子阵营选择 / 装备限制
  - [ ] 读 `buildConstraints`（架构 §2.1）逐条算 `{label, status: 'ok'|'warn', detail}`；违规 → 红字 + 定位特工(点跳到对应特工卡)
  - [ ] 全绿才解锁「进入对局 ▶」
- [ ] **T6 — 进入对局门禁 + 路由**（AC3/AC4）
  - [ ] 「进入对局」onClick：校验双方全绿 → store commit 阵容 → 切 `currentView` 到 setup-map-deploy(Story 1.12)
  - [ ] 非全绿：按钮置灰 + tooltip 显示未解决违规数
- [ ] **T7 — 触控与基调兜底**（AC1）
  - [ ] 最小点击区 44px，关键按钮(添加/移除/进入对局) 56px（NFR-9 / UX §1.3）
  - [ ] 套组件库暗色主题（Story 1.17 选定后落地）；阵营色描边区分 A/B
- [ ] **T8 — 单测**（AC2）
  - [ ] 合法性判定纯逻辑（读 buildConstraints → 违规列表）单测覆盖：来源违规 / 装备超限 / 子阵营未选满 / 全绿

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
（dev-story 时填）

### Completion Notes List

### File List
