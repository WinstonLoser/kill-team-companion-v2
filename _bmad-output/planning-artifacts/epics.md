---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md
  - _bmad-output/planning-artifacts/ux/ux-design-kill-team-companion-2026-06-28.md
---

# Kill Team 战棋助手 - Epic Breakdown

## Overview

本文把 PRD（FR-1..FR-27，FR-19 移除）、架构、UX 设计拆解为可实现的 epic/story。遵循垂直切片优先（架构 §11）：首个 epic = 核心规则 + 1 阵营端到端跑通，再扩 2/3 阵营。

## Requirements Inventory

### Functional Requirements

- **FR-1**: 特工状态托管——持续持有耐伤/受伤受创/命令/就绪待机/生效 effect 及剩余转折点/装备/阵营子标识；回合推进自动让 effect 到期。
- **FR-2**: 两层属性模型 + 效果栈——区分基础值（含持徽手类非修正调整）与修正；修正标注类型与叠加性（可叠/同源唯一/不与受创叠/条件触发）。
- **FR-3**: 骰源无关结算——接受电子投或物理骰手动录入，二者进入同一修正流水线，结果一致。
- **FR-4**: 射击结算流水线——10 步（前置检查→攻击骰→命中修正→保留→重掷/升级→防御骰→穿刺/掩护豁免→抵挡分配→造伤→减免+伤亡），修正按序插入，每步可展开依据。
- **FR-5**: 近战结算流水线——7 步（目标选择→武器选择→同时掷骰→轮流结算出击/格挡→格挡规则→造伤减免→后效）。
- **FR-6**: 阵营机制编码——军团兵混沌印记、死亡天使战团战术+战斗条令、瘟疫战士毒素+恼人韧性，各接正确流水线步骤。
- **FR-7**: 效果叠加规则编码——集中强制 12 条明示叠加/判定规则（同类升级不叠、同源减伤每骰上限、不与受创叠等）。
- **FR-8**: 棋盘状态托管（自由坐标）——持有特工位置（底座圆+朝向，r 取自 base.diameterMm）与地形几何（多边形+类型+vantage/climbable）。
- **FR-9**: 可见/掩护/遮挡/射程/控制范围计算——基于自由坐标几何；咨询式（advisory）+ 玩家可翻转。
- **FR-10**: 有效目标资格判定——综合命令+可见+掩护+遮挡+射程+控制范围内无己方；不合法说明缺哪条。
- **FR-11**: 回合/激活状态机——4 转折点 ×（战略+交战阶段）、先手权、CP 发放、就绪待机翻转、交替激活、反应、计谋次数。
- **FR-12**: 行动合法性——AP≤APL、同激活不重复同行动、后撤后禁转移/冲锋、隐匿或控制范围内禁射击、近战需敌方在控制范围内、阿斯塔特双近战/双射击。
- **FR-13**: 「攻击该目标」一击交互——点目标→资格判定→自动选射击/近战流水线→出伤亡，不切屏。
- **FR-14**: 先验合法性拦截——结算/行动前先验合法性与前置条件，不合法则拦截并解释。
- **FR-15**: push 式推进——引擎主动提示当前该做什么（该谁激活/可选行动/待结算），玩家确认。
- **FR-16**: 单步回滚——任意结算/回合动作可单步前进/暂停/撤销（会话内）。
- **FR-17**: 结算日志/回放——每次结算留痕（输入骰/每步修正来源/抵挡/减免/结果），任意历史步骤可回看。
- **FR-18**: 单屏共用（全公开）——一台设备共用，双方信息全公开可见，仅提示当前主动玩家；不隐藏信息。
- **FR-19**: ~~跨设备存档~~（已移除——v1 不做存档/持久化，D-20）。
- **FR-20**: 建队与约束校验（结构性，无点数 D-30）——特工来源+子阵营选择器（印记5选1/战团战术8选2）+装备限制，非法即报错。
- **FR-21**: data-driven 规则数据——规则以 JSON 数据包加载，引擎逻辑与数据分离；加阵营/版本/勘误=改数据包。
- **FR-22**: 首发 3 阵营 + KT Lite（结构化数据，无 GW 原文 D-29）——军团兵/死亡天使/瘟疫战士 + KT Lite 核心规则结构化计算数据。
- **FR-23**: 规则查询（参数化，无原文 D-29）——任意关键词/effect/武器内联查询，显示引擎参数化要点，不显示 GW 原文。
- **FR-24**: 部署阶段——双方降落区交替部署建队特工；非法位置拦截。
- **FR-25**: 目标点与控制——放置目标点；按控制范围+友方数量优势判定各方控制数。
- **FR-26**: VP 得分——每转折点结束按控制目标点数结算双方 VP，累加。
- **FR-27**: 胜负判定——4 转折点结束 VP 总高者胜，含平局规则。

### NonFunctional Requirements

