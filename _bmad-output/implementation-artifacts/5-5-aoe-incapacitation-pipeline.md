# Story 5.5: AoE 多目标 + ON_INCAPACITATED 流水线 (aoe-incapacitation-pipeline)

Status: ready-for-dev

## Story

As a 引擎,
I want 流水线支持范围多目标结算 + 残废触发,
so that 剧毒破灭（残废时 3" 可见敌方挂 POISON + 已有指示物的受 1 伤）等 AoE/incap 机制 real。

## Acceptance Criteria

1. **AC1（ON_INCAPACITATED 触发）**：WOUNDS_APPLY 后若 `defenderIncapacitated`，引擎触发 `ON_INCAPACITATED` point 的 effect 栈（此前 AT_PIPELINE_END 不区分残废/非残废）。
2. **AC2（范围多目标）**：支持「3"内可见 N 名敌方」的 AoE 结算——effect payload 带 `{aoeRange, aoeTargetSide}`，引擎枚举范围内目标逐一应用（GRANT_MARKER / EXTRA_DAMAGE）。
3. **AC3（virulent_blight 转 real）**：plg_virulent_blight 从 CUSTOM_HOOK 转 ON_INCAPACITATED + AoE GRANT_MARKER + EXTRA_DAMAGE（已有 POISON 的目标 +1 伤），golden 验。
4. **AC4（无回归）**：Epic 1-4 金样 + 谓词接线 + 毒素 loop 不回归。

## Tasks / Subtasks

- [ ] **T1 — ON_INCAPACITATED 步**（AC1）：shooting WOUNDS_APPLY 后若 incapacitated → 追加一步消费 ON_INCAPACITATED effect（GRANT_MARKER/EXTRA_DAMAGE）。
- [ ] **T2 — AoE 枚举**（AC2）：effect payload `{aoeRange, aoeTargetSide}` → 引擎从 board 查范围内可见目标 → 逐一应用。
- [ ] **T3 — virulent_blight 转 real**（AC3）：CUSTOM_HOOK → GRANT_MARKER POISON + EXTRA_DAMAGE（已有 POISON 目标 +1），AoE 3"可见敌方。
- [ ] **T4 — golden**：virulent_blight real（残废 → 范围敌方挂 POISON + 已有的受 1 伤）。
- [ ] **T5 — 全绿验证**。

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
