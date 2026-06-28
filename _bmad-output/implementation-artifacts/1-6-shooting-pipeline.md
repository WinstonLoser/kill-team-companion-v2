# Story 1.6: 射击结算流水线 (shooting-pipeline)

Status: ready-for-dev

## Story

As a 引擎,
I want 一条 10 步射击结算流水线（StepFn 纯函数 + SHOOTING_PIPELINE 注册表 + 每步扫描 effect 栈按 trigger.point 接入经 enforcer + 写 StepRecord + 游标暂停/前进）,
so that 一次射击从掷骰到伤亡按规则正确结算、阵营 effect 数据驱动接入、每步可审计可回滚。

## Acceptance Criteria

1. **AC1（10 step 顺序）**：`SHOOTING_PIPELINE` 注册表按架构 §3.1 表顺序含 10 步：WEAPON_SELECT → TARGET_VALIDATE → HIT_ROLL → ATTACK_UPGRADE → DEFENCE_ROLL → DEFENCE_UPGRADE → PARRY_ALLOCATE → DAMAGE_PER_DIE → DAMAGE_TOTAL_MITIGATE → WOUNDS_APPLY_AND_AFTER。
2. **AC2（StepFn 纯函数统一签名）**：每 step 是 `StepFn = (ctx: ResolutionContext, input: StepInput) => StepOutput`；ctx 只读快照（特工/棋盘/effect 栈/骰源/日志写入器）；input = 上步产出 + 本步骰/决策；output = 本步结果 + StepRecord + 可能的裁定 query。纯函数：同入同出、不 mutate ctx。
3. **AC3（effect 按 trigger.point 接入）**：每 step 在执行前后扫描 active effect 栈，按 `effect.trigger.point`（§2.4.2）匹配本步触发点，调用对应 modifier.kind 执行器，产出 AppliedModifier 经 **enforcer（Story 1.4）** 过滤后应用；被拒的进 RejectionTrace。
4. **AC4（写 StepRecord）**：每步完成后 append `StepRecord { stepId, inputs(快照), diceRolls?(含seed), appliedEffects(含被拒+规则编号), rulings?, output, at }` 到 ResolutionLog；游标 cursor 前进。
5. **AC5（游标暂停/前进）**：`advance()` 执行下一 step 并 append；`pause()` 停在当前 cursor；`rollbackTo(stepIndex)` 丢弃其后 steps、从该步 inputs 快照恢复（§7.2，状态会话内存 + step 纯函数 → 撤销=回放快照）。
6. **AC6（端到端跑通 + golden 接续）**：用合法射击输入跑完整 10 步，输出伤亡；Story 1.3 死亡天使金样中可表达为完整 pipeline 断言的部分（钢铁光环 IGNORE_DAMAGE、战斗条令 BALANCED、强健 UPGRADE_SUCCESS）改为对 pipeline 输出断言并补齐；近战专属金样（决斗家格挡）留 Story 1.7。
7. **AC7（模块边界 + 可单测）**：`src/engine/pipeline/` 零 UI 依赖；每个 step 可独立单测（注入 mock ctx/骰源/effect 栈）；pipeline 驱动器可单测（游标/回滚）。

## Tasks / Subtasks

- [ ] **T1 — ResolutionContext / StepInput / StepOutput 类型**（AC2）
  - [ ] `src/engine/pipeline/types.ts`：`ResolutionContext`（只读：attacker/defender/weapon/board/effectStack/dice:DiceSource/logWriter/ctx:{pipelineId,attempt}）
  - [ ] `StepInput`（prevOutput + rawDice?/decision?）；`StepOutput`（result + stepRecord + rulingQuery?）
  - [ ] `StepFn = (ctx, input) => StepOutput`