- **NFR-1**: 规则正确性（头号）——引擎对已编码交互的输出须与规则源一致；任何算错视为缺陷。
- **NFR-2**: 离线/无后端——纯客户端，加载后离线可用；状态仅会话内内存，刷新即重置（D-20）。
- **NFR-3**: 性能——单次结算即时反馈；状态存取快速；实时几何渲染在密集板可接受帧率。
- **NFR-4**: 可审计——所有结算单步可回滚+日志回放，贯穿全程。
- **NFR-5**: 规则准确性护栏——规则/几何遇歧义→咨询式或人工裁定，绝不静默猜（D-17/D-24）。
- **NFR-6**: 数据维护——规则数据版本化；勘误经数据包更新，不改代码（D-23 单一 Lite 规则集）。
- **NFR-7**: IP——公开仓库；数据包仅结构化计算数据，不含 GW 原文；docs/rules 本地 .gitignore（D-29）。
- **NFR-8**: 平台——静态 Web SPA，GitHub Pages 部署，无后端；响应式桌面浏览器 + 平板（768-1024+）。
- **NFR-9**: 触控友好——最小可点击 44px，关键操作 56px（平板 pass-and-play）。

### Additional Requirements

（来自架构文档，影响实现）

- **AR-1 技术栈**：TypeScript strict + React 18 + Vite + Zustand（状态/快照）+ XState（分层回合状态机）+ seedable PRNG（Mulberry32，电子骰 seed 入日志）。**Greenfield，无现成 starter 模板**（Epic 1 Story 1 = 脚手架）。
- **AR-2 构建/部署**：Vite build → GitHub Actions → GitHub Pages；hash 路由（零配置，AQ-7）。
- **AR-3 测试**：Vitest（引擎/几何/enforcer 单测高覆盖）+ Playwright（端到端结算流程）+ **golden resolution tests**（每阵营机制一条金样，正确性护栏，D-24）。
- **AR-4 规则数据 schema**：effect 描述符四问（trigger.point/pipelineStep/modifier.kind/stacking.policy）；16 种 modifier.kind；6 种 stacking.policy；触发点枚举；JSON Schema + TS 类型同源校验。
- **AR-5 结算引擎**：可组合 step 纯函数（统一签名）+ 两层属性（base 不可变 + modifiers 留痕）+ 集中 enforcer（12 条叠加规则按 policy 强制）。
- **AR-6 几何**：自由坐标，原生算法（线段-多边形/点-多边形/圆-距离），零重依赖；咨询式 advisory + 宽松 epsilon 带（~0.25"）+ 玩家可翻转 finding。
- **AR-7 骰源无关输入层**：DiceSource 接口（ElectronicDiceSource seedable / ManualDiceSource），统一 DiceRoll[]。
- **AR-8 信任**：结算步骤日志（受限 event sourcing），StepRecord 含 inputs/diceRolls/appliedEffects/rulings/output。
- **AR-9 模块边界**：src/engine、geometry、rules、dice 为纯逻辑零 UI 依赖；src/ui 只消费 src/state（Zustand store）。
- **AR-10 目录结构**：src/{engine,geometry,rules,state,dice,ui,data/packs}；packs 含 core.kt-lite + 3 阵营 + maps/。
- **AR-11 地图**：MapPack（bounds/terrain/objectives/dropZones）预设模板为主源；自定义手画会话内（D-28）。
- **AR-12 底座大小**：operative.base.diameterMm（GW 约定 25/28.5/32/40mm，规则源不提供，D-27）。
- **AR-13 实现顺序**：垂直切片优先（核心+1 阵营端到端跑通验证数据模型/enforcer 后再扩）；数据编写是关键路径（D-24）。

### UX Design Requirements

- **UX-DR1 响应式对局布局**：桌面 ≥1280 三栏（棋盘 ~58% / 状态+指挥+单位 ~22% / 流水线+日志 ~18%）；平板 768-1024 堆叠（棋盘上/控制下/结算时底部抽屉上滑）。单屏全公开无 Tab 切换。
- **UX-DR2 一击交互流**：选攻击方→选目标→资格判定反馈（零模态零切屏）→骰源切换→流水线分步展开（默认折叠结论行+▾依据）→确认伤亡（唯一强制确认点）。
- **UX-DR3 push 式行动指挥区（Action Bar）**：固定可见，永远一个主操作大按钮 + 1-3 次操作；结束类按钮附「之后会发生什么」微提示。
- **UX-DR4 先验合法性拦截**：拦截卡（Interceptor Card，列每条缺失条件+规则要点链接）+ 行动限制类按钮置灰 tooltip。
- **UX-DR5 棋盘交互**：特工拖放放置/移位（实时英寸数）+ 朝向；画地形工具（矩形/多边形/属性标签：阻碍LOS/掩护/飞蝇云/困难/可攀爬/制高点）；LOS 射线/射程环/控制范围圈可视化。
- **UX-DR6 几何咨询式内联翻转**：每项几何 finding 内联可单击翻转假设，歧义标⚠但无弹框不阻断，翻转后资格实时重算，全入日志。
- **UX-DR7 可审计 UX**：流水线每步单步回滚控件 + 日志回放面板（筛选/回放/回滚到此）+ 每步依据展开（规则要点+输入+推导链+来源）。
- **UX-DR8 物理骰录入浮层**：6 面网格点选累加，总数达标才确认（规避键盘）；电子/物理骰源就近切换。
- **UX-DR9 建队流程**：选阵营→选特工（阵营列表）→装备配置→子阵营选择器（印记/战团战术）→合法性面板（结构性无点数）→进入对局（仅全绿）。
- **UX-DR10 开局准备**：地图模板网格选择（缩略图+预览+载入）/ 自定义画地形；部署阶段拖放到降落区 + 交替部署（色带切换）。
- **UX-DR11 目标点/VP/胜负可视化**：目标点菱形+控制范围圈+控制归属染色（实时）；状态带 VP 常驻 + TP 结束计分动效；4TP 结束全屏胜负结果页。
- **UX-DR12 状态反馈**：effect 剩余 TP 显示 + 到期 push；受伤/受创/残废阈值视觉+自动修正；主动玩家色带横扫切换（不弹模态）。
- **UX-DR13 视觉基调（D-31 后置美学）**：深色中性底 + 双阵营冷暖分色 + 强调色给注意态 + 等宽紧凑流水线 + 动画仅因果。v1 用组件库暗色主题兜底，纯美学后置。
- **UX-DR14 人工裁定卡（兜底）**：v1 大概率不触发（Lite 缺口已排除 D-23），仅留实现期发现真歧义时的裁定卡模板。
- **UX-DR15 触控友好**：最小可点击 44px，关键操作（投骰/确认伤亡/回滚）56px；可点击区与可读区分离。

