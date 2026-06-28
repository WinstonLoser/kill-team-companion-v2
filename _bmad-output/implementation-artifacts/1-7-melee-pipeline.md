# Story 1.7: 近战结算流水线 (melee-pipeline)

Status: ready-for-dev

## Story

As a 玩家,
I want 一条 7 步近战结算流水线（含双方同时掷骰 + 轮流结算的出击/格挡子决策）,
so that 近战的出击/格挡/震荡/后效按 KT Lite 规则正确结算，且每个子决策都可审计可回滚。

## Acceptance Criteria

1. **AC1（7 步推进）**：合法近战触发后，流水线按 7 步顺序推进 `MELEE_TARGET_SELECT → MELEE_WEAPON_SELECT → MELEE_SIMULTANEOUS_ROLL → MELEE_ALTERNATING_RESOLVE → MELEE_PARRY_RULES → MELEE_DAMAGE_AND_MITIGATE → MELEE_AFTER`；每步写一条 `StepRecord` 到 `ResolutionLog`，游标 `cursor` 正确移动，支持「下一步/暂停/单步撤销」（复用 Story 1.10 的日志/回滚基础设施）。
2. **AC2（轮流结算游标）**：`MELEE_ALTERNATING_RESOLVE` 内部维护交替游标——攻击方与防守方各一个 dice 池（`attackDice[]` / `parryDice[]`）+「当前轮到谁」；从攻击方开始轮流结算，每次玩家对一枚成功骰选「出击」或「格挡」都记为一条**子决策**（写入 `StepRecord.appliedEffects`/`rulings` 或子步骤结构，满足 FR-16 回滚到任一子决策）。
3. **AC3（格挡规则矩阵）**：`MELEE_PARRY_RULES` 按规则矩阵正确处理——普通挡普通 / 2 枚普通挡关键 / 关键挡任意 / 残暴武器只能用关键挡 / 决斗家可用普通挡关键 / 震荡（CONCUSSIVE）出击骰被舍弃不可格挡；矩阵作为纯函数，全场景单测覆盖。
4. **AC4（造伤与减免复用）**：`MELEE_DAMAGE_AND_MITIGATE` 复用射击流水线的 `DAMAGE_PER_DIE`（`ON_DAMAGE_PER_DIE`，毁灭即时/剧毒）与 `DAMAGE_TOTAL_MITIGATE`（`ON_DAMAGE_TOTAL`，恼人韧性/纳垢韧性/钢铁光环）逻辑与 effect 接入点；不重复实现减免。
5. **AC5（后效）**：`MELEE_AFTER` 处理近战后效——`AT_PIPELINE_END`（毒素指示物获得）、`ON_INCAPACITATED`（无尽杀戮/剧毒破灭）等触发点接入；灵魂盛宴类阵营机制以 effect 描述符挂此 step，经 enforcer 过滤。
6. **AC6（data-driven 接入）**：阵营近战机制（军团兵印记恐虐严重@`MELEE_*`、死亡天使决斗家/残暴、瘟疫剧毒）**不写进 step 代码**，全部以 effect 描述符 `pipelineStep` 挂对应 step、`trigger.point` 调用 modifier，经 enforcer 过滤；与 Story 1.6 射击流水线共用 step 注册表与 effect 扫描机制。
7. **AC7（合法性前置）**：进入流水线前由状态机（Story 1.9）+资格判定（Story 1.8）校验——攻击方控制范围内存在敌方（近战前提）、武器为 MELEE、阿斯塔特双近战特规；不合法则先验拦截（FR-14）不进入流水线。

## Tasks / Subtasks

- [ ] **T1 — step 注册表与签名**（AC1/AC6）
  - [ ] 在 `src/engine/pipeline/` 下定义 `MELEE_PIPELINE: StepFn[]`（7 步），与 `SHOOTING_PIPELINE` 共用统一 `StepFn` 签名（Story 1.6 已立）
  - [ ] 引擎按数组顺序驱动，复用 step 执行器（写日志/推进游标/暴露下一步-暂停-撤销）
- [ ] **T2 — MELEE_TARGET_SELECT / MELEE_WEAPON_SELECT**（AC1/AC7）
  - [ ] 目标选择：调几何（Story 1.8）确认攻击方控制范围内有敌方；对方将反击（双方都是攻击方+防守方）
  - [ ] 武器选择：各选 MELEE 武器；阿斯塔特双近战特规（两把近战武器各掷骰）作为条件分支，单测覆盖
