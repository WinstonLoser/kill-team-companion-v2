# Story 2.2: 谓词/modifier 扩展盘点 (predicate-extension-audit)

Status: ready-for-dev

## Story

As a 引擎,
I want 盘点军团兵数据包是否需新谓词/modifier,
so that data-driven 纯度保持（AQ-3 谓词库封闭性），加阵营=加数据不改代码（除非新谓词）。

> 这是 Epic 2 的「正确性护栏 + 扩展性确认」故事。它消化 AQ-3——3 阵营全编完后，谓词库是否仍封闭。

## Acceptance Criteria

1. **AC1（盘点报告）**：产出 `docs/dev/predicate-audit-legionaries.md`（本地产物，不入库），枚举军团兵数据包每个 effect 用的谓词/modifier/policy，标注「复用现有」或「需新增」。
2. **AC2（优先复用）**：≥95% 的军团兵机制通过复用现有 16 个 `modifier.kind` + 6 个 `stacking.policy` + §2.5 谓词库表达；任何「需新增」必须证明无法用现有表达（不能仅为方便）。
3. **AC3（新谓词落地，如有）**：若确需新谓词——(a) 在 `src/rules/predicates.ts` 加纯函数实现 + 类型签名；(b) 在谓词库文档化（§2.5 列表）；(c) 单测覆盖；(d) 在盘点报告标注是否需引擎代码改动；(e) 重新评估封闭性（是否还需第 4 阵营时再加）。
4. **AC4（CUSTOM_HOOK 缺口判定）**：对每个无法纯数据表达的机制，评估是 (a) 落 `CUSTOM_HOOK`（人工裁定，§2.4.1）还是 (b) 必须新谓词。KT Lite 不在范围的（协助/戒备/重掷优先级）明确标「v1 休眠，不实现」而非新增谓词。
5. **AC5（封闭性结论）**：盘点报告给出明确结论——AQ-3 对军团兵的状态：仍封闭 / 已扩但封闭 / 已破（需重构）；并预判对 Epic 3 瘟疫战士的影响。

## Tasks / Subtasks

- [ ] **T1 — 扫描军团兵数据包**（AC1）
  - [ ] 遍历 `legionaries.v1.json` 全部 `effects[]`，每条记录：`effectId` / `trigger.point` / `condition.op` / `modifier.kind` / `stacking.policy`
  - [ ] 输出表格到 `docs/dev/predicate-audit-legionaries.md`（本地，`.gitignore` 含 docs）
- [ ] **T2 — 对照现有谓词库**（AC2）
  - [ ] 现有谓词清单（§2.5）：`weaponKindIs` / `rangeBucket` / `targetHasMarker` / `attackerHasKeyword` / `targetInCover` / `operativeIsInjured` / `dealtAnyDamageThisPipeline` / `operativeHasMarker` 等（核对 `src/rules/predicates.ts` 实际实现为准）
  - [ ] 现有 modifier 16 种（§2.4.1）、policy 6 种（§2.6）：逐 effect 标「复用」or「缺口」
- [ ] **T3 — 军团兵疑似缺口清单评估**（AC2/AC4）
  - [ ] 逐项评估下列疑似缺口（实际是否缺口由实现期核对）：
    - 恐虐/奸奇的「武器附加严重」= `ATTACH_WEAPON_RULE{rule:"DEVASTATING"}` + `condition:weaponKindIs(...)` → **应可复用**
    - 释放恶魔「每枚骰减伤上限 1 + 纳垢互斥」= `DAMAGE_MITIGATION` + `CAP_PER_ATTACK_DIE{amount:1}` + `MUTUALLY_EXCLUSIVE_WITH(nurgle-reduce)` → **应可复用**（FR-7 R3）
    - 灵魂盛宴「近战/反击后回复 D3+1」= 触发点 `MELEE_AFTER` + `GRANT_MARKER`/回复（若无回复 modifier，可能需新 `HEAL_OPERATIVE` kind 或落 `CUSTOM_HOOK`）→ **评估**
    - 混沌护身符「自伤 D3 换一次升级」= `UPGRADE_SUCCESS` + 自伤（若无 self-damage modifier，可能落 `CUSTOM_HOOK` 或扩展 `EXTRA_DAMAGE_ON_HIT{target:"SELF"}`）→ **评估**
    - 吸魂武器「每伤害骰回复友方」= 类灵魂盛宴，回复机制评估
    - 持徽手「控制权判定 APL+1」= 基础值非修正（FR-2/§2.2），不走 effect → **无缺口**
    - 血祭血神「非恐虐首次出击额外伤害 / 恐虐近战两伤害属性 +1（cap 7）」= `EXTRA_DAMAGE_ON_HIT{cap:7}` + `DAMAGE_PLUS{scope:BOTH}` → **应可复用**（cap 字段核对）
  - [ ] 标记每项：复用 / 需新谓词 / 需新 modifier.kind / 落 CUSTOM_HOOK / v1 休眠
