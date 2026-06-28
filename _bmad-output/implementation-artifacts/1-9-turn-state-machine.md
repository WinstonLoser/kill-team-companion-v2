# Story 1.9: 回合/激活状态机与行动合法性 (turn-state-machine)

Status: ready-for-dev

## Story

As a 玩家,
I want 一个分层回合/激活状态机（XState）+ 行动合法性 guard，推进 4 转折点×阶段、交替激活，并拦截一切非法行动/计谋超限,
so that 对局按 KT Lite 回合结构正确推进，非法操作在执行前被拦下并解释。

## Acceptance Criteria

1. **AC1（分层状态机结构）**：XState v5 分层 FSM——`battle > turning point > phase > activation > action`；顶层状态 `BATTLE_INIT → DEPLOYMENT → TURNING_POINT_START → {STRATEGY_PHASE, ENGAGEMENT_PHASE} → TURNING_POINT_END → ... → BATTLE_END`，与架构 §6.1 一致。
2. **AC2（部署与转折点推进）**：`DEPLOYMENT`（双方降落区交替部署，FR-24，依赖 Story 1.8 几何校验落子合法性）→ `TURNING_POINT_START`（先手权、CP 发放）→ `STRATEGY_PHASE`（战略计谋）→ `ENGAGEMENT_PHASE`（交替激活循环）→ 双方所有特工待机 → `TURNING_POINT_END`（effect 到期、灵活战术还原、指示物结算、目标点控制判定 + VP 得分 FR-25/26）→ 重复 4 转折点 → `BATTLE_END`（VP 总分判胜负 FR-27）。
3. **AC3（交替激活循环）**：`ENGAGEMENT_PHASE` 内激活循环——选激活特工（须就绪待机）→ 选命令（交战 ENGAGED / 隐匿 CONCEALED）→ 执行行动（≤APL）→ 对方可触发反应（全待机时免费 1AP）→ 翻待机 → 下一激活；就绪待机翻转、先手权正确轮换。
4. **AC4（FR-12 行动合法性 guard）**：每个行动迁移挂 guard，校验——AP ≤ APL / 同激活不重复同行动 / 后撤（FALLBACK）后禁转移或冲锋 / 隐匿或控制范围内禁射击 / 近战需敌方在控制范围内 / 阿斯塔特双近战或双射击特规；非法则迁移被拒。
5. **AC5（先验拦截 + 解释）**：guard 拒绝时返回结构化拒绝原因（缺哪条 + 规则要点 `rulesRef`），供 UI 显示拦截卡（FR-14，UX-DR4）；绝不静默放行非法行动。
6. **AC6（CP / 计谋次数追踪）**：状态机 context 持有 `cp: number` 与 `ployUses: { [ployId]: { perBattle, perTurningPoint } }`；计谋 effect 引用 `source: stratagem:xxx`，使用时 `ployUses` 自增；超限（perBattle/perTurningPoint 上限）→ enforcer/状态机拦截（FR-11）。
7. **AC7（反应子状态）**：激活循环内对方介入单独子状态 `AWAITING_REACTION` → 玩家可选触发反应计谋（如复仇之怒 `ON_REACTION`）或放弃 → 回激活循环；全待机时免费 1AP 反应。
8. **AC8（effect 到期 + VP 结算）**：`TURNING_POINT_END` 自动让到期 effect 失效（FR-1）、灵活战术还原、指示物结算、按目标点控制数累加 VP（FR-26，依赖 Story 1.8 目标点控制判定）；4 TP 结束比较 VP 判胜负（FR-27，含平局规则）。
9. **AC9（XState 可序列化/可测）**：状态机为纯逻辑（`src/state/turnStateMachine.ts`），可脱离 React 独立单测；guard/action 为纯函数。

## Tasks / Subtasks

- [ ] **T1 — XState 机器骨架**（AC1/AC2）
  - [ ] `src/state/turnStateMachine.ts`：定义 `battleMachine`（XState v5），分层 `battle > turningPoint > phase > activation > action`
  - [ ] 顶层状态：`BATTLE_INIT → DEPLOYMENT → TURNING_POINT_START → STRATEGY_PHASE → ENGAGEMENT_PHASE → TURNING_POINT_END → BATTLE_END`
  - [ ] `context`：`{ turningPoint: 1..4, currentPlayer, initiative, cp:{a,b}, operatives, effects, vp:{a,b}, ployUses, ... }`
