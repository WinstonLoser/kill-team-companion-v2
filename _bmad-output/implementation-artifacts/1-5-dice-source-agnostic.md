# Story 1.5: 骰源无关输入层 (dice-source-agnostic)

Status: ready-for-dev

## Story

As a 引擎,
I want 一个 DiceSource 接口 + ElectronicDiceSource（seedable Mulberry32，seed 入日志可复现）+ ManualDiceSource（物理骰录入）+ 统一 DiceRoll[],
so that 结算流水线对骰源无感知、电子/物理两源走同一修正流水线、结果一致且电子骰可复现（FR-17 回放）。

## Acceptance Criteria

1. **AC1（DiceSource 接口）**：`DiceSource` 接口定义 `roll(n: number, opts?): DiceRoll[]`；`DiceRoll { dieIndex, face:1..6, isCritical: boolean, seed?: string }`；两实现产出的 DiceRoll[] 结构完全一致。
2. **AC2（ElectronicDiceSource seedable）**：用 Mulberry32 PRNG；seed = hash(`pipelineId, stepId, attempt`)；seed 写入返回的 DiceRoll[].seed（或批量 seed 字段）；**同 seed 重投结果逐位一致**（可复现）。
3. **AC3（ManualDiceSource）**：构造时注入玩家录入的面值数组（UI 在 Story 1.13 提供），`roll(n)` 返回同结构 DiceRoll[]，`isCritical` 按自然点（通常 6）自动判定，无 seed。
4. **AC4（流水线无感知）**：step 只调 `ctx.dice.roll(n)`，不 import 具体实现、不分支判断来源；重掷/升级对两源一致（重掷：电子投产生新 seed；物理骰由 UI 提示玩家重投并录入——本 story 提供 `reroll(faces[])` helper 接口，UI 在后续 story）。
5. **AC5（seed 可复现单测）**：固定 `(pipelineId,stepId,attempt)` → 电子投结果序列可被「同 seed 重放」复现；物理骰注入固定面值 → 输出 deterministic。
6. **AC6（模块边界 + 可单测）**：`src/dice/` 零 UI/React 依赖；DiceSource/ElectronicDiceSource/ManualDiceSource/Mulberry32 全部独立可单测，无 DOM/时间依赖。

## Tasks / Subtasks

- [ ] **T1 — DiceRoll 类型 + DiceSource 接口**（AC1/AC4）
  - [ ] `src/dice/types.ts`：`DiceRoll { dieIndex:number; face:1|2|3|4|5|6; isCritical:boolean; seed?:string }`
  - [ ] `interface DiceSource { roll(n:number, opts?:{dieKind?:"ATTACK"|"DEFENCE"}): DiceRoll[] }`
  - [ ] critical 判定函数 `isCriticalFace(face, ctx)`：默认 face===6，可被 ctx 覆盖（致命 x+ 等改阈值在 effect 层，本层只暴露原始 face + 默认判定）
- [ ] **T2 — Mulberry32 PRNG**（AC2/AC6）
  - [ ] `src/dice/mulberry32.ts`：纯函数 `mulberry32(seed:number): ()=>number`（标准实现，0..1）
  - [ ] `hashSeed(pipelineId,stepId,attempt): number`：确定性字符串→32bit hash（如 cyrb53/FNV-1a，无依赖）
  - [ ] `faceFromRandom(r:number): 1..6` = `Math.floor(r*6)+1`
- [ ] **T3 — ElectronicDiceSource**（AC2）
  - [ ] `src/dice/electronic.ts`：构造 `new ElectronicDiceSource()`
  - [ ] `roll(n, opts)`：seed = hashSeed(ctx.pipelineId, ctx.stepId, ctx.attempt)；mulberry32(seed) 产 n 个 face；每 DiceRoll 带 seed（或批量记录 seed + dieIndex）
  - [ ] ctx 由调用方传入（pipeline 通过 ctx.dice 注入 pipelineId/stepId/attempt）
  - [ ] 同 seed 重投逐位一致（单测验证）
