# Story 1.8: 自由坐标几何与资格判定 (geometry-eligibility)

Status: ready-for-dev

## Story

As a 玩家,
I want 基于自由坐标的几何计算（LOS/掩护/遮挡/射程/控制范围）与有效目标资格判定，且歧义透明交玩家终裁,
so that 资格判定有几何依据、近边界处不静默猜、我能一键翻转任何存疑判定。

## Acceptance Criteria

1. **AC1（数据结构）**：`Board` / `OperativePlacement`（`baseCircle.r` 取自 `operative.base.diameterMm/2`，D-27）/ `TerrainFeature`（polygon + kind BLOCKING/COVER/OBSCURING + vantage/climbable + keywords）数据结构与架构 §4.1 一致；底盘预设 25/28.5/32/40mm（GW 约定）。
2. **AC2（LOS 算法）**：`computeLOS(attacker, target, terrain)` 用「攻击方头部点 → 目标底座圆」线段与所有 `BLOCKING` 多边形求交（线段-多边形相交），任一相交即不可见；产出 `GeometryFinding`。
3. **AC3（掩护/遮挡/射程/控制范围）**：掩护（目标控制范围 1" 圆内存在 `COVER` 地形，2" 内有他特工则无）、遮挡（目标在 `OBSCURING` 内或视线穿其体积）、射程（圆-圆最近点距离 vs 武器 `range`）、控制范围（两底座圆最近点距离 ≤ 1" 且可见）各为独立纯函数，各产出 `GeometryFinding`。
4. **AC4（GeometryFinding 结构）**：`{ kind, value, confidence: CLEAR|AMBIGUOUS, margin, overridden?, finalValue }`——`confidence=CLEAR`（远离边界）/`AMBIGUOUS`（落在 epsilon 带 ~0.25"）；`finalValue` = 玩家翻转值或默认 `value`，资格判定只读 `finalValue`。
5. **AC5（咨询式 advisory + 翻转）**：引擎从不弹框阻断——AMBIGUOUS 项以内联可翻转假设呈现（默认套 `value` 标⚠），玩家可一键翻转 `overridden=true`/`finalValue=!value`；翻转写入步骤日志；资格判定随翻转实时重算。
6. **AC6（epsilon 带）**：宽松 epsilon ≈ 0.25 英寸；`|margin| < epsilon` → AMBIGUOUS，否则 CLEAR；带外不标歧义、直接套用。比 1e-3" 更贴现实（拖放录入精度有限）。
7. **AC7（有效目标资格判定）**：`computeEligibility(attacker, target, ctx)` 综合 6 条——命令（交战/隐匿可见性约束）+ 可见（LOS）+ 掩护（不影响资格但影响后续掩护豁免）+ 遮挡（OBSCURING 内通常不可被远程选为目标）+ 射程 + 控制范围内无己方（近战/射击互斥前提）；不合法则返回结构化结果说明**缺哪条**（先验拦截，FR-14/FR-10）。
8. **AC8（零重依赖原生算法）**：LOS（线段-多边形）、掩护/控制范围（点/圆-多边形）、射程（圆-圆）全部原生实现；不引入 turf.js / polygon-clipping 等重几何库（架构 AR-6）。
9. **AC9（制高点/可攀爬占位）**：`vantage`（特工底座压其上 → `COVER_SAVE` effect）与 `climbable`（转移可穿/冲刺不可，属移动合法性 FR-12）字段就位；平地地图休眠不触发（D-25）。

## Tasks / Subtasks

- [ ] **T1 — 几何类型**（AC1/AC4）
  - [ ] `src/geometry/types.ts`：`Board` / `OperativePlacement`（`baseCircle:{x,y,r}` + `facing`）/ `TerrainFeature` / `ObjectiveMarker` / `GeometryFinding`
  - [ ] `baseCircle.r` 由 `operative.base.diameterMm/2` 派生（英寸换算：mm/25.4）；底盘预设常量 25/28.5/32/40
- [ ] **T2 — 原生几何原语**（AC8）
  - [ ] `src/geometry/primitives.ts`：`segmentIntersectsPolygon` / `pointInPolygon` / `circleCircleNearest` / `circlePolygonDistance` 纯函数，全单测（含边界：相切/共线/端点）
  - [ ] 不引入第三方几何库