- [ ] **T3 — MELEE_SIMULTANEOUS_ROLL**（AC1/AC2）
  - [ ] 双方同时掷攻击骰：`ctx.dice.roll(attacks)`（Story 1.5 骰源无关），各自按命中阈值保留成功（普通/关键）
  - [ ] `BEFORE_HIT_ROLL` / `AFTER_HIT_ROLL` effect 接入（印记附加规则、重掷/升级），经 enforcer
- [ ] **T4 — MELEE_ALTERNATING_RESOLVE 交替游标**（AC2，核心）
  - [ ] 定义 `AlternatingCursor`：`{ attackDice: SuccessDie[], parryDice: SuccessDie[], turn: "ATTACKER"|"DEFENDER", pendingIndex: number }`
  - [ ] 从攻击方开始，每次玩家对当前一枚成功骰选「出击（strike，造成伤害）」或「格挡（parry，抵消对方一枚）」→ 记子决策（建议结构：`{ actor, dieId, decision: "STRIKE"|"PARRY", targetDieId? }`）
  - [ ] 每个子决策可独立回滚（FR-16）：丢弃该子决策后从上一子决策快照恢复游标
  - [ ] 轮到对方时翻转 `turn`；dice 池耗尽或玩家确认结束 → 进 PARRY_RULES
- [ ] **T5 — MELEE_PARRY_RULES 格挡规则矩阵**（AC3）
  - [ ] 纯函数 `resolveParryRule(attackDie, parryDie, weaponRules): ParryOutcome`，矩阵覆盖：
    - 普通挡普通 → 抵消
    - 2 枚普通挡 1 枚关键 → 抵消
    - 关键挡任意（普通/关键）→ 抵消
    - 残暴（BRUTAL）武器：只能用关键成功格挡
    - 决斗家（DUELIST）：可用普通成功格挡关键成功
    - 震荡（CONCUSSIVE）：被震荡出击骰击中时，该防守骰被舍弃不可用于格挡
  - [ ] 全场景单测（含组合：残暴+关键、决斗家+震荡等）
- [ ] **T6 — MELEE_DAMAGE_AND_MITIGATE**（AC4）
  - [ ] 复用射击 `DAMAGE_PER_DIE`（`ON_DAMAGE_PER_DIE`：毁灭即时并行、剧毒 +1）与 `DAMAGE_TOTAL_MITIGATE`（`ON_DAMAGE_TOTAL`：恼人韧性/纳垢韧性每骰独立判定、钢铁光环 `IGNORE_DAMAGE` + oncePerBattle）
  - [ ] 若射击 step 已为纯函数，直接引用；否则抽取共享 step 模块（避免重复实现）
- [ ] **T7 — MELEE_AFTER 后效**（AC5）
  - [ ] 接入 `AT_PIPELINE_END`（毒素指示物获得，`GRANT_MARKER`）、`ON_INCAPACITATED`（无尽杀戮/剧毒破灭）、`BEFORE_WOUNDS_REDUCE`
  - [ ] 灵魂盛宴类机制以 effect 描述符挂此 step，经 enforcer
- [ ] **T8 — effect 接入与 enforcer**（AC5/AC6）
  - [ ] step 执行前后扫描 effect 栈按 `trigger.point` 调 modifier（复用 Story 1.4 enforcer + Story 1.6 扫描机制）
  - [ ] 近战特有限制：近战禁 <6 升级关键（CONDITIONAL，R2）作为 enforcer 规则覆盖
- [ ] **T9 — 回写状态**（AC1）
  - [ ] 流水线完成后回写：扣耐伤、effect 到期、指示物、CP/计谋次数（与状态机 Story 1.9 协同）
- [ ] **T10 — golden tests**（AC3/AC4/AC5）
  - [ ] 死亡天使近战金样：决斗家普通挡关键、猛攻撕裂、钢铁光环忽略一次
  - [ ] 输入快照 → 期望输出断言（复用 Story 1.3 golden 框架）

## Dev Notes

### 架构合规（必须遵循）

