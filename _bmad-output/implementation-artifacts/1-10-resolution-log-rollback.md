# Story 1.10: 结算日志、单步回滚与回放 (resolution-log-rollback)

Status: ready-for-dev

## Story

As a 玩家,
I want 每次结算/回合动作全程留痕、可单步回滚、可回放,
so that 算错可逆、争议可查、引擎结果可信任。

## Acceptance Criteria

1. **AC1（ResolutionLog 结构）**：`ResolutionLog { resolutionId, pipelineKind: SHOOTING|MELEE, steps: StepRecord[], cursor }` 与架构 §7.1 一致；每个 step 一条按序；`cursor` 支持暂停/单步。
2. **AC2（StepRecord 结构）**：`StepRecord { stepId, inputs: Snapshot, diceRolls?: DiceRoll[], appliedEffects: AppliedEffectTrace[], rulings?: ManualRuling[], output: Snapshot, at }`——`appliedEffects` 含**被 enforcer 拒绝的 effect 并记 reason**；`rulings` 记人工裁定/几何翻转。
3. **AC3（每步 append）**：任一结算（射击/近战）每步执行后 append `StepRecord` 到 `ResolutionLog`；`inputs` 为进入本步的状态深拷贝快照（关键值），`output` 为本步产出快照。
4. **AC4（受限 event sourcing）**：仅对结算引擎做步骤级 event sourcing（非全应用）；状态仅会话内存，刷新重置（D-20）；不做跨会话持久化（架构 §7.4）。
5. **AC5（单步前进/暂停）**：游标 `cursor` 在 steps 上移动——「下一步」= 执行下一 step 并 append；「暂停」= 停在当前 cursor。
6. **AC6（单步撤销/回滚）**：玩家回滚某步 → 丢弃 cursor 之后的 steps，从该步 `inputs` 快照恢复状态（会话内）；因 step 是纯函数 + 状态会话内存，撤销 = 回放已执行 step 的快照（无需逆向计算）；**棋盘/特工状态同步回退**。
7. **AC7（回合动作日志）**：结算外的回合动作（激活、移动、计谋、部署、命令切换）同样写简短动作日志，支持单步撤销（架构 §7.2）。
8. **AC8（日志回放）**：历史 `ResolutionLog` 可序列化为 JSON；UI 回放面板按 steps 渲染时间线，每步可展开看——骰（含 seed）/ 生效 effect（附规则要点引用）/ 被拒 effect（附 enforcer 规则编号）/ 人工裁定 / 最终输出。
9. **AC9（规则要点引用 rulesRef）**：effect 描述符带 `rulesRef: { doc, section }` 指向本地 `docs/rules`（不入公开仓库 D-29）；回放/查询面板显示**引擎参数化要点**（数值/profile/触发步骤），**不渲染 GW 原文**（FR-23/D-29）。
10. **AC10（电子骰可复现）**：`diceRolls` 含 seed（`ElectronicDiceSource` seed=`(pipelineId, stepId, attempt)`，Story 1.5）；回放时据 seed 可复现电子骰结果。

## Tasks / Subtasks

- [ ] **T1 — ResolutionLog / StepRecord 类型**（AC1/AC2）
  - [ ] `src/engine/resolutionLog.ts`：`ResolutionLog` / `StepRecord` / `AppliedEffectTrace`（含 `accepted: boolean, rejectReason?: EnforcerRuleId`）/ `ManualRuling` / `Snapshot` 类型
  - [ ] `Snapshot` = 关键状态的深拷贝（特工耐伤/指示物/effect 栈/几何 finding 翻转态/CP 等）
- [ ] **T2 — LogWriter（append API）**（AC3）
  - [ ] `createLogWriter()`：`appendStep(stepId, inputs, diceRolls?, appliedEffects, rulings?, output)` → 不可变 append（返回新 log）
  - [ ] step 执行器（Story 1.6/1.7）在每步前后调 `snapshot()` + `appendStep`
