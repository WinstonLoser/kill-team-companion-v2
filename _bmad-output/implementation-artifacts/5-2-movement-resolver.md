# Story 5.2: movement resolver（移动距离模型） (movement-resolver)

Status: ready-for-dev

## Story

As a 引擎,
I want 移动距离 + modifier 的引擎模型,
so that `mark_slaanesh`（移动 +1）等移动 effect 生效——当前移动全在 UI 棋盘（无引擎距离模型），移动类 effect 无从消费。

## Acceptance Criteria

1. **AC1（effectiveMove 纯函数）**：`effectiveMove(baseMove, activeEffects)` = base move + Σ 移动 modifier（色孽印记 +1），纯函数，UI/matchStore 调（AR-9），对齐 `effectiveApl` 模式。
2. **AC2（移动合法性接引擎，FR-12）**：特工移动时，引擎校验路径总长 ≤ effectiveMove；超出则非法（UI 调引擎判，不在视图层算）。
3. **AC3（数据转 real）**：`mark_slaanesh` 从 `CUSTOM_HOOK` 改为真实移动 modifier kind（如 `MOVE_PLUS`{amount:1}）挂 ON_ACTIVATION_START；golden 转 real（CUSTOM_HOOK 减 1）。
4. **AC4（无回归）**：Epic 1-4 金样/单测/e2e 不回归；无移动 effect 时移动力 = base（行为同前）。
5. **AC5（schema 同步）**：新 kind 进 MODIFIER_KINDS + schema oneOf + 闭合护栏 + schema-parity。

## Tasks / Subtasks

- [ ] **T1 — movement modifier kind**（AC1/AC3）
  - [ ] 定 kind：`MOVE_PLUS`/`MOVE_MINUS`{amount} 或通用 `STAT_OVERRIDE`{stat:'move'}（与 5.1 stat-override 决策一致）
  - [ ] `mark_slaanesh`：CUSTOM_HOOK → 真实 kind，trigger ON_ACTIVATION_START，pipelineStep ACTIVATION_PRE
  - [ ] 新增 `effectiveMove(baseMove, activeEffects)`（state/turnStateMachine.ts 或新 engine/activation.ts）
- [ ] **T2 — 移动合法性校验**（AC2）
  - [ ] 引擎移动校验函数：`canMovePath(operative, path, activeEffects)` = 路径折线总长 ≤ effectiveMove
  - [ ] 几何模块已有距离工具（distPointSeg 等）复用算路径长
  - [ ] UI 棋盘拖拽（matchStore/Board）调此函数判合法（AR-9 intent 驱动）
- [ ] **T3 — 数据 + golden**（AC3）
  - [ ] `legionaries.v1.json`：mark_slaanesh 改 kind
  - [ ] golden：色孽特工 effectiveMove = base+1 实测
  - [ ] closure 护栏确认
- [ ] **T4 — schema/类型同步**（AC5）
  - [ ] types.ts Modifier += MOVE_PLUS/MINUS；MODIFIER_KINDS += ；schema oneOf += variant
  - [ ] schema-parity 数量断言更新
- [ ] **T5 — 测试 + 验证**（AC4）
  - [ ] 单测：effectiveMove 叠加；canMovePath 边界（恰等于/超出 1"）
  - [ ] UI e2e：移动超过移动力被拒（若 UI 已接）
  - [ ] 全回归 + tsc/build

## Dev Notes

### 架构合规（必须遵循）

- **移动是引擎能力（FR-12）**：当前移动合法性只在 UI 棋盘隐式处理；本 story 把「移动力 + 路径校验」下沉为引擎纯函数，UI 调用（AR-9）。
- **几何复用（§4）**：路径长度用几何模块现有距离工具，不重算。
- **纯函数（AR-9）**：effectiveMove / canMovePath 纯函数，无副作用。

### 关键约束

- **UI 接线范围**：本 story 交付引擎模型 + 函数；UI 棋盘是否完全改用引擎校验可分步（先引擎函数 + 单测，UI 接线作 T2 的一部分或留 5.x）——决策点。
- **与 5.1 stat-override 一致**：若 5.1 选通用 STAT_OVERRIDE，移动也走同一机制（stat:'move'），避免两套。
- **后撤/冲锋的移动**：FALL_BACK/CHARGE 的移动距离也走 effectiveMove（同 base 规则）。

### 不要做

- 不在视图层算移动距离（AR-9）。
- 不为移动引入新 policy 除非 enforcer 需要（复用 STACKABLE/UNIQUE_PER_SOURCE）。
- 不破坏现有 UI 拖拽体验（引擎校验失败时 UI 给清晰反馈，不静默卡住）。

### References

- effectiveApl 模式：`src/state/turnStateMachine.ts`（W3a）
- 几何距离工具：`src/geometry/geometry.ts`（distPointSeg 等）
- UI 棋盘移动：`src/ui/match/`（Board / matchStore）
- 数据：`src/data/packs/legionaries.v1.json`（mark_slaanesh）
- Epic 5 — `planning-artifacts/epics.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
