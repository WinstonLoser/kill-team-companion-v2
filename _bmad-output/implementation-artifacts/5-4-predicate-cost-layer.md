# Story 5.4: predicate-cost 层（自伤换升级） (predicate-cost-layer)

Status: ready-for-dev

## Story

As a 引擎,
I want 复用 Story 3.2 谓词库 + cost/替代层,
so that `wargear_chaos_talisman`（自伤 D3 换一次升级）等复杂条件 effect 生效——这类 effect 既有条件（谓词）又有代价（cost），是 CUSTOM_HOOK 中最复杂的一类。

## Acceptance Criteria

1. **AC1（cost 模型）**：effect 可声明 cost（如自伤 D3）+ 替代效果（如一次升级）；结算时若谓词条件命中，玩家可选择支付 cost 执行替代效果（咨询式，玩家终裁 D-24）。
2. **AC2（谓词复用）**：条件经 Story 3.2 谓词库求值（`evalCondition`），`chaos_talisman` 条件 = 豁免 2+ 失败 + 关键词匹配（operativeHasKeyword 等）。
3. **AC3（数据转 real）**：`wargear_chaos_talisman` 从 CUSTOM_HOOK 改为带 cost + condition 的真实 effect；golden 转 real（CUSTOM_HOOK 清零，或诚实标注真正需人工裁定的残留）。
4. **AC4（留痕 FR-17）**：cost 支付 + 替代效果执行进 resolution log（applied/rejected + rulings），可审计。
5. **AC5（无回归）**：Epic 1-4 金样/单测/e2e 不回归；既有 HEAL/CONDITIONAL effect 行为不变。

## Tasks / Subtasks

- [ ] **T1 — cost + 替代 effect 模型**（AC1）
  - [ ] 定 effect 形状：扩展 modifier payload 或新 kind 支持 `{ condition, cost: {kind:'self-damage', amount:'D3'}, substitute: <effect> }`
  - [ ] 决策：专用 `CONDITIONAL_COST` kind 还是扩 CONDITIONAL + payload cost 字段（推荐后者，复用谓词库）
  - [ ] 结算时：谓词命中 → 产出咨询式裁定（玩家是否支付）→ 支付则扣 cost + 执行 substitute
- [ ] **T2 — 谓词接线**（AC2）
  - [ ] chaos_talisman 条件：豁免失败（dieFaceLt/save-failed）+ operativeHasKeyword
  - [ ] 复用 `src/rules/predicates.ts`（Story 3.2）evalCondition
  - [ ] DEFENCE_UPGRADE step 处接入：条件命中则提示 cost 选项
- [ ] **T3 — 数据改写 + golden**（AC3）
  - [ ] `legionaries.v1.json`：chaos_talisman CUSTOM_HOOK → CONDITIONAL + cost + substitute
  - [ ] golden：2+ 失败 + 关键词 → 自伤 D3 → 升级一次（电子骰可复现）
- [ ] **T4 — 咨询式裁定 UI/状态**（AC1/D-24）
  - [ ] matchStore：cost 选项作 intent（AR-9），玩家 confirm 后引擎执行
  - [ ] 与既有 FindingStore 咨询式模式对齐（D-24 玩家终裁）
- [ ] **T5 — schema/类型同步**
  - [ ] types.ts：modifier payload 支持 cost/substitute 字段（或新 kind）
  - [ ] schema oneOf variant 扩；closure 护栏；schema-parity
- [ ] **T6 — 测试 + 验证**（AC4/AC5）
  - [ ] 单测：谓词命中 + cost 支付 → substitute 执行；不支付 → 不执行；进 log
  - [ ] CUSTOM_HOOK 盘点：确认清零或诚实标注残留
  - [ ] 全回归 + tsc/build

## Dev Notes

### 架构合规（必须遵循）

- **咨询式 + 玩家终裁（D-24）**：cost 是否支付由玩家裁定（不自动扣），引擎给选项 + 留痕；与几何 FindingStore 同模式。
- **谓词库复用（Story 3.2）**：条件走 predicates.ts，不为单一 effect 硬编码 if。
- **intent 驱动（AR-9）**：UI dispatch cost-支付 intent，引擎执行；不在视图层算 cost/条件。
- **留痕（FR-17）**：cost + substitute 进 resolution log。

### 关键约束

- **最复杂的 CUSTOM_HOOK**：本 story 是 Epic 5 收尾，也最难——cost + 条件 + 替代 + 咨询四要素。T1 的形状设计是关键决策点。
- **D3 伤害**：cost 自伤 D3 需骰（电子骰可复现，物理骰手填）——接既有骰源。
- **"升级一次"**：substitute = UPGRADE_SUCCESS（已有 kind），复用而非新建。
- **诚实盘点**：若 chaos_talisman 落地后仍因某些边角（如关键词匹配需 roster 上下文）无法纯引擎解，诚实标注残留 CUSTOM_HOOK（沿用 Epic 1/2 评审的诚实分类风格）。

### 不要做

- 不自动扣 cost（破坏 D-24 玩家终裁）。
- 不为单一 effect 硬编码（走谓词库 + 通用 cost 模型）。
- 不破坏既有 CONDITIONAL 透传/HEAL 行为。

### References

- 谓词库：`src/rules/predicates.ts`（Story 3.2）/ enforcer CONDITIONAL evalCondition（Story 1.4 DN2）
- 咨询式裁定模式：`src/geometry/geometry.ts` FindingStore（D-24，Epic 1 DN7）
- intent 驱动结算：`src/state/matchStore.ts`（AR-9，Epic 1 UI review D4）
- DEFENCE_UPGRADE step：`src/engine/pipeline/shooting.ts`
- 数据：`src/data/packs/legionaries.v1.json`（chaos_talisman）
- Epic 5 — `planning-artifacts/epics.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
