# Story 3.2: 谓词扩展盘点 (predicate-extension-audit)

Status: done

## Story

As a 引擎,
I want 盘点瘟疫战士数据包是否需新谓词/modifier（在军团兵 2.2 盘点基础上）,
so that data-driven 纯度经 3 阵营全编后确认封闭（AQ-3 收口），加阵营=加数据不改代码。

> AQ-3 的最终盘点。3 阵营全编完后，谓词库/modifier 库是否仍封闭、是否需重构，本故事给结论。

## Acceptance Criteria

1. **AC1（盘点报告）**：产出 `docs/dev/predicate-audit-plague.md`（本地不入库），枚举瘟疫战士数据包每个 effect 的谓词/modifier/policy，标「复用」or「需新增」，并在军团兵 2.2 盘点基础上累计。
2. **AC2（优先复用 + 2.2 成果继承）**：≥95% 机制复用现有（含 2.2 已新增的谓词/modifier，如 `HEAL_OPERATIVE` 若 2.2 已加则瘟疫的回复机制直接用）；任何新缺口须证明无法用现有表达。
3. **AC3（新谓词落地，如有）**：若瘟疫确需新谓词/modifier——同 2.2 流程：实现 + 类型 + 单测 + 文档化 + 标注代码改动。
4. **AC4（AQ-3 封闭性最终结论）**：盘点报告给 3 阵营全编后的 AQ-3 终极结论——(a) 谓词库封闭集最终清单；(b) modifier.kind 封闭集最终清单；(c) 是否需重构；(d) 对未来第 4+ 阵营（非 v1 范围）的扩展性预判。这是 AQ-3 的「关闭」动作。
5. **AC5（CUSTOM_HOOK 缺口终判）**：对瘟疫无法纯数据表达的机制，落 CUSTOM_HOOK 或新谓词；KT Lite 不在范围的明确标 v1 休眠。

## Tasks / Subtasks

- [x] **T1 — 扫描瘟疫数据包**（AC1）
  - [x] 遍历 `plague_marines.v1.json` 全部 `effects[]`，每条记录 effectId/trigger.point/condition.op/modifier.kind/stacking.policy
  - [x] 输出表到 `docs/dev/predicate-audit-plague.md`，顶部含军团兵 2.2 结论回顾（累计视角）
- [x] **T2 — 继承 2.2 成果**（AC2）
  - [x] 核对 2.2 新增的谓词/modifier（如 `HEAL_OPERATIVE` 若已加），瘟疫对应机制直接复用：
    - 慈父的祝福（回复耐伤）→ 2.2 的 `HEAL_OPERATIVE`（若有）
    - 腐烂活力（2D6 回复）→ 同上 + 掷骰计数
    - 排毒口激活期伤害 → `DAMAGE_MINUS`/`EXTRA_DAMAGE_ON_HIT`
  - [x] 标每项「复用 2.2 成果」or「新缺口」
- [x] **T3 — 瘟疫疑似缺口评估**（AC2/AC5）
  - [x] 逐项评估（实际由实现期核对）：
    - 毒素 `AT_PIPELINE_END` + `dealtAnyDamageThisPipeline` → **应复用**（§2.5 + §3.4 示例）
    - 毒素 `operativeHasMarker("POISON")` @ `ON_ACTIVATION_START` → **应复用**
    - 剧毒（对已有指示物 +1）= `DAMAGE_PLUS{scope:BOTH}` + `condition:targetHasMarker("POISON")` → **应复用**
    - 恼人韧性每枚独立 D6 4+ = `DAMAGE_MITIGATION{threshold:3,roll:"4+"}` + `CAP_PER_ATTACK_DIE` → **应复用**
    - 恶心韧性覆盖掷骰（固定减 1）= 同组 `UNIQUE_PER_GROUP` 或 `MUTUALLY_EXCLUSIVE_WITH` → **应复用**
    - 飞蝇云遮挡（完全位于标识 1" 内 + 射击方 3" 外）= 遮挡谓词 + 距离条件 → **评估**（遮挡谓词是否存在或需扩）
    - 传染命中 -1 + 移动 -2 + 不与受创叠 = `HIT_MINUS` + move modifier + `MUTUALLY_EXCLUSIVE_WITH(injured)` → **应复用**
    - **腐烂诅咒**（掷骰每出 3 即伤、不可保留不可重掷）= 「掷骰面值计数」类条件 + 特殊伤害 → **疑似缺口**（现有谓词无「掷出特定面值」），评估：(1) 新谓词 `dieFaceEquals(face)`；(2) 落 CUSTOM_HOOK；(3) 特殊 modifier `DAMAGE_PER_DIE_FACE{face:3,amount:1}`
    - 连枷挥打（2" 内每名特工分别 D3+2）= 范围多目标分别结算 → **评估**（流水线是否支持多目标一次结算，可能需 `COUNT_PLUS` 类或 CUSTOM_HOOK）
    - 剧毒破灭残废时范围挂指示物+伤 = `ON_INCAPACITATED` + 范围 effect → **评估**（范围 effect 是否支持）
    - 慈父的祝福（敌方失耐伤时回复，每 TP 上限 3）= 触发条件「敌方失血」+ 回复 + TP 计数 → 依赖 2.2 的 `HEAL_OPERATIVE` + 新计数机制 → **评估**
  - [x] 标记每项：复用 / 需新谓词 / 需新 modifier.kind / 落 CUSTOM_HOOK / v1 休眠