### FR Coverage Map

- FR-1: Epic 1 — 特工状态托管
- FR-2: Epic 1 — 两层属性模型 + 效果栈
- FR-3: Epic 1 — 骰源无关结算
- FR-4: Epic 1 — 射击结算流水线
- FR-5: Epic 1 — 近战结算流水线
- FR-6: Epic 1（死亡天使）+ Epic 2（军团兵）+ Epic 3（瘟疫战士）— 阵营机制编码
- FR-7: Epic 1 — 效果叠加规则编码
- FR-8: Epic 1 — 棋盘状态托管（自由坐标）
- FR-9: Epic 1 — 可见/掩护/遮挡/射程/控制范围计算
- FR-10: Epic 1 — 有效目标资格判定
- FR-11: Epic 1 — 回合/激活状态机
- FR-12: Epic 1 — 行动合法性
- FR-13: Epic 1 — 「攻击该目标」一击交互
- FR-14: Epic 1 — 先验合法性拦截
- FR-15: Epic 1 — push 式推进
- FR-16: Epic 1 — 单步回滚
- FR-17: Epic 1 — 结算日志/回放
- FR-18: Epic 1 — 单屏共用（全公开）
- FR-19: ~~移除~~（v1 不做存档，D-20）
- FR-20: Epic 1 — 建队与约束校验（结构性）
- FR-21: Epic 1 — data-driven 规则数据
- FR-22: Epic 1（核心 + 死亡天使）+ Epic 2（军团兵）+ Epic 3（瘟疫战士）— 首发 3 阵营数据
- FR-23: Epic 1 — 规则查询（参数化）
- FR-24: Epic 1 — 部署阶段
- FR-25: Epic 1 — 目标点与控制
- FR-26: Epic 1 — VP 得分
- FR-27: Epic 1 — 胜负判定

## Epic List

### Epic 1: 核心引擎 + 死亡天使完整对局（垂直切片）
玩家用**死亡天使**打完一整局：建队 → 选预设图 → 部署 → 激活/移动 → **射击 + 近战结算**（引擎正确，含 12 条叠加规则 + 8 战团战术 + 战斗条令）→ 目标点控制 / VP / 胜负，全程单屏共用 + 可审计。**验证数据模型 + 引擎 + 几何 + UI 端到端跑通**；配 golden resolution tests。
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6(死亡天使), FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-20, FR-21, FR-22(核心+死亡天使), FR-23, FR-24, FR-25, FR-26, FR-27

### Epic 2: 军团兵扩展
加入**军团兵**：数据包（特工 / 武器 / 混沌印记 5 选 1 / effect / 计谋 / 装备）+ golden tests + 必要时扩展谓词/modifier 枚举（AQ-3 盘点）。两阵营可对战。
**FRs covered:** FR-6(军团兵), FR-22(军团兵) 扩展

### Epic 3: 瘟疫战士扩展
加入**瘟疫战士**：数据包（毒素指示物 / 恼人韧性 / effect / 计谋 / 装备）+ golden tests + 必要谓词扩展。三阵营全齐。
**FRs covered:** FR-6(瘟疫战士), FR-22(瘟疫战士) 扩展

### Epic 4: 打磨与 NFR 加固（可选）
平板手势冲突调优、实时几何渲染性能、hash 路由、Service Worker 离线、视觉基调收口（D-31 后置美学）。无新 FR，纯 NFR 加固。
**FRs covered:** 无新 FR（NFR-3/8 + UX-OQ 实现）