- [ ] **T3 — LOS**（AC2）
  - [ ] `src/geometry/los.ts`：`computeLOS(attacker, target, terrain)` → 线段（头部点→目标底座圆最近点）与所有 BLOCKING 多边形求交；任一相交即 `value=false`
  - [ ] 用「视线绕过角点」近似（架构 §4.2）；margin = 最近相交距离或最近遮挡余量
- [ ] **T4 — 掩护/遮挡**（AC3）
  - [ ] `src/geometry/cover.ts`：`computeCover(target, terrain, operatives)` → 目标控制范围 1" 圆内有无 COVER 地形；2" 内有他特工则无掩护
  - [ ] `src/geometry/obscured.ts`：`computeObscured(target, terrain)` → 目标在 OBSCURING 内或视线穿其体积
- [ ] **T5 — 射程/控制范围**（AC3）
  - [ ] `src/geometry/range.ts`：`computeRange(attacker, target, weapon)` → 圆-圆最近点距离 vs `weapon.range`
  - [ ] `src/geometry/engagement.ts`：`computeEngagement(a, b)` → 两底座圆最近点 ≤ 1" 且 LOS 可见（对称）
- [ ] **T6 — GeometryFinding + epsilon**（AC4/AC6）
  - [ ] 各 compute* 产出 `GeometryFinding`；`confidence` 按 `|margin| < EPSILON(0.25)` 判 AMBIGUOUS
  - [ ] `finalValue` 默认 = `value`；翻转后 = 玩家选值
- [ ] **T7 — 翻转（advisory）机制**（AC5）
  - [ ] `src/geometry/findingStore.ts`（或 state 内）：维护翻转状态 `{ [findingKey]: { overridden, finalValue } }`
  - [ ] `overrideFinding(key, newValue)` → 更新 + 写入当前步骤日志（与 Story 1.10 协同）+ 触发资格重算
  - [ ] **无弹框**：UI 内联翻转（UI 在 Story 1.14 实现，本故事只暴露纯函数 API）
- [ ] **T8 — 资格判定**（AC7）
  - [ ] `src/geometry/eligibility.ts`：`computeEligibility(attacker, target, ctx): EligibilityResult`
  - [ ] 6 条检查（命令/可见/掩护记录/遮挡/射程/控制范围内无己方）；返回 `{ eligible: boolean, failedChecks: CheckFailure[] }`
  - [ ] `CheckFailure` 含规则要点引用（`rulesRef`，FR-23/D-29）+ 缺哪条的人类可读说明（先验拦截 FR-14）
- [ ] **T9 — 制高点/可攀爬占位**（AC9）
  - [ ] `vantage`：特工底座圆与 vantage 多边形相交 → 触发 `COVER_SAVE` effect（接入流水线 step 5/6，本故事只给判定函数）
  - [ ] `climbable`：暴露 `isClimbable(terrain)` 供状态机移动合法性 guard 调用（FR-12，转移可穿/冲刺不可）
- [ ] **T10 — 单测 + golden**（AC2/AC3/AC7）
  - [ ] 几何原语全分支单测（相交/不相交/边界相切/端点在边上）
  - [ ] epsilon 带 AMBIGUOUS/CLEAR 转换单测
  - [ ] 资格判定 6 条各缺一条 → 正确报 `failedChecks`
  - [ ] 翻转后资格重算单测

## Dev Notes

### 架构合规（必须遵循）

