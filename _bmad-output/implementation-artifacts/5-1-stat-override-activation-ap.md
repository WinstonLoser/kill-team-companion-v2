# Story 5.1: stat 覆写 + activation AP（最小层先跑通） (stat-override-activation-ap)

Status: ready-for-dev

## Story

As a 引擎,
I want 属性覆写层 + activation AP mod 落地,
so that `wargear_warding_armour`（save 覆写 2+）与 `chapterTactic_mobile`（后撤 AP-1）不再是 CUSTOM_HOOK 描述符，而是引擎真实消费。

## Acceptance Criteria

1. **AC1（save 覆写，FR-2 两层模型扩）**：覆写类 effect（新 `SAVE_OVERRIDE` kind 或 stat-override 通用机制）在 DEFENCE_ROLL 生效——豁免阈值用覆写值（守护护甲 2+），经 enforcer/resolveStat 两层模型留痕（base 不变，覆写进 modifier），`enforcerWithTrace` 记录。
2. **AC2（activation AP mod）**：activation effect（`chapterTactic_mobile` 后撤 AP-1）在构造 `ActionContext` / `ACTION_AP` 时应用——后撤实际 AP 消耗减少，`effectiveApl` 模式对称扩到 AP（`effectiveActionAp(action, baseAp, effects)`）。
3. **AC3（数据转 real）**：`wargear_warding_armour` 从 `CUSTOM_HOOK` 改为真实 kind + 接引擎；`chapterTactic_mobile` 接 activation AP 层；两者 golden 转 real（CUSTOM_HOOK 6→4）。
4. **AC4（无回归）**：所有 Epic 1-4 金样/单测/e2e 不回归；既有豁免结算数值不变（无覆写 effect 时行为同前）。
5. **AC5（schema 同步）**：若新增 kind，`MODIFIER_KINDS` + faction-pack.schema.json discriminated oneOf + 闭合护栏 + schema-parity 同步（沿用 Epic 2 W2 模式）。

## Tasks / Subtasks

- [ ] **T1 — save 覆写设计**（AC1）
  - [ ] 定 kind：优先扩成通用 `STAT_OVERRIDE`{stat:'save', value:2} 还是专用 `SAVE_OVERRIDE`{value:2}——权衡 schema 复用（推荐 STAT_OVERRIDE，为 5.x movement/AP 等其他 stat 留口）
  - [ ] `resolveStat` 已支持两层模型（base + modifiers）→ 覆写作为一种 modifier（amount = value - base，或覆写语义 policy）；决定 policy（新 `OVERRIDE` policy？或复用 UNIQUE_PER_SOURCE）
  - [ ] DEFENCE_ROLL step：`saveThresh = clampHits(resolveStat(defender.save, saveOverrideMods).effective)`（当前直接 `clampHits(defender.save)`）
- [ ] **T2 — activation AP 层**（AC2）
  - [ ] 新增 `effectiveActionAp(action, baseAp, activeEffects)`（state/turnStateMachine.ts，与 `effectiveApl` 同文件/模式）
  - [ ] canDoAction 的 AP 校验改用 effective AP：`op.apUsed + effectiveActionAp(...) <= ctx.apl`（或 AP-cost 视角：后撤 AP-1 = ACTION_AP[FALL_BACK] 有效值减 1）
  - [ ] chapterTactic_mobile effect：从 CUSTOM_HOOK 改为真实 AP-mod kind（如 `ACTION_AP_MOD`{action:'FALL_BACK', delta:-1}）挂 ON_ACTIVATION_START
- [ ] **T3 — 数据改写 + golden**（AC3）
  - [ ] `legionaries.v1.json`：warding_armour → SAVE_OVERRIDE/STAT_OVERRIDE；chapterTactic_mobile → ACTION_AP_MOD
  - [ ] 新增/更新 golden：warding_armour 豁免 2+ 实测；chapterTactic_mobile 后撤 AP 实测
  - [ ] 跑 closure 护栏确认枚举/四问齐全
- [ ] **T4 — schema + 类型同步**（AC5）
  - [ ] rules/types.ts：Modifier union += 新 kind；MODIFIER_KINDS += ；schema oneOf += variant
  - [ ] schema-parity 测试数量断言更新；closure 护栏通过
- [ ] **T5 — 测试 + 验证**（AC4）
  - [ ] 单测：save 覆写改变 DEFENCE_ROLL 阈值；AP-mod 改变 canDoAction
  - [ ] 全金样/e2e 回归（Epic 1-4 不破坏）
  - [ ] tsc/build clean

## Dev Notes

### 架构合规（必须遵循）

- **两层属性模型（FR-2）**：覆写仍走 modifier（base 不可变），不直接改 base。覆写语义用 policy 表达，enforcer 集中裁决（FR-7）。
- **纯函数 + intent 驱动（AR-9）**：`effectiveActionAp` 纯函数，UI/matchStore 构造 ActionContext 时调；不在视图层调引擎。
- **留痕（FR-17）**：覆写/AP-mod 经 enforcerWithTrace，rejectedEffectIds 可审计。

### 关键约束

- **stat-override vs save-override 取舍**：通用 STAT_OVERRIDE 为后续 stat（move 等）留口，但 schema/policy 更复杂；专用 SAVE_OVERRIDE 简单但重复。本 story 决策点（见 T1）。
- **向后兼容**：无覆写 effect 时 DEFENCE_ROLL 数值不变（clampHits 行为同前）。
- **数据契约**：改 kind 需同步 schema oneOf + closure 护栏（Epic 2 W2 建的机制）。

### 不要做

- 不直接改 base stat（破坏 FR-2 不变量）。
- 不在视图层算 AP/save（AR-9）。
- 不为单一 stat 引入整套通用覆写框架除非 T1 论证值得（避免过度工程）。

### References

- 两层属性 + enforcer：`src/engine/statResolver.ts` / `src/engine/enforcer.ts` / Story 1.4
- DEFENCE_ROLL 现状：`src/engine/pipeline/shooting.ts`（P18 saveThresh = clampHits(defender.save)）
- effectiveApl 模式：`src/state/turnStateMachine.ts`（Story 2.x W3a）
- schema oneOf 模式：`src/rules/schema/faction-pack.schema.json`（Epic 2 W2）
- 数据：`src/data/packs/legionaries.v1.json`（warding_armour / chapterTactic_mobile）
- Epic 5 — `planning-artifacts/epics.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