### Epic 5: 引擎架构层强化（架构层 effect 落地）
Epic 2/3 阵营数据落地后，6 个 effect 仍为 CUSTOM_HOOK 描述符——它们要的不是数据/流水线 step，而是**新引擎子系统**（activation AP / movement / 计谋状态追踪 / stat 覆写 / predicate-cost）。这些层是跨阵营水平能力：建好后军团兵 + 瘟疫战士 + 后续阵营的等价 effect 一并解锁。源自 Epic 1 评审 deferred 项（W3）+ Epic 2 评审 Defer，经 Epic 3（亦数据向）仍未有着落，故独立成 epic。
**FRs covered:** FR-2（两层属性模型扩 stat 覆写）、FR-7（叠加规则在 activation/movement 层延续）、FR-12（行动合法性接 activation effect）、FR-17（架构层 effect 留痕）；新增引擎子系统 FR 待 Story 5.x 细化。

## Epic 1: 核心引擎 + 死亡天使完整对局（垂直切片）

玩家用死亡天使打完一整局（建队→选图→部署→激活/移动→射击+近战结算→目标点/VP/胜负），单屏共用+可审计，验证数据模型+引擎+几何+UI 端到端跑通。

### Story 1.1: 项目脚手架与构建部署

As a 构建者,
I want 一个可运行的 React+TS 骨架并自动部署到 GitHub Pages,
So that 后续故事有稳定基底且发布零摩擦。

**Acceptance Criteria:**

**Given** 已 git push 到 main **When** CI 运行 **Then** GitHub Actions 执行 install/test/build 并发布到 Pages **And** 访问 `<user>.github.io/<repo>` 能加载应用。
**Given** 应用加载 **When** 用户刷新 **Then** hash 路由不 404 **And** 目录含 `src/{engine,geometry,rules,state,dice,ui,data}`。
**Given** 任意源文件 **When** 运行 `npm test/build` **Then** TS strict 通过、Vitest 可跑、无 `any` 泄漏。

### Story 1.2: 规则数据 schema 与 packLoader

As a 引擎,
I want 声明式规则数据 schema 与加载器,
So that 规则以 JSON 数据包存在、引擎逻辑与数据分离。

**Acceptance Criteria:**

**Given** 一个 faction pack JSON **When** packLoader 加载 **Then** 用 JSON Schema(TS 同源)校验结构 **And** 非法则拒绝并报错、不静默降级。
**Given** effect 描述符 **When** 解析 **Then** 必含 `trigger.point/pipelineStep/modifier.kind/stacking.policy` 四字段 **And** 缺一即拒绝。
**Given** `rulesetVersion` 字段 **When** 与引擎版本不匹配 **Then** 提示版本不兼容。

### Story 1.3: 死亡天使数据包与 golden tests 框架

As a 引擎,
I want 死亡天使完整结构化数据包 + golden 测试框架,
So that 引擎能跑死亡天使机制且正确性可验证。

**Acceptance Criteria:**

**Given** 数据包 **When** 加载 **Then** 含特工/武器/8 战团战术/战斗条令/计谋/装备 **And** 全部为结构化数据、无 GW 原文。
**Given** golden test 框架 **When** 跑死亡天使金样 **Then** 每条机制（猛攻撕裂/决斗家格挡/强健/钢铁光环忽略一次伤害/战斗条令平衡等）输入→期望输出断言通过。
**Given** 数据包 **When** 含名称（死亡天使/爆矢等）**Then** 仅作本地标识 **And** `docs/rules` 不入公开仓库。

### Story 1.4: 两层属性模型与集中 enforcer

As a 引擎,
I want 基础值+修正两层属性与集中叠加规则强制器,
So that 属性叠加正确、12 条叠加规则集中可测。

**Acceptance Criteria:**

**Given** 特工属性 **When** `resolveStat` **Then** 返回 `base + Σ(经 enforcer 过滤的 modifiers) = effective` **And** base 运行期不可变。
**Given** 多条同源修正 **When** enforcer 过滤 **Then** 按 `stacking.policy`（可叠/同源唯一/同组唯一/互斥/条件/每骰上限）去重/互斥/封顶。
**Given** 12 条叠加规则场景（严重抑制撕裂、命中-1 不与受创叠、同源减伤每骰上限 1）**When** 触发 **Then** enforcer 按 policy 正确强制 **And** 全部单测覆盖。

### Story 1.5: 骰源无关输入层

As a 引擎,
I want 电子骰与物理骰走同一接口,
So that 结算逻辑不感知骰源、结果一致可复现。

**Acceptance Criteria:**

**Given** `ElectronicDiceSource` **When** `roll(n)` **Then** 用 seedable PRNG **And** seed=`(pipelineId,stepId,attempt)` 入日志、结果可复现。
**Given** `ManualDiceSource` **When** 玩家录入物理骰结果 **Then** 产出同结构 `DiceRoll[]`。
**Given** 任一骰源 **When** 进入流水线 **Then** 后续重掷/升级对两源一致。

### Story 1.6: 射击结算流水线

