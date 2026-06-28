# Story 1.4: 两层属性模型与集中 enforcer (two-layer-attrs-enforcer)

Status: ready-for-dev

## Story

As a 引擎,
I want 两层属性模型（base 不可变 + modifiers 留痕 + effective 求和）与一个集中纯函数 enforcer 强制 12 条叠加规则,
so that 属性叠加正确、12 条叠加规则集中可测、回滚只需撤销 modifier 应用记录。

## Acceptance Criteria

1. **AC1（两层属性）**：`EffectiveStat { base, modifiers: AppliedModifier[], effective }`；`base` 来自 operative.stats（含持徽手等静态调整，§2.2），**运行期不可变**；`effective = base + Σ(经 enforcer 过滤的 modifiers)`，引擎只读 effective。
2. **AC2（resolveStat 纯函数）**：`resolveStat(operative, statName, ctx): EffectiveStat`：取 base → 收集所有 active effect 中针对该 stat 的 modifier → 经 enforcer 过滤 → 求和；同一输入同一输出（可单测）。
3. **AC3（enforcer 纯函数 + 12 条规则矩阵）**：`enforcer(modifiers, ctx): AppliedModifier[]` 纯函数，集中实现架构 §3.3 的 R1-R12 规则矩阵，按 `stacking.policy` + `groupKeys` 去重/互斥/封顶；返回过滤后保留的 modifiers（被拒的不丢，由调用方记 trace）。
4. **AC4（典型场景正确）**：单测覆盖至少——同类成功升级不叠（R1/UNIQUE_PER_GROUP）、同源减伤每枚上限 1（R3/CAP_PER_ATTACK_DIE）、命中-1 不与受创叠（R4/MUTUALLY_EXCLUSIVE_WITH）、掩护豁免不与制高点叠（R5）、战团战术不自我叠加（R6/UNIQUE_PER_SOURCE）、关键穿刺条件触发（R7/CONDITIONAL）、持徽手 APL 叠加（R10/STACKABLE）、传染不与受创累计（R12）。
5. **AC5（拒绝留痕）**：enforcer 对被拒 modifier 产出 `RejectionTrace { modifierId, ruleId: R1..R12, reason }`（不被丢弃），供 StepRecord.appliedEffects 记「被拒 effect + enforcer 规则编号」（§7.3 回放需要）。
6. **AC6（模块边界 + 全覆盖）**：`src/engine/` 零 UI 依赖；enforcer + resolveStat + EffectiveStat 单测覆盖率 ≥ 95%（FR-7 是头号正确性护栏）。

## Tasks / Subtasks

- [ ] **T1 — AppliedModifier / EffectiveStat 类型**（AC1）
  - [ ] `src/engine/stat.ts`：`AppliedModifier`（id/source/effectId/targetStat/kind+payload/stacking{policy,groupKeys?}/amount）
  - [ ] `EffectiveStat { base:number; modifiers:AppliedModifier[]; effective:number }`
  - [ ] `StatName` 联合：apl/move/save/wounds（+ 可扩展 hit/defence 等结算期属性）
- [ ] **T2 — enforcer 规则矩阵**（AC3/AC4/AC5）
  - [ ] `src/engine/enforcer.ts`：`enforcer(modifiers, ctx): { kept: AppliedModifier[]; rejected: RejectionTrace[] }`
  - [ ] 实现 R1-R12（§3.3 表），每条规则一个内部函数：
    - R1 UNIQUE_PER_GROUP：按 groupKeys 去重，同类升级只保留一条（优先级/最大值策略记入 Dev Notes）
    - R2 CONDITIONAL（近战禁<6 升级关键）：读 ctx 判定
    - R3 CAP_PER_ATTACK_DIE：同源减伤 amount 上限 1/源
    - R4/R5/R12 MUTUALLY_EXCLUSIVE_WITH：按 groupKeys 互斥组去重（受创组/highGround 组/injured 组）
    - R6 UNIQUE_PER_SOURCE：同 source 唯一
    - R7 CONDITIONAL：关键穿刺仅 attackerHasCritical 时挂
    - R8 毁灭即时并行：非 stacking 约束，enforcer 不处理（注释说明属 step 8 语义）
    - R9 UNIQUE_PER_ACTION：按 actionId 去重（过热每行动一次）
    - R10 STACKABLE：全保留
    - R11 毒素时机：非 stacking，属触发点约束（AT_PIPELINE_END），enforcer 注释不处理
  - [ ] policy 派发用 switch 穷尽（TS strict 强制每 policy 有分支）
  - [ ] `EnforcerContext`：{ attackerHasCritical?, operativeInjured?, actionId?, attackDieIndex?, oncePerBattleUsed?:Record<id,boolean> }