- [ ] **T2 — effect 扫描与接入**（AC3）
  - [ ] `src/engine/pipeline/effectScan.ts`：`collectEffectsForPoint(effectStack, point, ctx): Effect[]` 按 trigger.point + condition 谓词过滤
  - [ ] `effectRegistry.ts`：modifier.kind → 执行器映射（HIT_PLUS→改命中阈值、REROLL→调 ctx.dice.reroll、UPGRADE_SUCCESS→升关键、PIERCE→减防御骰、COVER_SAVE→额外保留、DAMAGE_MITIGATION/IGNORE_DAMAGE→减伤/忽略、ATTACH_WEAPON_RULE→临时给武器加规则标签、GRANT_MARKER→打指示物 等）
  - [ ] 执行器产出 AppliedModifier[]，交 enforcer（Story 1.4）过滤；kept 应用、rejected 进 trace
  - [ ] condition 谓词库（§2.5）：weaponKindIs/rangeBucket/targetHasMarker/attackerHasKeyword/targetInCover/operativeIsjured 等——本 story 实现金子样所需子集，其余占位
- [ ] **T3 — 10 个 step 实现**（AC1/AC2）
  - [ ] `src/engine/pipeline/steps/`：每步一个文件
    - `weaponSelect.ts`（选远程武器）
    - `targetValidate.ts`（资格判定——几何部分依赖 Story 1.8，本 story 用注入的 GeometryResult 占位/可注入 mock）
    - `hitRoll.ts`（BEFORE_HIT_ROLL 附加规则 + ON_HIT_ROLL 调 ctx.dice.roll + 保留≥hit）
    - `attackUpgrade.ts`（AFTER_HIT_ROLL：AUTO_SUCCESS/REROLL/UPGRADE_SUCCESS，经 enforcer R1 去重）
    - `defenceRoll.ts`（BEFORE_DEFENCE_ROLL：PIERCE/COVER_SAVE + ON_DEFENCE_ROLL）
    - `defenceUpgrade.ts`（AFTER_DEFENCE_ROLL：强健 UPGRADE_SUCCESS）
    - `parryAllocate.ts`（ON_PARRY_ALLOCATION：射击侧主要为掩护保留/抵挡分配；近战决斗家在 Story 1.7）
    - `damagePerDie.ts`（ON_DAMAGE_PER_DIE：毁灭即时/剧毒 +1，每枚独立）
    - `damageTotalMitigate.ts`（ON_DAMAGE_TOTAL：DAMAGE_MITIGATION/IGNORE_DAMAGE 经 enforcer R3 每枚上限、R4/R12 互斥；钢铁光环 oncePerBattle 查 ctx.oncePerBattleUsed）
    - `woundsApplyAndAfter.ts`（BEFORE_WOUNDS_REDUCE 扣耐伤 + AT_PIPELINE_END 毒素指示物 + ON_INCAPACITATED）
  - [ ] 每个 step 扫描对应触发点（§2.4.2 → §3.1 step 表对照）
- [ ] **T4 — SHOOTING_PIPELINE 注册表 + 驱动器**（AC1/AC5）
  - [ ] `src/engine/pipeline/shooting.ts`：`SHOOTING_PIPELINE: StepFn[] = [顺序 10 步]`
  - [ ] `src/engine/pipeline/driver.ts`：`createResolution(pipeline, ctx) => { log: ResolutionLog; advance(); pause(); rollbackTo(i); current():StepRecord }`
  - [ ] 游标 cursor 在 steps 上移动；advance 执行下一 step append；rollbackTo 丢弃其后从 inputs 快照恢复
- [ ] **T5 — StepRecord / ResolutionLog**（AC4）
  - [ ] 复用架构 §7.1 结构：ResolutionLog{resolutionId,pipelineKind:"SHOOTING",steps,cursor}；StepRecord{stepId,inputs,diceRolls?,appliedEffects,rulings?,output,at}
  - [ ] appliedEffects 含 kept + rejected（ruleId R1..R12）
  - [ ] logWriter 由 ctx 注入（Zustand 持久化在 Story 1.10，本 story 用内存实现）
- [ ] **T6 — 单测每 step + 驱动器**（AC7）
  - [ ] `tests/engine/pipeline/steps/*.test.ts`：每步注入 mock ctx/固定骰/effect 栈，断言输出 + StepRecord
  - [ ] `tests/engine/pipeline/driver.test.ts`：advance 顺序推进、pause 停、rollbackTo 恢复（含 effect 撤销）
  - [ ] `tests/engine/pipeline/shooting-e2e.test.ts`：合法射击全 10 步跑通，伤亡正确