- **近战 7 步表（架构 §3.1）**：step id 与规则出处严格对齐——`MELEE_TARGET_SELECT`(选控制范围内敌方，对方反击) / `MELEE_WEAPON_SELECT`(各选近战武器，阿斯塔特双近战特规) / `MELEE_SIMULTANEOUS_ROLL`(双方同时掷攻击骰各自保留) / `MELEE_ALTERNATING_RESOLVE`(从攻击方轮流结算出击/格挡) / `MELEE_PARRY_RULES`(决斗家普通挡关键/残暴只能关键挡/震荡) / `MELEE_DAMAGE_AND_MITIGATE`(出击造伤+减免，同射击 step 8/9) / `MELEE_AFTER`(后效：灵魂盛宴等、毒素指示物)。
- **轮流结算状态化（架构 §3.1 末段）**：step 4 内部维护交替游标（attackDice/parryDice 池 + 当前轮到谁），每次玩家选择出击/格挡都是一个**子决策，记入日志**（满足 FR-16 单步回滚到任一子决策）。
- **可组合 step（架构 §3.1 可组合性）**：step 注册表 `MELEE_PIPELINE = [...]`，引擎按数组顺序驱动；阵营机制不写进 step 代码，通过 `pipelineStep` 字段挂 effect。
- **模块边界（AR-9）**：`src/engine` 纯逻辑零 UI 依赖；UI 只消费 store。
- **回滚（架构 §7.2）**：step 是纯函数 + inputs 快照，撤销 = 丢弃 cursor 后步骤、从 inputs 恢复，无需逆向计算。

### 关键约束

- **AQ-5 子决策日志粒度**：本故事采「每次出击/格挡各成一条子决策记入 StepRecord」（最大化可审计，对齐 FR-16）。若实现期发现日志膨胀，可在 review 时降级为合并记录——但默认最大化留痕。
- **格挡规则矩阵必须纯函数 + 全场景单测**：这是近战正确性核心（NFR-1），矩阵任一分支算错即缺陷。
- **减免逻辑复用而非重写**：`DAMAGE_PER_DIE` / `DAMAGE_TOTAL_MITIGATE` 与射击共享，避免两份实现发散。
- **骰源无关**：step 3 只调 `ctx.dice.roll(n)`，不感知电子/物理（Story 1.5 已立）。
- **近战特有 enforcer 规则**：R2 近战禁 <6 升级关键（CONDITIONAL）在 enforcer 集中处理，不散落到 step。

### 依赖（前置 story，假设已完成）

- **Story 1.2**：规则数据 schema + packLoader（effect 描述符、`pipelineStep`/`trigger.point` 字段）。
- **Story 1.4**：两层属性模型 + 集中 enforcer（12 条叠加规则按 policy 强制）。
- **Story 1.5**：骰源无关输入层（`DiceSource.roll(n)` 产出统一 `DiceRoll[]`）。
- **Story 1.6**：射击流水线——**复用其 step 注册表/执行器/`DAMAGE_PER_DIE`/`DAMAGE_TOTAL_MITIGATE`/effect 扫描机制**。
- **Story 1.8**：几何资格判定（近战前提：控制范围内有敌方）。
- **Story 1.9**：状态机行动合法性 guard（近战需敌方在控制范围）。
- **Story 1.10**：`ResolutionLog`/`StepRecord`/回滚基础设施——本故事写日志、支持单步回滚依赖它。

> 实现顺序提示：本故事与 1.8/1.9/1.10 在 epic 内可并行起稿，但**集成测试需四者就绪**。建议先写纯逻辑（step 函数/矩阵/enforcer 接入）+ 单测，UI 集成待 1.13/1.15。

## References

- 架构 §3.1（近战 7 步表 + 轮流结算状态化 + 可组合性）— `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- 架构 §3.3（enforcer 12 条规则矩阵，R2 近战禁<6 升级关键）— 同上
- 架构 §3.4（阵营机制接入正确 step）— 同上
- 架构 §7（结算日志 + 单步回滚，FR-16/17）— 同上
- 架构 §2.4.1（modifier.kind 枚举：`DAMAGE_MITIGATION`/`IGNORE_DAMAGE`/`GRANT_MARKER`/`ATTACH_WEAPON_RULE`）— 同上
- 架构 §2.4.2（触发点枚举：`ON_PARRY_ALLOCATION`/`ON_DAMAGE_PER_DIE`/`ON_DAMAGE_TOTAL`/`AT_PIPELINE_END`/`ON_INCAPACITATED`）— 同上
- Epic 1 Story 1.7 ACs — `planning-artifacts/epics.md`
- 规则源（近战规则/格挡/震荡/决斗家/残暴）— `docs/rules/merged_kt_lite_rules_zh.md`（本地，不入公开仓库 D-29）
- PRD FR-5（近战 7 步）/ FR-7（叠加规则）/ FR-16（单步回滚）/ FR-17（日志）— `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