As a 引擎,
I want 10 步射击结算流水线,
So that 一次射击从掷骰到伤亡按规则正确结算。

**Acceptance Criteria:**

**Given** 合法射击 **When** 执行流水线 **Then** 按 10 步顺序推进（前置检查→攻击骰→命中修正→保留→重掷/升级→防御骰→穿刺/掩护豁免→抵挡分配→造伤→减免+伤亡）**And** 每步写 StepRecord。
**Given** 各步 effect **When** 执行 **Then** 按 `trigger.point` 接入正确 step **And** 经 enforcer 过滤。
**Given** 流水线 **When** 任一步暂停/前进 **Then** 游标正确移动 **And** 输出伤亡 + 每步依据。

### Story 1.7: 近战结算流水线

As a 引擎,
I want 7 步近战结算流水线（含轮流结算）,
So that 近战出击/格挡/震荡/后效按规则正确。

**Acceptance Criteria:**

**Given** 合法近战 **When** 双方掷骰后 **Then** 从攻击方轮流结算 **And** 每枚成功选出击或格挡、各成子决策记日志。
**Given** 决斗家/残暴/震荡 **When** 格挡分配 **Then** 按规则矩阵（普通挡关键/只能关键挡/震荡舍弃）正确。
**Given** 近战 **When** 造伤+减免 **Then** 复用射击减免与后效（灵魂盛宴等）**And** 输出伤亡。

### Story 1.8: 自由坐标几何与资格判定

As a 引擎,
I want 自由坐标几何（LOS/掩护/遮挡/射程/控制范围）与有效目标资格判定,
So that 资格判定基于几何且歧义透明交玩家。

**Acceptance Criteria:**

**Given** 棋盘状态（特工底座圆+地形多边形）**When** 计算 LOS/掩护/遮挡/射程/控制范围 **Then** 各产出 `GeometryFinding(value/confidence/margin)`。
**Given** finding 落在 epsilon 带（~0.25"）**When** 标记 **Then** confidence=AMBIGUOUS **And** 默认套 value 但可被玩家翻转、翻转入日志。
**Given** 攻击意图 **When** 资格判定 **Then** 综合命令+可见+掩护+遮挡+射程+控制范围内无己方 **And** 不合法则说明缺哪条（先验拦截）。

### Story 1.9: 回合/激活状态机与行动合法性

As a 引擎,
I want 分层回合状态机（XState）与行动合法性 guard,
So that 4 转折点×阶段、交替激活、行动限制正确推进。

**Acceptance Criteria:**

**Given** 战斗开始 **When** 推进 **Then** 经 部署→转折点（战略+交战）→交替激活→TP 结束（effect 到期+VP）→…→BATTLE_END。
**Given** 激活特工 **When** 选行动 **Then** guard 校验 AP≤APL/同激活不重复同行动/后撤后禁转移冲锋/隐匿或控制范围内禁射击/近战需敌方在控制范围/阿斯塔特双近战双射击 **And** 非法则拦。
**Given** CP 与计谋 **When** 使用 **Then** 追踪 perBattle/perTurningPoint 次数 **And** 超限拦截。

### Story 1.10: 结算日志、单步回滚与回放

As a 玩家,
I want 结算全程留痕可单步回滚与回放,
So that 算错可逆、争议可查。

**Acceptance Criteria:**

**Given** 任一结算 **When** 每步执行 **Then** append `StepRecord`（inputs/diceRolls/appliedEffects/rulings/output）到 ResolutionLog。
**Given** 日志 **When** 玩家回滚某步 **Then** 丢弃其后步骤、从该步 inputs 快照恢复（会话内）**And** 棋盘状态同步回退。
**Given** 历史 ResolutionLog **When** 回放 **Then** 按步骤重演 **And** 每步可展开骰/生效 effect/被拒 effect/人工裁定/输出。

### Story 1.11: 建队流程

As a 玩家,
I want 用死亡天使建队并实时校验合法性,
So that 进对局前阵容合规。

**Acceptance Criteria:**

**Given** 建队界面 **When** 选阵营→选特工→配装备→选战团战术 8 选 2 **Then** 实时显示合法性面板（特工来源/子阵营选择/装备限制）**And** 无点数（D-30）。
**Given** 违规（如重武器超限）**When** 发生 **Then** 红字定位违规特工 **And** 进入对局按钮置灰。
**Given** 全绿阵容 **When** 点进入对局 **Then** 进入开局准备。

### Story 1.12: 开局准备——选图、画地形、部署

As a 玩家,
I want 选预设地图/画地形并交替部署特工,
So that 开局棋盘就绪。

**Acceptance Criteria:**

**Given** 进入对局 **When** 选地图 **Then** 预设模板网格可选+预览+载入（地形/目标点/降落区）**Or** 空白板自定义画。
**Given** 自定义画 **When** 用工具（矩形/多边形/属性标签/目标点/降落区）**Then** 生成 terrain/objectives/dropZones **And** 会话内有效（D-20）。
**Given** 部署阶段 **When** 双方交替拖特工到己方降落区 **Then** 落子显示底座+朝向 **And** 出区/重叠拦截 **And** 全部署完进入 TP1。