- [ ] **T3 — resolveStat**（AC2）
  - [ ] `src/engine/stat.ts`：`resolveStat(operative, statName, ctx)`：base ← operative.stats；收集 active effect 产出、targetStat 匹配的 modifier；enforcer 过滤；effective = base + Σ(kept.amount * sign)
  - [ ] 纯函数：同入同出；不 mutate operative
- [ ] **T4 — RejectionTrace**（AC5）
  - [ ] `RejectionTrace { modifierId; effectId?; ruleId: "R1".."R12"; reason: string }`
  - [ ] enforcer 返回 kept + rejected 双数组；调用方（Story 1.6 pipeline）写 StepRecord
- [ ] **T5 — 单测全覆盖**（AC4/AC6）
  - [ ] `tests/engine/enforcer.test.ts`：R1-R12 每条至少一例（合法保留 + 非法拒绝）；多 policy 混合场景；空 modifiers；同组多条去重
  - [ ] `tests/engine/stat.test.ts`：resolveStat base 不可变、modifiers 求和、enforcer 过滤后 effective 正确；持徽手 APL 叠加（R10）；受创 -1 不与外部命中-1 叠（R4）
  - [ ] 覆盖率门槛 ≥ 95%（Vitest c8/istanbul）
- [ ] **T6 — 导出与边界**（AC6）
  - [ ] `src/engine/index.ts` 导出 enforcer/resolveStat/EffectiveStat/AppliedModifier/RejectionTrace
  - [ ] 确认 `src/engine/` 无 react/zustand import

## Dev Notes

### 架构合规

- **§3.2 两层属性**：`EffectiveStat { base, modifiers, effective }`，base 运行期不可变——「回滚只需撤销 modifier 应用记录，不必回写基础值」是关键不变量（§7.2 依赖此）。
- **§3.3 enforcer 集中**：12 条规则**集中**实现，非散落到各 step 的 if。新增规则 = enforcer 加一条 + 数据包标对 policy（SM-C1 可单测全覆盖）。
- **§2.6 policy → 规则映射**：R1-R12 全部落到 6 种 policy 上，enforcer 按 policy 派发，policy 是判别字段。

### 关键约束

- **纯函数**：enforcer/resolveStat 不得 mutate 入参、不得读全局、不得有副作用（可单测、可回滚、可回放）。
- **TS strict 穷尽**：policy 派发用 `switch(policy)` 不带 default，让新增 policy 编译期报错（ADR-03）。
- **base 来源（§2.2）**：持徽手 APL 类「非修正调整」算 base 一部分，在数据静态写明，不走 effect（PRD FR-2）。enforcer 只管运行期 modifier。
- **R8/R11 非 stacking**：毁灭即时并行（step 语义）、毒素时机（触发点约束）不在 enforcer，但矩阵中列出以示完整——实现处加注释指向 Story 1.6。
- **R9 UNIQUE_PER_ACTION**：架构矩阵列出但 §2.6 policy 枚举只列 6 种（无 UNIQUE_PER_ACTION）。**实现策略**：R9 用 UNIQUE_PER_SOURCE + groupKeys=[actionId] 表达，或扩展 policy——选前者更保守（不扩枚举），记入 Dev Notes。
- **拒绝不丢弃**：被拒 modifier 必须以 RejectionTrace 返回，回放面板要显示「被拒 effect + 规则编号 R1-R12」（§7.3）。
- **依赖**：消费 Story 1.2 的 modifier.kind/stacking.policy 类型；不依赖骰源/几何/UI。

### Project Structure Notes

- 落位 `src/engine/{stat.ts,enforcer.ts,index.ts}`；测试 `tests/engine/{enforcer.test.ts,stat.test.ts}`。
- 与架构 §9 `engine/` + `enforcer.ts` 一致。

## References

- 架构 §3.2（两层属性）/ §3.3（enforcer 规则矩阵 R1-R12）/ §2.6（policy 枚举）/ §7.3（被拒 effect 记规则编号）— `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- 架构 ADR-03（strict + 判别联合）/ SM-C1（正确性优先）— 同上
- Epic 1 Story 1.4 — `planning-artifacts/epics.md`
- PRD FR-2（两层属性）/ FR-7（12 条叠加规则）/ NFR-1（正确性头号）— `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- 依赖：Story 1.2（modifier/policy 类型）

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