- [ ] **T2 — DEPLOYMENT**（AC2）
  - [ ] 双方降落区交替部署（FR-24）；落子合法性调几何（Story 1.8）：在己方降落区内、不重叠、不出界
  - [ ] 全部署完 → `TURNING_POINT_START`
- [ ] **T3 — TURNING_POINT_START / STRATEGY_PHASE**（AC2/AC6）
  - [ ] CP 发放（每 TP 起点 + 先手权相关）
  - [ ] 战略计谋使用（走 CP/ployUses 追踪）
- [ ] **T4 — ENGAGEMENT_PHASE 交替激活循环**（AC3）
  - [ ] 激活循环子状态：`selectingOperative → selectingCommand → executingAction → awaitingReaction → finalizing`
  - [ ] 选就绪特工 → 选命令（ENGAGED/CONCEALED）→ 执行行动（≤APL）→ 反应窗 → 翻待机 → 下一激活
  - [ ] 双方所有特工待机 → `TURNING_POINT_END`
- [ ] **T5 — FR-12 行动合法性 guard**（AC4/AC5，核心）
  - [ ] 纯函数 guard 集，每个行动迁移挂载：
    - `apWithinApl(action, operative)`：AP 消耗 ≤ APL（两层属性 resolveStat，Story 1.4）
    - `noDuplicateSameAction(activationHistory)`：同激活不重复同行动
    - `fallbackBlocksReposition(action)`：后撤后禁转移/冲锋（激活内标记 hasFallenBack）
    - `concealedOrEngagedBlocksShoot(action, geometry)`：隐匿或控制范围内禁射击（调 Story 1.8 几何）
    - `meleeRequiresEnemyInRange(geometry)`：近战需敌方在控制范围
    - `astatesDualMeleeDualShoot(operative, weaponRules)`：阿斯塔特双近战/双射击特规
  - [ ] guard 拒绝返回 `{ ok:false, reason: CheckFailure[] }`（含 rulesRef，FR-14）
- [ ] **T6 — CP / ployUses 追踪**（AC6）
  - [ ] context `ployUses: { [ployId]: { perBattle, perTurningPoint } }`
  - [ ] 计谋使用 action：扣 CP、自增 ployUses、检查上限；超限 → 拦截（与 enforcer 协同，计谋 effect `source: stratagem:xxx`）
  - [ ] `TURNING_POINT_START` 重置 perTurningPoint 计数
- [ ] **T7 — 反应子状态**（AC7）
  - [ ] `AWAITING_REACTION`：对方可选触发反应计谋（`ON_REACTION` 触发点，如复仇之怒）或放弃
  - [ ] 全待机免费 1AP 反应逻辑
- [ ] **T8 — TURNING_POINT_END effect 到期 + VP**（AC8）
  - [ ] effect 到期：扫 `effects[]`，剩余 TP=0 的失效（FR-1）
  - [ ] 灵活战术还原、指示物结算
  - [ ] 目标点控制判定（调 Story 1.8：每方 controlRange 内特工数，友方多于敌方且≥1）→ 累加 VP（FR-26）
- [ ] **T9 — BATTLE_END 胜负**（AC8）
  - [ ] 4 TP 结束 → `BATTLE_END`：比较 `vp.a` vs `vp.b`，含平局规则（按 Lite 规则，如先手权/控制数等 tiebreak）
- [ ] **T10 — 单测**（AC1-AC9）
  - [ ] 状态迁移全路径单测（BATTLE_INIT→...→BATTLE_END）
  - [ ] 每个 FR-12 guard 的拒绝场景单测（含组合：隐匿+控制范围内）
  - [ ] CP/ployUses 超限拦截单测
  - [ ] 反应子状态单测
  - [ ] effect 到期 + VP 累加单测

## Dev Notes

### 架构合规（必须遵循）

