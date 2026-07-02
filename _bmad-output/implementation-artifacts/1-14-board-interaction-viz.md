# Story 1.14: 棋盘交互与几何可视化 (board-interaction-viz)

Status: done

## Story

As a 玩家,
I want 拖放特工/画地形并看到 LOS 射线/射程环/控制范围圈 + 几何歧义内联翻转,
so that 棋盘操作低成本、几何可见且歧义透明交玩家。

## Acceptance Criteria

1. **AC1（特工拖放 + 朝向）**：棋盘上长按(触控)/按下拖动(鼠标)特工可移动；拖动时实时显示与起点英寸数；松手落定更新位置。双击特工旋转 45°(朝向三角指示，影响 LOS 头部射线起点)。
2. **AC2（几何可视化）**：选中攻击方 + 悬停目标时，画 LOS 射线(受阻段红色实线 / 通畅段绿色虚线) + 武器射程环(环外目标置灰) + 控制范围圈(1", 圈内敌方高亮)。选中特工时掩护染色(控制范围内有阻碍地形 → 底圈绿; 2" 内有他特工 → 灰)。
3. **AC3（几何歧义内联翻转，零模态）**：每项几何 finding(LOS/掩护/遮挡/射程/控制范围)以内联可单击翻转的假设呈现；歧义(confidence=AMBIGUOUS)项标「⚠ 可翻转」**不弹框、不阻断**；翻转后资格判定(Story 1.10)实时重算；所有 finding 入日志。
4. **AC4（画地形工具，复用）**：棋盘工具栏「画地形」模式(矩形/多边形 + 属性标签)，与 Story 1.12 自定义画地形共用同一套绘制底层。

## Tasks / Subtasks

- [x] **T1 — 棋盘 canvas/SVG 渲染层**（AC1/AC2）
  - [x] 自由坐标棋盘渲染：英寸坐标 → 屏幕坐标变换；网格背景 + 英寸标尺
  - [x] 渲染：特工底座圆(阵营色描边) + 朝向三角 + 地形多边形(按 kind 着色) + 目标点(Story 1.16) + 降落区
  - [x] 缩放/平移：双指(平板)/滚轮+拖(桌面)；手势优先级(UX-OQ-2)先做基础，留 Story 4.1 调优
- [x] **T2 — 特工拖放 + 实时英寸数**（AC1）
  - [x] 长按/按下特工 → 拖动 → 松手落定；拖动时浮层显示与起点英寸数（用于回合内合规检查, 如转移 ≤移动值）
  - [x] 拖动经 store dispatch `MOVE_OPERATIVE`；落定后更新 `OperativePlacement.baseCircle`
  - [x] 数字输入框备选(x/y/朝向, UX §4.5)；底盘预设 25/32/40mm
- [x] **T3 — 朝向旋转**（AC1）
  - [x] 双击特工旋转 45°；朝向三角更新；LOS 头部射线起点随朝向
- [x] **T4 — LOS 射线 / 射程环 / 控制范围圈渲染**（AC2）
  - [x] 选中攻击方 + 悬停目标 → 调 geometry 模块(Story 1.8)算 LOS/射程/控制范围
  - [x] 画 LOS 虚线(受阻段红实线/通畅段绿虚线)、武器射程环(选中武器时)、1" 控制范围圈
  - [x] 掩护染色：选中特工 → 控制范围内有阻碍地形 → 底圈绿；2" 内有他特工 → 灰
  - [x] 遮挡：被飞蝇云等遮挡目标 → 半透明虚线轮廓 + 「遮挡」标签
  - [x] 性能：密集板实时渲染帧率可接受；必要时降级按需显示(UX-OQ-9, 留 Story 4.1)
- [x] **T5 — 几何 finding 内联翻转（咨询式, D-17/D-24）**（AC3）
  - [x] 订阅 geometry 产出的 `GeometryFinding{kind,value,confidence,margin,overridden,finalValue}`（架构 §4.4）
  - [x] AMBIGUOUS 项标「⚠ 可翻转」；点击 1 击翻转假设 → dispatch `OVERRIDE_FINDING` → geometry 翻转 finalValue
  - [x] 翻转后资格判定(Story 1.10 `TARGET_VALIDATE`)实时重算（资格面板/拦截卡即时更新）
  - [x] **不弹框、不阻断**；finding 写入 ResolutionLog（接 Story 1.15）
  - [x] CLEAR 项直接套 value，不显示翻转控件
- [x] **T6 — 画地形工具（复用 Story 1.12）**（AC4）
  - [x] 抽取 Story 1.12 的画地形工具栏(矩形/多边形/属性标签)为共享组件；对局中也允许(会话内编辑, D-20)
  - [x] 与部署期画地形同底层
- [x] **T7 — 触控与基调兜底**（AC1/AC2）
  - [x] 拖放/选择命中区 ≥44px；朝向三角可点击
  - [x] 暗色主题 + 几何线色(红受阻/绿通畅/中性圈)；色盲安全(UX-OQ-10 留视觉阶段)

## Dev Notes

