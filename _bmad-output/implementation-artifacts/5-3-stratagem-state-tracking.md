# Story 5.3: 计谋状态追踪系统（active stratagem） (stratagem-state-tracking)

Status: ready-for-dev

## Story

As a 引擎,
I want 已激活计谋的持续状态追踪 + effect 注入,
so that `strat_swift_speed`（敌方命中 -1）/ `strat_capricious_fate`（防御方升级）等持续型计谋在结算时真实生效（当前是 CUSTOM_HOOK 描述符，因缺「active stratagem」状态）。

## Acceptance Criteria

1. **AC1（active stratagem 状态）**：计谋使用时记入 active stratagem 状态（带 duration：本激活 / 本转折点 / 本场，+ phase 限定），存于 turnState / matchState。
2. **AC2（effect 注入结算）**：active stratagem 的 effect 在后续结算的 effect 栈中被注入——`strat_swift_speed` 改变命中阈值（敌方 -1），`strat_capricious_fate` 改变防御成功（升级），实际改变骰结果（非描述符）。
3. **AC3（到期/用尽撤除）**：duration 到期（激活结束 / 转折点结束）或单次用尽后，active stratagem 自动撤除，effect 不再注入。
4. **AC4（数据转 real）**：`strat_swift_speed` / `strat_capricious_fate` 从 CUSTOM_HOOK 改为真实 effect kind（HIT_MINUS / 防御升级 kind）+ duration 元数据；golden 转 real（CUSTOM_HOOK 减 2）。
5. **AC5（无回归）**：Epic 1-4 金样/单测/e2e 不回归；既有计谋次数追踪（USE_PLOY / ployUses）不变。

## Tasks / Subtasks

- [ ] **T1 — active stratagem 状态模型**（AC1）
  - [ ] turnState/matchState += `activeStratagems: { stratagemId, source, duration, phase, expiresAt }[]`
  - [ ] USE_PLOY 时除计次数外，若该计谋有持续 effect，追加 activeStratagems 条目
  - [ ] duration 语义：ACTIVATION（激活结束撤）/ TURNING_POINT（转折点结束撤）/ ONCE（首次满足条件后撤）
- [ ] **T2 — effect 注入结算**（AC2）
  - [ ] resolveShooting/runMelee 构造 effect 栈时，合并 activeStratagems 对应 effect（按 phase/触发点过滤）
  - [ ] swift_speed：注入 HIT_MINUS（敌方命中 -1）effect；capricious_fate：注入防御方升级 effect
  - [ ] 既有 enforcer/pipeline 消费这些 kind（HIT_MINUS 已消费；防御升级走 DEFENCE_UPGRADE 或新 kind）
- [ ] **T3 — 到期撤除**（AC3）
  - [ ] END_ACTIVATION / END_TURNING_POINT reducer 移除到期 activeStratagems
  - [ ] ONCE 类：触发并结算后撤除
- [ ] **T4 — 数据改写 + golden**（AC4）
  - [ ] `legionaries.v1.json`：swift_speed / capricious_fate 从 CUSTOM_HOOK 改真实 kind + duration
  - [ ] stratagems[] 元数据补 duration（若需）
  - [ ] golden：两计谋在 active 状态下实测改变结果
- [ ] **T5 — schema/类型同步**（若新 kind）
  - [ ] 防御方升级若无现成 kind，定一个（或复用 UPGRADE_SUCCESS + 触发点 AFTER_DEFENCE_ROLL）
  - [ ] types.ts / schema oneOf / closure 护栏 / schema-parity
- [ ] **T6 — 测试 + 验证**（AC5）
  - [ ] 单测：active stratagem 注入 effect 改变结算；到期撤除后不再生效
  - [ ] 全回归 + tsc/build

## Dev Notes

### 架构合规（必须遵循）

- **状态机扩展（FR-11）**：activeStratagems 进 turnState（或 matchStore），reducer 管 lifecycle；XState 包装同步。
- **intent 驱动（AR-9）**：UI dispatch USE_PLOY，引擎更新 activeStratagems + 注入结算；不在视图层手算计谋 effect。
- **留痕（FR-17）**：注入的 effect 走正常 applied/rejected 留痕；activeStratagems 状态可审计。

### 关键约束

- **duration 模型是核心**：KT 计谋持续期多样（本激活 / 本转折点 / 本战斗 / 单次）——T1 的 duration 枚举要覆盖数据中实际出现的，参考 stratagems[].useLimit 既有元数据。
- **注入点**：effect 栈合并要在 pipeline 构造 ctx.effects 处（runShooting/runMelee 入口），不在每个 step 内散落。
- **与既有计谋次数（ployUses）正交**：次数追踪（每场/每 TP 上限）不变，本 story 加的是「使用后的持续状态」。

### 不要做

- 不把 activeStratagems 塞进每次结算的入参让 UI 拼（引擎自管状态）。
- 不为单一计谋硬编码 if-stratagem（破坏 data-driven，AQ-3）。
- 不改既有 USE_PLOY / ployUses 语义。

### References

- 计谋次数追踪：`src/state/turnStateMachine.ts`（USE_PLOY / canUsePloy / ployUses）
- effect 栈构造：`src/engine/pipeline.ts` runShooting ctx / `src/engine/melee.ts`
- 既有消费 kind：HIT_MINUS（HIT_ROLL）/ DEFENCE_UPGRADE step
- 数据：`src/data/packs/legionaries.v1.json`（swift_speed / capricious_fate / stratagems[]）
- Epic 5 — `planning-artifacts/epics.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
