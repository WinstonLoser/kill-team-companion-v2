# Story 5.6: 激活层 dieFace + 范围 effect (activation-dieface-layer)

Status: ready-for-dev

## Story

As a 引擎,
I want 激活层支持掷骰面值判定 + 范围效果,
so that 排毒口（3"内敌方激活时 D3=3 挂 POISON / 已有则 D3 伤）等激活期机制 real。

## Acceptance Criteria

1. **AC1（激活层掷骰）**：激活期（ON_ACTIVATION_START）effect 支持 dieFaceEquals 条件 + 骰源注入——引擎在激活时为 CONDITIONAL effect 掷骰 + 求值。
2. **AC2（激活层范围）**：激活期 effect payload 带 `{range, targetSide}` → 枚举范围内敌方。
3. **AC3（mucus_exit 转 real）**：wargear_mucus_exit 从 CUSTOM_HOOK → CONDITIONAL dieFaceEquals(3) @ ON_ACTIVATION_START + AoE 3"内敌方 → D3=3 挂 POISON / 已有 POISON 的受 D3 伤。
4. **AC4（无回归）**：Epic 1-5 金样不回归。

## Tasks / Subtasks

- [ ] **T1 — 激活层掷骰求值**（AC1）：激活期 effect 携 dieFaceEquals → 引擎掷 D6 + evalPredicate。
- [ ] **T2 — 激活层范围枚举**（AC2）：payload `{range, targetSide}` → 枚举激活特工附近敌方。
- [ ] **T3 — mucus_exit 转 real**（AC3）：CUSTOM_HOOK → CONDITIONAL + GRANT_MARKER/EXTRA_DAMAGE。
- [ ] **T4 — golden**：mucus_exit real。
- [ ] **T5 — 全绿验证**。

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