- [ ] **T4 — ManualDiceSource**（AC3）
  - [ ] `src/dice/manual.ts`：构造 `new ManualDiceSource(faces: number[])` 或可追加录入
  - [ ] `roll(n)`：取录入面值，转 DiceRoll[]，isCritical 按默认 6 判定，无 seed
  - [ ] 不足 n → 抛 `InsufficientManualDiceError`（UI 录入未达标不应调 roll；本层兜底）
- [ ] **T5 — reroll 支持**（AC4）
  - [ ] ElectronicDiceSource.reroll(dieIndices, ctx)：attempt+1 产新 seed 新序列
  - [ ] ManualDiceSource.reroll(faces[])：注入新录入面值
  - [ ] 接口扩展为可选 `reroll?`，pipeline 调用时类型收窄
- [ ] **T6 — 单测**（AC5/AC6）
  - [ ] `tests/dice/mulberry32.test.ts`：同 seed 序列一致、分布合理（大样本均值≈3.5）、faceFromRandom 边界
  - [ ] `tests/dice/electronic.test.ts`：固定 (pipelineId,stepId,attempt) 结果可复现；attempt 变化结果变；isCritical 默认 6
  - [ ] `tests/dice/manual.test.ts`：录入面值→DiceRoll[] 正确；不足 n 抛错
  - [ ] `tests/dice/parity.test.ts`：电子/物理两源各产出 DiceRoll[]，下游（占位 modifier 应用）对同 face 序列结果一致
- [ ] **T7 — 导出与边界**（AC6）
  - [ ] `src/dice/index.ts` 导出 DiceSource/ElectronicDiceSource/ManualDiceSource/DiceRoll/Mulberry32
  - [ ] 确认 `src/dice/` 无 react/zustand/DOM import；无 `Math.random`（电子骰只用 Mulberry32，保证可复现）

## Dev Notes

### 架构合规

- **§5 骰源无关**：`DiceSource.roll(n)` 接口；电子投 seedable Mulberry32，seed=`(pipelineId,stepId,attempt)` 入日志可复现（FR-17）；物理骰录入产出同结构 DiceRoll[]；**流水线对骰源无感知**，step 3/5 只调 `ctx.dice.roll(n)`。
- **§5 重掷**：电子投重掷新 seed；物理骰提示玩家重投录入。

### 关键约束

- **禁用 Math.random**：电子骰必须走 Mulberry32（可复现）。`src/dice/` 不允许 `Math.random()`（单测可静态检查无该调用）。
- **seed 入日志**：DiceRoll[].seed 必须可序列化，进 StepRecord.diceRolls（§7.1），回放时同 seed 重产同序列。
- **isCritical 默认 face===6**：致命/强健等改阈值属 effect（UPGRADE_SUCCESS 等），本层只产原始 face + 默认判定，引擎/effect 层可重判。避免本层耦合规则。
- **纯逻辑零 UI**：ManualDiceSource 只接收面值数组，不关心 UI 录入交互（6 面网格点选在 Story 1.13）。
- **确定性 hash**：seed hash 必须跨平台一致（同字符串同 32bit），用 FNV-1a/cyrb53，不用 Date/随机。
- **D6 only**：KT 全部 D6，不建模多面骰（YAGNI）。

### Project Structure Notes

- 落位 `src/dice/{types.ts,mulberry32.ts,electronic.ts,manual.ts,index.ts}`；测试 `tests/dice/`。
- 与架构 §9 `dice/` 一致。

## References

- 架构 §5（骰源无关：DiceSource 接口 / ElectronicDiceSource Mulberry32 seed=(pipelineId,stepId,attempt) / ManualDiceSource / 统一 DiceRoll[] / 流水线无感知）— `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- 架构 §7.1（StepRecord.diceRolls 含 seed，回放复现）/ §7.3（FR-17 回放）— 同上
- Epic 1 Story 1.5 — `planning-artifacts/epics.md`
- PRD FR-3（骰源无关）/ FR-17（结算日志回放）— `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- 依赖：Story 1.1（脚手架）；被 Story 1.6（pipeline 通过 ctx.dice 注入）消费

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