- [ ] **T3 — 游标控制（前进/暂停）**（AC5）
  - [ ] `advance(log): log'`（执行下一 step 并 append）、`pause(log)`（停当前 cursor）
  - [ ] cursor 越界保护
- [ ] **T4 — 单步撤销/回滚**（AC6，核心）
  - [ ] `rollbackTo(log, stepIndex): { log', restoredState }`——丢弃 `stepIndex+1..` 的 steps，从 `steps[stepIndex].inputs` 快照恢复
  - [ ] 恢复 = 用快照重建引擎 ctx（特工状态/棋盘/effect 栈/几何翻转态/CP 同步回退）
  - [ ] 因 step 纯函数 + 状态会话内存，无需逆向计算
  - [ ] 单测：回滚后状态 == 进入该步前的状态（深相等）
- [ ] **T5 — 回合动作日志**（AC7）
  - [ ] 简短动作日志（与 ResolutionLog 同构或轻量版）：激活/移动/计谋/部署/命令切换各一条，支持单步撤销
  - [ ] 与状态机（Story 1.9）协同：每个迁移 action 写动作日志
- [ ] **T6 — 序列化（受限 event sourcing）**（AC4/AC8）
  - [ ] `serializeLog(log): JSON` / `deserializeLog(json): log`
  - [ ] 仅会话内存，不写 localStorage/IndexedDB（D-20）
- [ ] **T7 — 回放数据 API**（AC8）
  - [ ] `getReplayView(log): ReplayStepView[]`——每步展开为 `{ stepId, diceRolls, appliedEffects(含被拒+reason), rulings, output, rulesRef }`
  - [ ] UI 回放面板（Story 1.15）消费此 API；本故事只供数据
- [ ] **T8 — rulesRef 引用（D-29）**（AC9）
  - [ ] effect 描述符 `rulesRef: { doc, section }` 指向本地 `docs/rules`（.gitignore，不入公开仓库）
  - [ ] 回放/查询面板显示**参数化要点**（数值/profile/触发步骤/enforcer 规则编号），**不渲染 GW 原文**
  - [ ] 与 Story 1.2 effectRegistry 协同：rulesRef 在 effect 描述符定义
- [ ] **T9 — 电子骰 seed 入日志**（AC10）
  - [ ] `diceRolls` 每条含 `seed`（来自 Story 1.5 `ElectronicDiceSource`，seed=`hash(pipelineId, stepId, attempt)`）
  - [ ] `reproduceDice(seed, n): DiceRoll[]` 可复现（回放/争议核查用）