- **顶层状态机（架构 §6.1）**：`BATTLE_INIT → DEPLOYMENT → TURNING_POINT_START(战略+交战) → 交替激活循环 → TURNING_POINT_END(effect 到期+VP) → ×4 → BATTLE_END`。逐字对齐。
- **XState v5（架构 §6.2）**：用 XState 而非手写 reducer——FR-11 的「先手权/CP/就绪待机翻转/交替激活/反应/计谋次数」是典型分层 FSM，hierarchical state + guarded transitions 直接对应。
- **FR-12 guard（架构 §6.2）**：作为 guard 函数挂每个 action 迁移（AP≤APL、同激活不重复同行动、后撤后禁转移/冲锋、隐匿/控制范围内禁射击、近战需敌方在控制范围、阿斯塔特双近战双射击）。
- **CP/计谋次数（架构 §6.2，AQ-4）**：context 持有 `cp` 与 `ployUses: { [ployId]: { perBattle, perTurningPoint } }`；计谋 effect 引用 `source: stratagem:xxx`，enforcer/状态机据 `ployUses` 拦截超限。本故事定 `ployUses` 放 XState context（AQ-4 落地）。
- **反应（架构 §6.3）**：单独子状态 `AWAITING_REACTION`，激活循环内对方介入。
- **目标点/VP（架构 §4.6）**：`TURNING_POINT_END` 按目标点控制数累加 VP；`BATTLE_END` 比较 VP 判胜负。几何控制判定调 Story 1.8。
- **依赖方向（架构 §8.2）**：状态机触发引擎（激活/行动触发结算），不反过来；结算完成后回写状态（造伤、指示物、计谋次数）。
- **模块边界（AR-9）**：`src/state` 为纯逻辑机器，可独立单测；UI 只订阅 store。

### 关键约束

- **D-20 刷新重置**：状态机 context 仅会话内存，不做持久化；刷新回到 `BATTLE_INIT`。
- **guard 必须结构化拒绝原因**：FR-14 先验拦截要求拦下并解释「缺哪条」——guard 返回 `CheckFailure[]`（含 rulesRef），不能只返回 boolean。UI 拦截卡（UX-DR4）在 Story 1.13/1.15，本故事只产数据。
- **CP/ployUses 拦截点**：在状态机 action（扣 CP/自增）+ enforcer（计谋 effect 生效时查 ployUses）双重保险；超限任一拦截。
- **APL 用两层属性**：`apWithinApl` 调 `resolveStat(operative, 'apl', ctx)`（Story 1.4），含持徽手等 APL modifier。
- **近战/射击前提依赖几何**：guard 调 Story 1.8 的 `computeEngagement` / `computeEligibility`；本故事假设几何 API 就绪（可并行起稿，集成时接）。
- **平局规则**：按 Lite 规则源核对 tiebreak（实现期查 `docs/rules`），不臆造。
- **阿斯塔特双近战/双射击**：死亡天使阵营特规，作为 guard 分支（数据驱动：阵营 keywords 含 ASTARTES 时启用）。

### 依赖（前置 story，假设已完成）

- **Story 1.2**：规则数据 schema（计谋 `stratagems[]`、`use-limit`、`buildConstraints`）。
- **Story 1.4**：两层属性模型（`resolveStat` APL）+ enforcer（计谋 effect 经 enforcer、叠加 policy）。
- **Story 1.8**：几何（落子合法性、控制范围、近战前提、隐匿/控制范围内禁射击判定、目标点控制数）。
- **Story 1.10**：回合动作日志 + 单步撤销（激活/移动/计谋同样写简短动作日志支持撤销，架构 §7.2）。

> 本故事是回合骨架 + 行动守门人。结算触发（射击/近战）依赖 Story 1.6/1.7 引擎；VP/胜负 UI（UX-DR11）在 Story 1.16。本故事只交付状态机 + guard + context。

## References

- 架构 §6（回合/激活状态机：§6.1 顶层 FSM / §6.2 XState 实现与 guard / §6.3 反应子状态）— `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- 架构 §4.6（目标点与控制 + VP + 胜负）— 同上
- 架构 §8.2（依赖方向：状态机触发引擎不反过来）— 同上
- 架构 AQ-4（CP/ployUses 建模细节——本故事落地：放 XState context）— 同上
- Epic 1 Story 1.9 ACs — `planning-artifacts/epics.md`
- 规则源（回合结构/激活/命令/行动限制/计谋/反应/VP/胜负）— `docs/rules/merged_kt_lite_rules_zh.md`（本地，D-29）
- PRD FR-11（回合/激活状态机）/ FR-12（行动合法性）/ FR-14（先验拦截）/ FR-24（部署）/ FR-25（目标点控制）/ FR-26（VP）/ FR-27（胜负）/ D-20（刷新重置）— `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