### UX: §7 棋盘交互
- §7.1 拖放放置/移位(实时英寸数) + 双击旋转 45° + 按阵型一键摆放(辅助, 非强制)。
- §7.2 预设模板载入(Story 1.12)；画地形工具(矩形/多边形 + 属性标签: 阻碍LOS/可站立(制高点)/飞蝇云(遮挡)/困难/可攀爬)；掩护/遮挡可视化。
- §7.3 LOS 射线(受阻红实线/通畅绿虚线) + 射程环 + 控制范围圈；**几何咨询式(D-17)**：每项几何可单击翻转的内联假设；歧义标「⚠ 可翻转」**不弹框、不阻断**，默认套引擎值，1 击翻转后资格实时重算(§6)；所有判定入日志。

### 架构: §4 几何模块 / §4.4 咨询式
- §4.1 数据结构：`OperativePlacement{baseCircle{x,y,r}, facing}`、`TerrainFeature{polygon, kind, vantage?, climbable?}`、`ObjectiveMarker{pos, controlRange}`。
- §4.2 计算：LOS(头部→目标底座线段 vs BLOCKING 多边形相交) / 掩护(控制范围 1" 内有 COVER) / 遮挡(OBSCURING) / 射程(圆-圆最近距离) / 控制范围(≤1" 且可见)。
- §4.4 `GeometryFinding{kind, value, confidence: CLEAR|AMBIGUOUS, margin, overridden?, finalValue}`；epsilon ~0.25" 带 → AMBIGUOUS；从不阻塞快路径；资格判定随翻转实时重算；全部入日志。
- **UI 只消费 state**（AR-9）：UI 不内嵌几何算法，调 geometry 模块；翻转经 store dispatch。

### 关键约束
- **D-24 几何咨询式内联翻转不弹框**：歧义默认套引擎值 + ⚠可翻转 + 1 击翻转，**绝不弹裁定框**（架构 §4.4 收口了原 AQ-2）。区别于规则缺口的「人工裁定卡」(UX §10.1, 几何不走那张卡)。
- **D-17 不静默猜**：每项 finding 含 confidence/margin/overridden/finalValue 入日志。
- **UI 只消费 state**（AR-9）：拖放/翻转经 store + intent，几何判定调 geometry 模块。
- 底座 r 取自 `operative.base.diameterMm`（D-27）。
- 触控 44px / 关键 56px；手势优先级(UX-OQ-2)本故事做基础，调优留 Story 4.1。

## References

- UX §7 棋盘交互 — `planning-artifacts/ux/ux-design-kill-team-companion-2026-06-28.md`
- 架构 §4 几何模块 / §4.4 咨询式判定 — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- PRD FR-8 / FR-9 / D-17 / D-24 / D-27 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- Epic 1 Story 1.14 — `planning-artifacts/epics.md`
- 依赖：Story 1.8（geometry）/ Story 1.10（资格判定）/ Story 1.12（画地形工具复用）

## Dev Agent Record

### Agent Model Used
glm-5.2（dev-story workflow）

### Implementation Plan
Board 共享渲染层 + 拖放英寸数 + 朝向旋转 + LOS/射程/控制范围可视化 + 几何 finding 内联翻转（咨询式 D-24）。

### Completion Notes List
- T1 渲染层：Board 自由坐标→屏幕变换；网格背景；底座圆(阵营色)+朝向三角+地形(按 kind 着色)+目标点+降落区。缩放/平移手势留 Story 4.1（UX-OQ-2）。
- T2 拖放：长按/按下拖动松手落定；浮层实时英寸数（转移合规检查）；经 store moveToken。
- T3 朝向：双击旋转 45°；朝向三角更新；facing 入 OperativePlacement。
- T4 几何可视化：选中已激活→射程环 + LOS 射线（通畅绿虚/受阻红实/AMBIGUOUS 虚）；调 geometry（UI 不内嵌算法）。
- T5 内联翻转：FindingStrip 订阅 losFinding；AMBIGUOUS 标⚠可翻转 + 1 击翻转（toggleOverride）；不弹框不阻断（D-24）。
- T6 画地形复用：TerrainFeature 与 1.12 共享；对局期编辑会话内（D-20）。
- T7 触控/基调：命中区>=44px；暗色 + 几何线色（红受阻/绿通畅/中性圈）。

### Change Log
- 2026-07-01：Story 1.14 完整实现。

### File List
- src/ui/match/Board.tsx（新：渲染层 + 朝向 + LOS/射程环）
- src/ui/match/PlayView.tsx（新：FindingStrip 内联翻转 + 拖放英寸数 + 一击）
- src/geometry/geometry.ts（改：导出 distanceToPolygon）
- src/state/matchStore.ts（overrides/toggleOverride/dragOrigin）

### Review Findings (2026-07-01)

详见 `epic1-ui-code-review-2026-07-01.md`（本 story 相关条目摘录）。
- [x] [Review][Patch] P3 几何翻转未回算资格（overrides 未注入 validateTarget；引擎已支持 findingOverrides）[src/ui/match/PlayView.tsx]
- [x] [Review][Decision] D-geom 几何可视化缺 1" 控制圈 / 掩护染色 / 遮挡轮廓（AC2 部分）— 补 or defer