- [ ] **T7 — golden 接续**（AC6）
  - [ ] 更新 `tests/golden/angels-of-death.test.ts`：钢铁光环/战斗条令平衡/强健金样改为对 pipeline 输出断言（替换 Story 1.3 占位的解析层断言）
  - [ ] 死亡天使完整 shooting 金样（爆矢武器一次射击，含战斗条令 BALANCED 重掷）通过
- [ ] **T8 — 导出与边界**（AC7）
  - [ ] `src/engine/index.ts` 导出 SHOOTING_PIPELINE/driver/StepFn/ResolutionContext
  - [ ] 确认 `src/engine/pipeline/` 无 react/zustand import（logWriter 是接口，实现在 state 层）

## Dev Notes

### 架构合规

- **§3.1 流水线**：StepFn 统一签名纯函数；SHOOTING_PIPELINE 注册表数组驱动；阵营 effect 不写进 step 代码，通过 pipelineStep 字段挂载、step 扫描 effect 栈按 trigger.point 接入（data-driven 接入点）。
- **§3.1 step 表**：10 步顺序 + 每步 effect 插入点严格对照架构表。
- **§3.2/3.3**：每步属性经 resolveStat + enforcer；base 不可变、modifiers 留痕。
- **§7.1/7.2**：StepRecord 结构 + cursor 暂停/前进/回滚（局部 event sourcing，撤销=回放快照）。

### 关键约束

- **纯函数 step**：StepFn 不得 mutate ctx、不得读全局；同入同出。骰通过 ctx.dice 注入（Story 1.5），不直接 Math.random。
- **几何解耦**：TARGET_VALIDATE 的资格判定依赖几何（Story 1.8）。本 story 通过 ResolutionContext 注入 `geometryResult`（可见/掩护/射程等 finding），不直接调几何模块；Story 1.8 完成后接通。Dev Notes 标注衔接点。
- **effect 扫描按 trigger.point**：每 step 只处理属于自己触发点的 effect（§2.4.2 → §3.1 映射），不跨步。BEFORE_*/AFTER_*/ON_* 各对应 step 的前后/中。
- **enforcer 必经**：所有 modifier 经 enforcer 过滤才应用；被拒不丢弃，进 trace 记 R 编号（§7.3 回放）。
- **oncePerBattle（钢铁光环）**：ctx 持 oncePerBattleUsed:Record<id,boolean>；damageTotalMitigate step 查此判定 IGNORE_DAMAGE 是否仍可用；状态机正式追踪在 Story 1.9，本 story 用 ctx 注入。
- **依赖链**：Story 1.2（schema/effect 类型）、1.4（enforcer/resolveStat）、1.5（DiceSource）；1.3（金样接续）；1.8（几何，解耦占位）。

### Project Structure Notes

- 落位 `src/engine/pipeline/{types.ts,effectScan.ts,effectRegistry.ts,driver.ts,shooting.ts,steps/*.ts,index.ts}`；测试 `tests/engine/pipeline/`。
- 与架构 §9 `engine/pipeline/` + `steps/` 一致。

## References

- 架构 §3.1（流水线 step 表，射击 10 步 + effect 插入点）/ §3.2（resolveStat）/ §3.3（enforcer）/ §2.4.2（触发点枚举）/ §7.1-7.2（StepRecord + cursor 回滚）— `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- 架构 §4（几何，TARGET_VALIDATE 依赖，本 story 解耦）— 同上
- Epic 1 Story 1.6 — `planning-artifacts/epics.md`
- PRD FR-4（射击 10 步）/ FR-7（enforcer）/ FR-16（单步回滚）/ FR-17（日志回放）/ NFR-1 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- 依赖：Story 1.2（effect 类型）、1.3（金样接续）、1.4（enforcer/resolveStat）、1.5（DiceSource）、1.8（几何，占位衔接）

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