- [ ] **T10 — 单测**（AC3-AC8）
  - [ ] append/游标/回滚全路径单测
  - [   回滚后状态深相等单测
  - [ ] 序列化往返单测
  - [ ] 被拒 effect 记 reason 单测（与 enforcer 协同）
  - [ ] 回放视图含被拒 effect/裁定单测

## Dev Notes

### 架构合规（必须遵循）

- **ResolutionLog / StepRecord（架构 §7.1）**：逐字对齐——`ResolutionLog { resolutionId, pipelineKind, steps, cursor }`；`StepRecord { stepId, inputs: Snapshot, diceRolls?, appliedEffects: AppliedEffectTrace[], rulings?, output: Snapshot, at }`。`appliedEffects` 含被 enforcer 拒绝的（记 reason）。
- **单步回滚（架构 §7.2）**：前进/暂停 = cursor 移动；撤销 = 丢弃 cursor 后步骤、从 cursor-1 的 inputs 快照恢复。**因状态会话内存 + step 纯函数，撤销 = 回放快照，无需逆向计算**。
- **回合动作同样可撤销（架构 §7.2 末段）**：结算外的回合动作（激活、移动、计谋）写简短动作日志，支持单步撤销。
- **日志回放（架构 §7.3）**：`ResolutionLog` 可序列化为 JSON；UI 按 steps 渲染时间线，每步可展开看骰/生效 effect（附规则原文引用）/被拒 effect（附 enforcer 规则编号）/人工裁定/输出。
- **rulesRef（架构 §7.3，FR-23/D-29）**：effect 描述符带 `rulesRef: { doc, section }` 指向本地 `docs/rules`（不入公开仓库）；回放/查询显示**引擎参数化要点**，**不渲染 GW 原文**。
- **不全应用 event sourcing（架构 §7.4）**：D-20 不做存档/持久化，全局 event sourcing 收益消失；结算步骤日志是「局部 event sourcing」恰好覆盖可审计需求。
- **模块边界（AR-9）**：`src/engine/resolutionLog.ts` 纯逻辑零 UI；横切：引擎写、UI 读、回滚依赖（架构 §8.1）。

### 关键约束

- **D-20 刷新重置**：日志仅会话内存，不写 localStorage/IndexedDB；刷新清空。这是「受限 event sourcing」的边界。
- **Snapshot 深拷贝关键值**：inputs/output 快照必须深拷贝——特工耐伤/受伤受创/指示物/effect 栈/几何 finding 翻转态/CP/ployUses/激活历史。浅拷贝会导致回滚后状态被后续 mutation 污染。
- **被拒 effect 必须记 reason**：`AppliedEffectTrace.accepted=false` + `rejectReason: EnforcerRuleId`（R1..R12）——这是可审计的核心（玩家能看到「为什么这条 effect 没生效」）。
- **撤销无需逆向计算**：架构 §7.2 关键洞察——step 纯函数 + 状态会话内存，撤销 = 从 inputs 快照重建，不写 inverse step。实现期务必利用这点，不要为每步写 undo 函数。
- **回合动作日志粒度**：激活/移动/计谋各一条简短记录（不必 step 级展开，那是结算专用）；支持单步撤销即可。
- **骰 seed 可复现**：仅电子骰（物理骰无 seed，回放显示玩家录入值）；seed 格式与 Story 1.5 对齐。
- **rulesRef 不渲染原文**：UI 显示参数化要点（如「命中 +1，来源：受创，policy: MUTUALLY_EXCLUSIVE_WITH(injured)，enforcer R4」），不显示 GW 原文段落（IP 护栏 D-29/NFR-7）。

### 依赖（前置 story，假设已完成）

- **Story 1.2**：effect 描述符 schema（`rulesRef` 字段）+ packLoader。
- **Story 1.4**：enforcer（产 `AppliedEffectTrace.accepted/rejectReason`，被拒 effect 记 enforcer 规则编号 R1..R12）。
- **Story 1.5**：`ElectronicDiceSource` seed 入 `DiceRoll`（seed=`hash(pipelineId, stepId, attempt)`）。
- **Story 1.6/1.7**：step 执行器在每步调 LogWriter（本故事提供 API，集成在流水线 story 接）。
- **Story 1.8**：几何 finding 翻转入 `StepRecord.rulings`；回滚时几何翻转态同步回退（Snapshot 含翻转态）。

> 本故事是可审计地基。流水线（1.6/1.7）、状态机（1.9）、几何翻转（1.8）都向它写日志/依赖它回滚。建议先交付 LogWriter/StepRecord/回滚纯逻辑 + 单测，集成 API 与各 story 对接。UI 回放面板（UX-DR7）在 Story 1.15。

## References

- 架构 §7（信任/可审计：§7.1 ResolutionLog/StepRecord / §7.2 单步回滚 / §7.3 日志回放 rulesRef / §7.4 为何不全应用 event sourcing）— `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- 架构 §8.1（横切：Resolution Log 引擎写/UI 读/回滚依赖）— 同上
- 架构 §2.4（effect 描述符 rulesRef 字段）— 同上
- 架构 §3.3（enforcer 12 条规则编号 R1..R12，被拒 effect 记 reason）— 同上
- Epic 1 Story 1.10 ACs — `planning-artifacts/epics.md`
- PRD FR-16（单步回滚）/ FR-17（结算日志/回放）/ FR-23（规则查询参数化）/ NFR-4（可审计）/ D-20（刷新重置）/ D-29（IP，docs/rules 不入公开仓库）— `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