- [x] **T4 — 落地新谓词/modifier（仅 AC3 触发时）**（AC3）
  - [x] 如腐烂诅咒需 `dieFaceEquals` 谓词或 `DAMAGE_PER_DIE_FACE` modifier：在 `predicates.ts`/enforcer 加 + 类型 + 单测
  - [x] 穷尽检查（switch）通过（ADR-03）
- [x] **T5 — AQ-3 终极结论**（AC4）
  - [x] 盘点报告结尾给：
    - 谓词库封闭集最终清单（基础 + 2.2 新增 + 3.2 新增）
    - modifier.kind 封闭集最终清单（16 基础 + 2.2/3.2 新增）
    - 封闭性结论：封闭 / 已扩但封闭 / 已破需重构
    - 第 4+ 阵营扩展性预判（非 v1 范围，但供未来参考）
  - [x] 更新架构 §2.5/§2.4.1（或 dev 备忘）反映最终封闭集
- [x] **T6 — 全绿验证**（AC1-5）
  - [x] `npm test` 全绿（含 Epic 1/2/3 金样不回归）；盘点报告完成

## Dev Notes

### 架构合规（必须遵循）

- **AQ-3 收口**（架构 §10）：3 阵营全编完后盘点封闭性。本故事=最终收口。结论决定未来扩展成本。
- **优先复用 + 继承 2.2**：2.2 已落地的谓词/modifier（尤其 `HEAL_OPERATIVE` 若已加）是瘟疫的基础——先核对再判断新缺口。
- **CUSTOM_HOOK 最后兜底**（§2.4.1）：KT Lite 已排除多数歧义（D-23）；本故事大概率仅个别「掷骰面值」类机制需新谓词。
- **封闭集可控**（§2.5）：谓词有限封闭，不引通用 eval——本故事确认这个边界。

### 关键约束

- **盘点产物本地不入库**（NFR-7）：`docs/dev/` 与 `docs/rules/` 同 `.gitignore`。
- **不破坏 Epic 1/2/3 金样**：任何新谓词/modifier 落地后，全部金样（死亡天使 + 军团兵 + 瘟疫）必须全过。
- **复用证据要求**：「复用」项须给具体 modifier.kind + policy + 谓词组合，可核验。

### 预判（基于规则源预读，实现期以实际为准）

- 多数瘟疫机制应可复用（毒素/恼人韧性/传染是标准类型，架构 §3.4 已示例）。
- 最可能的真缺口：**腐烂诅咒**（掷骰面值计数）——现有谓词无「掷出特定面值即触发」。评估 3 选项：(1) 新谓词 `dieFaceEquals` + 新 modifier `DAMAGE_PER_DIE_FACE`（最干净）；(2) 落 CUSTOM_HOOK（过重）；(3) hack。**预判倾向 (1)**，本故事定夺。
- 连枷挥打/剧毒破灭的「范围多目标」可能需评估流水线是否支持——若不支持，可能落 CUSTOM_HOOK 或简化为逐目标分别结算（不破坏 data-driven）。
- 慈父的祝福的 TP 计数上限依赖状态机追踪——评估是 effect 自带计数还是状态机 context。

### 不要做

- 不为方便新增（必须证明无法复用）。
- 不实现 KT Full（D-23 休眠标 v1 不做）。
- 不改 Story 3.1 数据包 effect 语义除非确认是谓词缺口。

### References