### Story 1.13: 对局主界面、push 指挥区与一击交互

As a 玩家,
I want 单屏对局界面 + push 提示 + 一击结算交互,
So that 点目标即完成结算、不切屏。

**Acceptance Criteria:**

**Given** 对局 **When** 显示 **Then** 桌面三栏（棋盘/状态+指挥+单位/流水线+日志）、平板堆叠 **And** 单屏全公开无 Tab（D-19）。
**Given** 当前回合状态 **When** push **Then** 行动指挥区显示一个主操作大按钮 + 1-3 次操作（该谁激活/可选行动/待结算）**And** 色带标主动玩家。
**Given** 选攻击方 + 点目标 **When** 资格通过 **Then** 零模态进入流水线（射击/近战二选一 chips 或直入）**And** 骰源就近切换 **And** 唯一强制确认=确认伤亡。

### Story 1.14: 棋盘交互与几何可视化

As a 玩家,
I want 拖放特工/画地形并看 LOS/射程/控制圈,
So that 棋盘操作低成本且几何可见。

**Acceptance Criteria:**

**Given** 棋盘 **When** 拖特工 **Then** 实时显示移动英寸数 **And** 落定更新位置、双击旋转朝向。
**Given** 选中攻击方 + 悬停目标 **When** 计算 **Then** 画 LOS 射线（受阻红/通畅绿）、武器射程环、控制范围圈。
**Given** 几何 finding **When** 歧义 **Then** 内联可翻转假设（⚠可翻转）**And** 翻转后资格实时重算、不弹框。

### Story 1.15: 可审计 UI 与状态反馈

As a 玩家,
I want 每步可回滚 + 日志回放 + 状态反馈,
So that 信任引擎结果、effect/受创可见。

**Acceptance Criteria:**

**Given** 流水线每步 **When** 显示 **Then** 有回滚此步控件 + ▾依据展开（规则要点+输入+推导链+来源）。
**Given** 日志面板 **When** 筛选/回放/回滚到此 **Then** 按时间倒序列结算与回合动作 **And** 可重演。
**Given** effect/受创/主动玩家 **When** 状态变化 **Then** 单位卡显示剩余 TP/受创阈值自动修正/主动玩家色带横扫切换。

### Story 1.16: 目标点、VP 与胜负 UI

As a 玩家,
I want 目标点控制 + VP 计分 + 胜负判定,
So that 占领任务能打完判输赢。

**Acceptance Criteria:**

**Given** 棋盘目标点 **When** 特工进出控制范围 **Then** 菱形+控制圈染色实时反映控制方（A/B/中立）**And** 悬停显示范围内双方数量。
**Given** TP 结束 **When** 结算 **Then** 各方按控制目标点数 VP+N（计数跳动+图标脉冲）**And** 状态带 VP 常驻。
**Given** 4TP 结束 **When** 判定 **Then** 全屏结果页 VP 总高者胜（含平局规则）**And** 再开一局=刷新重置。

### Story 1.17: 规则查询与触控/视觉兜底

As a 玩家,
I want 内联规则查询 + 触控友好 + 暗色主题,
So that 查询零摩擦、平板好用、v1 有可读基调。

**Acceptance Criteria:**

**Given** 任意关键词/effect/武器 **When** 内联查询 **Then** 显示引擎参数化要点（数值/profile/触发步骤）**And** 不显示 GW 原文（D-29）。
**Given** 触控目标 **When** 操作 **Then** 最小 44px/关键 56px **And** 可点击区与可读区分离。
**Given** 应用 **When** 加载 **Then** 套组件库暗色主题（深色底+双阵营分色+强调色给注意态）**And** 美学后置（D-31）。

## Epic 2: 军团兵扩展

加入军团兵，两阵营可对战。

### Story 2.1: 军团兵数据包与机制接入

As a 玩家,
I want 用军团兵建队并对战,
So that 阵营池扩到 2 个。

**Acceptance Criteria:**

**Given** 军团兵数据包 **When** 加载 **Then** 含特工/武器/混沌印记 5 选 1/计谋/装备（结构化无原文）。
**Given** 军团兵机制（恐虐严重/纳垢恼人生命力/色孽移动/奸奇远程严重/无分无休 + 释放恶魔/灵魂盛宴等）**When** 接入引擎 **Then** 各 effect 挂正确 step **And** 经 enforcer。
**Given** 军团兵金样 **When** 跑 golden tests **Then** 每机制输入→期望输出通过。

### Story 2.2: 谓词/modifier 扩展盘点

As a 引擎,
I want 盘点军团兵是否需新谓词/modifier,
So that data-driven 纯度保持（AQ-3）。

**Acceptance Criteria:**

**Given** 军团兵数据包 **When** 编写 **Then** 尽量复用现有 16 modifier/6 policy/谓词库 **And** 需新谓词则记入谓词库并单测。
**Given** 任何新谓词 **When** 加入 **Then** 文档化封闭性 **And** 标注是否需代码改动。

## Epic 3: 瘟疫战士扩展

