# Story 1.17: 规则查询与触控/视觉兜底 (rules-query-touch-visuals)

Status: ready-for-dev

## Story

As a 玩家,
I want 内联规则查询 + 触控友好目标尺寸 + 暗色主题基调,
so that 查询零摩擦、平板好用、v1 有可读视觉底。

## Acceptance Criteria

1. **AC1（内联规则查询，无 GW 原文 D-29）**：任意关键词/effect/武器/阵营机制可内联查询（顶栏入口 + 流水线/拦截卡内联跳入）；查询结果**显示引擎参数化要点**（数值/profile/触发步骤/规则编号/rulesRef），**不显示 GW 原文**；`rulesRef` 指向本地 `docs/rules`（不入公开仓）。
2. **AC2（触控友好）**：最小可点击目标 44×44px，关键操作(投骰/确认伤亡/回滚/回放/主操作)56px；可点击区与可读区分离明确（避免误触）；平板横屏可用。
3. **AC3（视觉基调兜底）**：套组件库暗色主题——深色中性底 + 双阵营冷暖分色(A 蓝/B 红)做敌我区分 + 强调色仅给注意态(待激活/待确认结算/人工裁定/effect 到期)；流水线等宽紧凑列表；动画仅因果(状态切换说明)不装饰。美学后置(D-31)。

## Tasks / Subtasks

- [ ] **T1 — 组件库选定 + 暗色主题落地**（AC3）
  - [ ] 选组件库（React 19 兼容、暗色主题、触控友好；候选如 shadcn/ui 风格 + Radix + Tailwind 暗色，或等价），落地到 App 根
  - [ ] 设计 token：深色中性底 + 双阵营冷暖色(A 蓝/B 红) + 强调色(注意态)；色盲安全模拟(UX-OQ-10 基础校验)
  - [ ] 全应用套用（建队/对局/查询三入口）；Story 1.11-1.16 的 inline token 切换为此主题
- [ ] **T2 — 触控尺寸规范落地**（AC2）
  - [ ] 全局 CSS：最小可点击 44px；关键操作 56px（投骰/确认伤亡/回滚/回放/主操作按钮）
  - [ ] 可点击区(padding/hit-area)与可读区(content)分离；按钮 content 居中、hit-area 撑满
  - [ ] 平板横屏适配；竖屏提示「请横屏」(UX-OQ-7 倾向禁用, 本故事做提示)
- [ ] **T3 — 规则查询入口（顶栏 + 内联）**（AC1）
  - [ ] 顶栏 `规则查询` 入口（任意位置一键进入, UX §2.1）
  - [ ] 内联跳入：流水线 `[▾依据]` 的「规则要点」/ 拦截卡 `[查看规则要点 ▸]` / 单位卡 effect → 弹规则查询浮层(UX-OQ-8 倾向浮层 + 「在规则区打开」二级)
  - [ ] 浮层非全屏模态，可一键关回原上下文
- [ ] **T4 — 规则查询引擎接入**（AC1）
  - [ ] 查询输入：关键词 / effectId / weaponId / 阵营机制
  - [ ] 接 `rules/rulesRef` + `effectRegistry` + 关键词索引(架构 §2.7/§7.3)；返回**参数化要点**：数值/stats/profile/触发步骤(pipelineStep)/modifier.kind/stacking.policy/规则编号
  - [ ] **不渲染 GW 原文**（D-29）；`rulesRef:{doc,section}` 显示为「来源: KT Lite §X」占位，指向本地 docs/rules（不入公开仓）
  - [ ] 查询结果用暗色紧凑卡片列表；可读不装饰
- [ ] **T5 — 动画规范落地**（AC3）
  - [ ] 动画仅因果：伤害应用、VP 计分跳动、effect 到期、色带横扫切换（状态切换说明）
  - [ ] 移除/不引入装饰性动画（loading spinner 除外）
- [ ] **T6 — 单测 + 视觉冒烟**（AC1/AC3）
  - [ ] 规则查询参数化要点渲染单测（输入 effectId → 期望字段集, 不含原文）
  - [ ] 触控尺寸/对比度冒烟（关键按钮 hit-area ≥ 目标值）

## Dev Notes

### UX: §1 设计原则与基调
- §1.1 桌上易读优先(50-80cm, 光线不一)；可读性 > 信息密度 > 美观。
- §1.3 触控友好：最小 44px，关键(投骰/确认伤亡/回滚) 56px；可点击区与可读区分离。
- §1.4 可信即采纳：默认呈现引擎结果，怀疑低频不阻塞高频。
- §1.5 单屏全公开(D-19)；§1.6 降级要可见(D-17)；§1.7 刷新即重置(D-20)。
- 视觉基调（§1 末）：深色中性底(降反光) + 双阵营冷暖分色(敌我) + 强调色仅注意态；流水线等宽紧凑；动画仅因果不装饰。**v1 用组件库暗色主题兜底，美学后置(D-31)**。

### 架构: §2.7 关键词索引 / §7.3 规则引用
- §2.7 关键词标签体系(faction/subFaction/operativeType/weaponType/weaponRule/command/status/marker)是 FR-23 内联查询基础。
- §7.3 规则引用(D-29)：effect 描述符带 `rulesRef:{doc,section}` **指向本地 docs/rules**(不入公开仓)；回放/查询显示**引擎参数化要点**(数值/描述符/触发步骤)，**不渲染 GW 原文**。
- `rules/rulesRef.ts`（架构 §9 目录）负责规则原文查询(FR-23)。

### 关键约束
- **D-29 规则查询不显示 GW 原文**：仅引擎参数化要点(数值/profile/触发步骤/rulesRef 占位)；`docs/rules` 本地 .gitignore(Story 1.1)。名称(死亡天使/爆矢等)仅本地标识。
- **D-31 视觉用组件库暗色主题兜底，美学后置**：本故事只交付可读基调，不做精雕视觉(留 Epic 4.3)；选库优先 React 19 兼容 + 暗色 + 触控。
- **NFR-9 触控友好**：44px / 关键 56px 是硬尺寸；可点击区与可读区分离避免误触。
- **UI 只消费 state**（AR-9）：规则查询读 rules 数据层(packLoader/effectRegistry/rulesRef)，不调引擎结算。
- 平板手势优先级/密集板渲染性能留 Story 4.1；横屏锁定(UX-OQ-7)本故事做提示。

## References

- UX §1 设计原则与基调 — `planning-artifacts/ux/ux-design-kill-team-companion-2026-06-28.md`
- 架构 §2.7 关键词索引 / §7.3 规则引用(D-29) / §9 目录(rules/rulesRef.ts) — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- PRD FR-23 / NFR-7 / NFR-9 / D-29 / D-31 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- Epic 1 Story 1.17 — `planning-artifacts/epics.md`
- 依赖：Story 1.2（packLoader/effectRegistry）/ Story 1.3（死亡天使数据, rulesRef）/ Story 1.13-1.15（内联跳入点）

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