- **数据结构（架构 §4.1）**：`Board{bounds,terrain,operatives}` / `OperativePlacement{operativeId, baseCircle{x,y,r}, facing}` / `TerrainFeature{id, polygon, kind:BLOCKING|COVER|OBSCURING, vantage?, climbable?, height?, keywords}`。`baseCircle.r = operative.base.diameterMm/2`（D-27，规则源不提供尺寸，按 GW 约定 25/28.5/32/40mm）。
- **计算策略表（架构 §4.2）**：LOS（线段-BLOCKING 多边形求交）/ 掩护（控制范围 1" 圆内有 COVER 地形，2" 内有他特工则无）/ 遮挡（OBSCURING 内或视线穿其体积）/ 射程（圆-圆最近点距离）/ 控制范围（两底座圆最近点 ≤ 1" 且可见）/ 制高点（底座压 vantage 多边形）。
- **咨询式 advisory（架构 §4.4，D-17 落地）**：引擎是**咨询器非权威阻断者**——给最佳判定 + 置信度，玩家一键翻转，全入日志。`GeometryFinding{kind, value, confidence:CLEAR|AMBIGUOUS, margin, overridden?, finalValue}`。
- **行为约定（架构 §4.4）**：从不阻塞快路径（无弹框）；AMBIGUOUS 内联可翻转假设；资格判定随翻转实时重算；绝不静默猜（每项 finding 含 confidence/margin/overridden/finalValue 入日志）。
- **epsilon 宽松带（架构 §4.3/§4.4）**：约 0.25"，带内=AMBIGUOUS，带外=CLEAR。比 1e-3" 贴现实。
- **零重依赖（架构 AR-6）**：原生算法，不引第三方几何库。
- **模块边界（AR-9）**：`src/geometry` 纯逻辑零 UI；引擎调几何，几何不反向调引擎（架构 §8.2）。

### 关键约束

- **LOS 头部点近似**：架构 §4.2 用「头部点→目标底座圆」线段；`facing` 字段保留但 v1 LOS 不严格依赖朝向（朝向用于未来真·视野锥，D-25 后置）。
- **掩护「2" 内有他特工则无」**：这是额外检查，别漏（规则：控制范围内有阻碍地形即得掩护，但 2" 内有其他特工则无）。
- **遮挡 ≠ 掩护**：语义不同，单独判定；OBSCURING 内通常不可被远程选为目标（影响资格），COVER 只影响后续掩护豁免（不影响资格）。
- **资格判定的 6 条**：命令（隐匿特工的可见性约束）/ 可见（LOS）/ 掩护（记录但不拦资格）/ 遮挡（拦远程资格）/ 射程 / 控制范围内无己方（近战前提：控制范围内有己方则不能用远程打该目标）。**不合法必须结构化说明缺哪条**（FR-10/FR-14 先验拦截）。
- **翻转 API 与日志协同**：翻转写日志依赖 Story 1.10 的 `StepRecord.rulings`；本故事暴露纯函数 + 翻转事件，日志写入在集成时接。
- **性能（架构 §4.3）**：棋盘小（十几特工+几十多边形），暴力 O(n·m) 够，不做空间索引。
- **AMBIGUOUS 默认方向**：架构 AQ-2 残项——默认套 `value`（引擎最佳判定），偏向由玩家翻转决定；实现期可用真实棋盘调参，但 v1 默认套 value。

### 依赖（前置 story，假设已完成）

- **Story 1.2**：规则数据 schema——`operative.base.diameterMm` 字段、`TerrainFeature` kind 枚举、`ObjectiveMarker`。
- **Story 1.10**：`StepRecord.rulings`（翻转/人工裁定入日志）、回滚时几何 finding 状态同步回退。

> 本故事是资格判定 + 流水线 `TARGET_VALIDATE` step 的几何后端。UI 内联翻转（UX-DR6）在 Story 1.14；资格拦截卡（UX-DR4）在 Story 1.13/1.15。本故事只交付纯逻辑 + API。

## References

- 架构 §4（几何模块：§4.1 数据结构 / §4.2 计算策略表 / §4.3 性能精度 / §4.4 咨询式 advisory / §4.5 位置录入 / §4.6 目标点与控制）— `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- 架构 §8.2（依赖方向不变量：几何被引擎调用不反向）— 同上
- 架构 AR-6（原生算法零重依赖）/ AR-12（base.diameterMm，D-27）— 同上
- 架构 AQ-2（epsilon 取值与 AMBIGUOUS 默认方向残项）— 同上
- Epic 1 Story 1.8 ACs — `planning-artifacts/epics.md`
- 规则源（LOS/掩护/遮挡/射程/控制范围/制高点/可攀爬）— `docs/rules/merged_kt_lite_rules_zh.md`（本地，D-29 不入公开仓库）
- PRD FR-8（棋盘状态托管自由坐标）/ FR-9（可见/掩护/遮挡/射程/控制范围咨询式+可翻转）/ FR-10（有效目标资格判定说明缺哪条）/ FR-14（先验合法性拦截）/ D-17（咨询式）/ D-24（几何咨询式）/ D-27（底座大小）— `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