加入瘟疫战士，三阵营全齐。

### Story 3.1: 瘟疫战士数据包与机制接入

As a 玩家,
I want 用瘟疫战士建队并对战,
So that 三阵营全齐。

**Acceptance Criteria:**

**Given** 瘟疫战士数据包 **When** 加载 **Then** 含特工/武器/毒素指示物规则/恼人韧性/计谋/装备（结构化无原文）。
**Given** 瘟疫机制（毒素指示物流程结束时获得+激活受 1 伤/剧毒/恼人韧性 4+/飞蝇云遮挡等）**When** 接入 **Then** 毒素时机=AT_PIPELINE_END 正确（同次攻击剧毒不当次生效）**And** 各 effect 挂正确 step。
**Given** 瘟疫金样 **When** 跑 golden tests **Then** 通过。

### Story 3.2: 谓词扩展盘点

As a 引擎,
I want 盘点瘟疫战士是否需新谓词/modifier,
So that data-driven 纯度保持（AQ-3）。

**Acceptance Criteria:**

**Given** 瘟疫数据包 **When** 编写 **Then** 尽量复用现有枚举/谓词 **And** 需新谓词则记入并单测、文档化封闭性。

## Epic 4: 打磨与 NFR 加固（可选）

NFR 加固与可用性打磨。

### Story 4.1: 平板手势与几何渲染性能

As a 玩家,
I want 平板手势不冲突 + 密集板渲染流畅,
So that 桌上触控体验好。

**Acceptance Criteria:**

**Given** 平板棋盘 **When** 双指缩放/平移 vs 单指拖特工 **Then** 手势优先级明确（UX-OQ-2）**And** 无误触。
**Given** 密集棋盘 **When** 实时 LOS/射程/控制圈 **Then** 帧率可接受 **And** 必要时降级按需显示（UX-OQ-9）。

### Story 4.2: hash 路由与 Service Worker 离线

As a 玩家,
I want 刷新不 404 + 加载后离线可用,
So that 各处稳定用。

**Acceptance Criteria:**

**Given** 应用 **When** 刷新任意 hash 路由 **Then** 不 404（AQ-7）。
**Given** 首次加载 **When** 注册 Service Worker **Then** 后续离线可加载 app-shell（AQ-6，可选）。

### Story 4.3: 视觉基调收口

As a 玩家,
I want v1 视觉基调统一,
So that 桌上易读。

**Acceptance Criteria:**

**Given** 全应用 **When** 套用 **Then** 配色通过色盲模拟、字号阶/间距 token 统一、强调色仅注意态 **And** 美学后置（D-31，可选 `ui-ux-pro-max`）。

## Epic 5: 引擎架构层强化（架构层 effect 落地）

Epic 2/3 数据包落地后，6 个 effect 仍为 `CUSTOM_HOOK` 描述符（军团兵：`chapterTactic_mobile` / `mark_slaanesh` / `strat_swift_speed` / `strat_capricious_fate` / `wargear_warding_armour` / `wargear_chaos_talisman`）。它们缺的不是数据或流水线 step，而是**新引擎子系统**：activation AP、movement resolver、计谋状态追踪、stat 覆写、predicate-cost。这些是跨阵营水平引擎能力——建好后军团兵/瘟疫战士/后续阵营的等价 effect 一并解锁。

**前置**：Story 3.2 谓词库已落地（CONDITIONAL 可求值）；Epic 2 评审 W3 已建 `effectiveApl`（APL_PLUS 消费）/ `withAttachedRules`（ATTACH_WEAPON_RULE 消费）作底。

### Story 5.1: stat 覆写 + activation AP（最小层先跑通）

As a 引擎,
I want 属性覆写层 + activation AP mod 落地,
So that `wargear_warding_armour`（save 2+）与 `chapterTactic_mobile`（后撤 AP-1）不再是描述符。

**Acceptance Criteria:**

**Given** 覆写类 effect（新 `SAVE_OVERRIDE` kind 或 stat-override 通用机制）**When** DEFENCE_ROLL **Then** 豁免阈值用覆写值（守护护甲 2+），走两层模型留痕（FR-2）。
**Given** activation AP effect **When** 构造 `ActionContext.apl` / `ACTION_AP` **Then** AP mod 应用（后撤 AP-1 实际多耗），`effectiveApl` 同模式扩到 AP。
**Given** 两 effect golden **When** 跑 **Then** real（非 CUSTOM_HOOK），CUSTOM_HOOK 剩 4。

### Story 5.2: movement resolver（移动距离模型）

As a 引擎,
I want 移动距离 + modifier 的引擎模型,
So that `mark_slaanesh`（移动 +1）等移动 effect 生效（当前移动全在 UI 棋盘，无引擎模型）。

**Acceptance Criteria:**

**Given** 特工移动 **When** 经 `effectiveMove(baseMove, effects)` **Then** 移动力 = base + Σ 移动 modifier（色孽 +1），合法性按此判（FR-12）。
**Given** 移动 effect **When** 挂 `ON_ACTIVATION_START`/movement step **Then** real（非 CUSTOM_HOOK）。
**Given** UI 棋盘拖拽 **When** 走路径 **Then** 引擎校验总长 ≤ effectiveMove（UI 调引擎，AR-9）。

