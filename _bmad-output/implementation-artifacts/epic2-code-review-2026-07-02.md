# Epic 2 Code Review — 2.1 军团兵 + 2.2 谓词盘点（2026-07-02）

三层对抗审查：Blind Hunter（仅 diff）/ Edge Case Hunter（diff+项目）/ Acceptance Auditor（diff+2 spec）。
Diff 源 `a113103..HEAD`（3 新文件，+508 行，引擎代码零改动）。

## Decision-Needed（须定夺，先于 patch）

- **[D1][High] 6/18 effect 引擎 no-op + 2.2 封闭结论措辞**：mark_khrone(近战UPGRADE)/mark_slaanesh(移动)/mark_unaligned(重掷)/APL_PLUS×2/save 覆写/ATTACH_WEAPON_RULE 引擎流水线不消费 → 运行期无效。2.2 报告称「AQ-3 仍封闭…引擎零改动」混淆了「枚举封闭」与「执行封闭」。
  - 选项：A 现在把这些 kind 接进引擎流水线（大，跨 5+ kind）；B 诚实改写 2.2 报告/故事——区分「枚举封闭（kind/policy 不增）」vs「执行层 6 effect 为描述符，引擎消费留 Epic 3」，并把这些 golden 诚实归类（推荐，符合 v1 休眠约束）。
- **[D2][Med] AC3 队长/每类限制仅 prose notes**：buildConstraints 无结构化 leader/per-type 字段（schema 不支持），legality.ts 不校验。2-1 AC3 要「1 名野心勇士或神选者 + 5 名其他；除战士外每类限 1」。
  - 选项：A 扩 buildConstraints schema（leaderFrom/maxPerType）+ legality 校验 + 测试（中）；B 接受 prose-notes（与死亡天使包一致，D-30 极简）。

## Patch（明确修复）

- **[P1] `mark_khrone` 拼写**：effectId + subFactionSelector.option + golden 全写成 `khrone`（r/o 换位），应为 `khorne`。三处一致但持久化错值。[legionaries.v1.json + test]
- **[P2][AC1] 缺 `stratagems[]` + `wargear[]` 结构化数组**：死亡天使包有顶层 `stratagems[]`（id/name/cp/useLimit/phase），军团兵仅 effects。8 计谋无 cp/useLimit/phase 元数据；4 装备缺数组且**凶恶利刃完全缺失**。补两数组 + malefic_blade 武器。
- **[P3][T3] 等离子双模缺失**：T3 列「等离子双模（标准/过载）」，包内仅单 profile。补 `leg_plasma_pistol_overload`（过热+致命5+穿刺1）。
- **[P4] 封闭护栏只查 kind/policy，漏 trigger.point + pipelineStep 枚举**：typos 静默 dead-effect。扩 closure test 断言 trigger.point ∈ TRIGGER_POINTS + pipelineStep ∈ PIPELINE_STEPS。
- **[P5] golden #7 灵魂盛宴只断言 trace 含 effectId，未验回复数值**：MELEE_AFTER 记 applied 但不扣血/回复（ MeleeResult 无 heal 输出 + 前置条件需谓词）。诚实归类为「路由 golden」（effect 路由到 MELEE_AFTER，引擎消费 HEAL_OPERATIVE kind），非回复数值。
- **[P6] strat_endless_slaughter 标签 vs 触发不符**：label「被残废时出击」但 AT_PIPELINE_END 每次结算都打 marker（无条件）。加注释明「残废条件需谓词，v1 描述符」。

## Defer（引擎扩展项，非数据/枚举缺口）
- **[W1] EXTRA_DAMAGE_ON_HIT cap 不强制**：pipeline 按 amount 求和，cap:7 仅描述（多 effect 叠加时超 cap）。引擎流水线增强，留后续。
- **[W2] DAMAGE_MITIGATION payload 多态**（`"5+"` vs `"ignore-once"`）无 schema 校验；引擎按 count 减伤不消费 roll 值。payload-shape 校验留后续。
- **[W3] 6 no-op kind 引擎消费**（D1-A 路径）：近战 UPGRADE / ATTACH_WEAPON_RULE / APL_PLUS / save 覆写 / 重掷——引擎流水线扩展，留 Epic 3 / 引擎强化故事。

## Dismiss
- **IP**（rulesRef → 本地 merged_kt_legionaries_zh.md，docs/ 已 .gitignore；名称本地标识 NFR-7/D-29 by-design）。
- **持徽手 apl:4**（spec T2 明确「APL+1 走基础值」，3+1=4，intended）。
- **gunner/heavy_gunner 同武器**（可选 loadout，equipmentLimits 已限 1）。
- **纳垢 golden「vacuous」**（#2 delta + #6 trace 双重验证 UNIQUE_PER_GROUP，覆盖诚实）。

## 完成度真实性
2-1 多个 [x] 与实际有出入：AC1（缺 stratagems/wargear 数组 + 凶恶利刃 + 等离子双模）、AC2（Khorne/Slaanesh no-op）、AC4（#7 灵魂盛宴未验回复、#1/3/5/9 数据层非 input→output）。2-2「仍封闭」措辞过强。D1/D2 + P1-P6 决策/修复后按实调整。

## Resolution（2026-07-02，全部修复）

2 决策全选最完整方案 + 6 patch 全修，2 commit：
- `3b82c9c` D1 引擎接线 + D2 schema + P1-P6
  - **D1**：近战 UPGRADE_SUCCESS（MELEE_SIMULTANEOUS_ROLL 消费）+ REROLL（HIT_ROLL mode ALL/CHOOSE）接流水线；mark_khorne/mark_unaligned golden 转 real（no-op 6→4）。剩余 4（APL_PLUS/移动/save 覆写/ATTACH_WEAPON_RULE）诚实标架构层（需 activation/movement/weaponRule 语义层，非 pipeline 可解）。
  - **D2**：BuildConstraints += leaderFrom/maxPerTypeExcept（types+schema）+ evaluateLegality 校验 + 3 单测。
  - P1 mark_khorne 拼写、P2 stratagems[]+wargear[]+malefic_blade、P3 等离子过载、P4 护栏 += trigger.point+pipelineStep 枚举、P5 灵魂盛宴诚实归类、P6 endless_slaughter 注释。

**Defer（3，引擎扩展项）**：W1 EXTRA_DAMAGE cap 强制 / W2 DAMAGE_MITIGATION payload schema / W3 APL/移动/save/ATTACH 架构层。
**Dismiss（4）**：IP（docs/ gitignored）/ 持徽手 apl:4（spec intended）/ gunner 重叠武器（loadout）/ 纳垢 golden（#2+#6 双重验证）。

最终：**184/184 测试绿**（+6：2 real golden 转换 + 4 trigger/step 护栏），build 绿（389.05 kB）。Story 2-1 + 2-2 → done。