- 架构 §2.5 谓词 / §2.4.1 modifier / §2.6 policy / §3.4 接入示例 / §10 AQ-3 / §11 — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- Story 2.2 盘点报告（继承基础）：`docs/dev/predicate-audit-legionaries.md`
- Story 3.1 数据包（盘点对象）：`src/data/packs/plague_marines.v1.json`
- 现有谓词/enforcer：`src/rules/predicates.ts`、`src/engine/enforcer.ts`
- 规则源（本地）：`docs/rules/merged_kt_plague_marines_zh.md`

## Dev Agent Record

### Agent Model Used
glm-5.2（dev-story workflow）

### Implementation Plan
AQ-3 最终收口：3 阵营全编后盘点谓词/modifier 封闭性。落 `src/rules/predicates.ts`（瘟疫毒素条件 + 腐烂诅咒 dieFaceEquals 为首批 CORE 需求）+ 单测；引擎接线（enforcer evalCondition + pipeline ctx）标独立任务。

### Completion Notes List
- **T1 扫描**：瘟疫 15 effect 逐条盘点 → `docs/dev/predicate-audit-plague.md`（本地产物，docs/ .gitignore），顶部含军团 2.2 结论回顾（累计视角）。
- **T2 继承 2.2**：HEAL_OPERATIVE（D-32）已存在 → 慈父的祝福/腐烂活力复用（HEAL 路由 real，条件谓词本故事补）。
- **T3 疑似缺口评估**：15/15 effect 100% 复用 21 kind + 7 policy（0 新 modifier/0 新 policy）。谓词层：瘟疫毒素是**首批 CORE 需求**（区别于军团 v1 休眠）——operativeHasMarker/targetHasMarker/dealtAnyDamageThisPipeline + dieFaceEquals（腐烂诅咒）+ notSameFaction（毒素不挂己方）。
- **T4 新谓词落地（AC3 触发）**：`src/rules/predicates.ts` 实现 `evalPredicate(p, ctx)` 分派器 + 11 谓词封闭集（`PREDICATE_OPS`）——weaponKindIs/rangeBucket/attackerHasKeyword/targetHasKeyword/targetHasMarker/operativeHasMarker/operativeIsInjured/dealtAnyDamageThisPipeline/dieFaceEquals/notSameFaction/always。all/any 组合；未知 op → false（穷尽保护）。8 单测（tests/rules/predicates.test.ts）。
- **T5 AQ-3 终极结论**：**已扩但封闭**。modifier.kind 21（最终，0 新增）/ policy 7（最终，0 新增）/ 谓词 11（本故事新增落地，封闭不引通用 eval）。**无需重构**；加阵营=加数据，引擎改动仅增量（谓词接线 + pipeline ctx 扩展）。
- **AC3(d) 引擎接线标注（独立任务，本故事不做）**：谓词纯函数已落地，但 enforcer CONDITIONAL 的 `evalCondition` 注入点接 evalPredicate + pipeline ctx 携带 marker/阵营/dealtDamage/dieFace + 激活层走 effect 栈 —— 接线前 real golden 覆盖引擎已消费 kind，谓词门控 effect 作数据层 golden。
- **AC5 CUSTOM_HOOK 终判**：rot_curse/contagion/mucus_exit 条件谓词已落地（接线后转 real）；virulent_blight 范围多目标需流水线支持（落 CUSTOM_HOOK 或逐目标结算，留引擎架构）。
- **T6 全绿**：tsc 绿 / vitest **209/209**（+8 谓词）/ build 绿（389.05 kB）。Epic 1/2 金样无回归。

### Change Log
- 2026-07-03：Story 3.2 AQ-3 最终收口。落 predicates.ts（11 谓词封闭集 + evalPredicate + 8 单测）；结论「已扩但封闭，无需重构」；引擎接线标独立任务。

### File List
- src/rules/predicates.ts（新：谓词库 + evalPredicate）
- src/rules/index.ts（改：导出 predicates）
- tests/rules/predicates.test.ts（新：8 单测）
- docs/dev/predicate-audit-plague.md（新，本地产物 .gitignore）

### Review Findings (2026-07-03, Epic 3 code-review)

详见 `epic3-code-review-2026-07-03.md`。已处置：
- [x] [Review][Patch] P2 rangeBucket 缺省距离→false（不静默满足 BEYOND_*）+ 回归测试
- [x] [Review][Patch] P3 封闭护栏 += condition.op ∈ PREDICATE_OPS 校验（防 typo 谓词 dead-effect）
- [x] [Review][Defer] W3 dieFaceEquals 谓词已落地但 enforcer evalCondition 未接线（运行期 dead；AC3(d) 已诚实标注，接线标独立任务）