### Story 5.3: 计谋状态追踪系统（active stratagem）

As a 引擎,
I want 已激活计谋的持续状态追踪 + effect 注入,
So that `strat_swift_speed`（敌方命中-1）/ `strat_capricious_fate`（防御方升级）等持续型计谋在结算时生效。

**Acceptance Criteria:**

**Given** 计谋使用 **When** 记入 active stratagem 状态（带 duration/phase）**Then** 其 effect 注入后续结算的 effect 栈。
**Given** 持续计谋 effect（命中-1 / 防御升级）**When** 结算 **Then** 实际改变命中/防御成功（非描述符），且到期/用尽后自动撤除。
**Given** 两计谋 golden **When** 跑 **Then** real，CUSTOM_HOOK 剩 2。

### Story 5.4: predicate-cost 层（自伤换升级）

As a 引擎,
I want 复用 Story 3.2 谓词库 + cost/替代层,
So that `wargear_chaos_talisman`（自伤 D3 换一次升级）等复杂条件 effect 生效。

**Acceptance Criteria:**

**Given** 复杂条件 effect（带 cost + 谓词条件）**When** 谓词命中 **Then** 玩家可选择支付 cost（自伤 D3）执行替代效果（升级一次），留痕（FR-17）。
**Given** `wargear_chaos_talisman` **When** 2+ 失败 + 关键词匹配 **Then** 触发自伤换升级，real（非 CUSTOM_HOOK）。
**Given** CUSTOM_HOOK 全清零 **When** 盘点 **Then** 剩 0（或诚实标注真正需 UI/人工裁定的残留）。


## Epic 6: 对局流程补全（战略阶段 + 命令 + 反应）

KT Lite 规则定义每个转折点 = 战略阶段 + 交战阶段。当前 app 从部署直接跳到激活特工，**跳过了战略阶段**。本 epic 补全缺失的回合结构。

### Story 6.1: 战略阶段屏幕（先手 D6 + CP 发放 + 全员就绪）

As a 玩家,
I want 每个转折点开始时进入战略阶段——掷 D6 定先手、发 CP、全员就绪,
so that 回合结构与 KT Lite 规则一致。

**AC1（先手权 D6）**：转折点开始时双方各掷 D6（电子骰 seedable FR-17），高者选先手；平局时非先手方决定。首局默认先手 = A 方（部署后）。
**AC2（CP 发放）**：战斗开始各 2CP（已有）；TP1 各 +1CP；TP2+ 先手 +1CP、非先手 +2CP。状态带显示双方 CP。
**AC3（全员就绪）**：战略阶段开始 → 所有存活特工 `ready: true`（turnReducer END_TURNING_POINT 已做，战略阶段确认展示）。
**AC4（战略计谋轮流使用）**：从先手方开始，轮流「使用一个战略计谋 / 跳过」；连续两次跳过 → 进入交战阶段。使用计谋花 1CP（CP 不足灰按钮）。
**AC5（进入交战阶段门禁）**：「进入交战阶段 ▶」按钮，连续两次跳过后可点 → phase 切到 play。

### Story 6.2: 命令选择（激活时选交战/隐匿）

As a 玩家,
I want 激活特工时选择命令（交战或隐匿）,
so that 隐匿命令影响射击资格和移动范围。

**AC1（命令选择器）**：激活特工时（activate），显示命令 radio：交战 / 隐匿。默认交战。
**AC2（隐匿效果）**：隐匿命令的特工不能射击（FR-12）；敌方对其射击需额外条件（FR-10）；移动范围 -1"（隐匿移动）。
**AC3（待机翻转）**：激活结束 → 命令指示物翻到待机面（ready=false 已有）。

### Story 6.3: 反应系统（全员待机后）

As a 玩家,
I want 当我所有特工都待机、对手仍有就绪特工时进行反应,
so that 不会因先手消耗完毕而完全无法行动。

**AC1（反应触发条件）**：检测当前方所有存活特工 `ready === false` + 对手有 `ready === true`。
**AC2（反应行动）**：选一名待机且有交战命令的特工 → 执行 1 个 1AP 行动（消耗 0AP）；每名特工每 TP 限 1 次反应。
**AC3（反应限制）**：反应中移动 ≤ 2"；不能重复同行动。

### Story 6.4: 指挥重掷交战计谋

As a 玩家,
I want 在掷攻击骰或防御骰后使用指挥重掷,
so that 关键时刻可重掷一枚骰（花 1CP）。

**AC1（触发时机）**：流水线 ATTACK_UPGRADE 或 DEFENCE_ROLL 之后，显示「指挥重掷（1CP）」按钮。
**AC2（重掷单骰）**：点击 → 花对方 1CP → 选择一枚骰重掷 → 新结果替换旧结果。
**AC3（使用限制）**：每次结算限 1 次（不可连续重掷同一骰）。