- [ ] **T4 — 落地新谓词（仅 AC3 触发时）**（AC3）
  - [ ] 如 T3 有「需新谓词」项：在 `src/rules/predicates.ts` 加纯函数 + 类型 + 单测
  - [ ] 更新架构 §2.5 谓词列表（或 dev 备忘）
  - [ ] 数据包相应 effect 的 `condition.op` 改用新谓词
- [ ] **T5 — 落地新 modifier.kind（仅必要时）**（AC3）
  - [ ] 如 T3 有「需新 modifier.kind」（如 `HEAL_OPERATIVE`）：在 §2.4.1 枚举加项 + enforcer 处理 + 单测
  - [ ] 确保穷尽检查（switch）通过——架构 ADR-03 的核心价值
- [ ] **T6 — 封闭性结论**（AC5）
  - [ ] 盘点报告结尾给结论：AQ-3 状态 + Epic 3 瘟疫战士预判（毒素/恼人韧性/传染/腐烂诅咒等已知机制是否会更激进破封闭）
- [ ] **T7 — 全绿验证**（AC1-5）
  - [ ] `npm test` 全绿（含 Story 2.1 金样不回归）；盘点报告本地完成

## Dev Notes

### 架构合规（必须遵循）

- **AQ-3 是本故事的核心**（架构 §10）：声明式条件谓词能否覆盖所有阵营机制，还是会出现必须写代码的新谓词？实现 3 阵营后盘点确认是否封闭。本故事=军团兵阶段的盘点（瘟疫在 Story 3.2 复盘点）。
- **优先级硬规则**：能复用就复用，不为新机制加谓词/modifier 除非证明现有表达无法覆盖。每次新增 = 引擎代码改动 + 重测 + 重评估封闭性——成本高。
- **CUSTOM_HOOK 是最后兜底**（§2.4.1）：规则缺口绝不静默猜（NFR-5/D-17）。但 KT Lite 已排除多数歧义（D-23），本故事大概率不触发新 hook——多数「缺口」应判断为「v1 休眠」（不在 Lite 范围）。
- **谓词纯函数 + 封闭集**（§2.5）：不引入通用 JS eval（安全 + CSP + 可审计）。新谓词 = 改引擎代码，但谓词本身是有限封闭集，可控——本故事的工作就是确认这个「可控」成立。

### 关键约束

- **盘点产物本地不入库**（NFR-7）：`docs/dev/` 与 `docs/rules/` 一同 `.gitignore`。
- **不破坏 Story 2.1 金样**：任何新谓词/modifier 落地后，2.1 的 9 条金样必须全过（回归护栏）。
- **复用证据要求**：盘点报告「复用」项须给出对应的 modifier.kind + policy 组合，可被读者核验，而非空泛断言。

### 预判（基于规则源预读，实现期以实际为准）

- 多数军团兵机制应可复用（印记附加规则、计谋的 hit/damage/APL modifier 都是标准类型）。
- 最可能的真缺口：**回复耐伤**（灵魂盛宴/吸魂）——现有 16 modifier 无明确 `HEAL`。评估 3 选项：(1) 新增 `HEAL_OPERATIVE` modifier.kind（最干净）；(2) 落 `CUSTOM_HOOK`（过重，非歧义）；(3) 复用 `GRANT_MARKER`+激活期扣血反转（hack）。**预判倾向 (1)**，本故事定夺。
- 持徽手类 APL 调整走基础值（FR-2），不走谓词——无缺口。

### 不要做

- 不为方便新增（必须证明无法复用）。
- 不实现 KT Full 的协助/戒备/重掷优先级（D-23 休眠，标 v1 不做）。
- 不改 Story 2.1 数据包的 effect 语义除非确认是谓词缺口（保持金样稳定）。

### References

- 架构 §2.5 谓词 / §2.4.1 modifier 枚举 / §2.6 policy / §10 AQ-3 — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- Story 2.1 数据包（盘点对象）：`src/data/packs/legionaries.v1.json`
- 现有谓词实现：`src/rules/predicates.ts`、`src/engine/enforcer.ts`（Story 1.4 产物）
- 规则源（本地）：`docs/rules/merged_kt_legionaries_zh.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
