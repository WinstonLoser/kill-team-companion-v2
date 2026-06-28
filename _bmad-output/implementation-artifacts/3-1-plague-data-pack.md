# Story 3.1: 瘟疫战士数据包与机制接入 (plague-data-pack)

Status: ready-for-dev

## Story

As a 玩家,
I want 用瘟疫战士建队并完整对战（含毒素指示物 + 恼人韧性 + 飞蝇云 + 阵营计谋）,
so that 三阵营全齐，且瘟疫机制经引擎正确结算（FR-6/FR-22 扩展）。

## Acceptance Criteria

1. **AC1（数据包结构）**：`src/data/packs/plague_marines.v1.json` 加载成功；含 7 类特工（勇士/掷弹兵/斗士/重炮手/持徽手/恶瘟投放者/士兵）、武器（瘟疫之剑/腐蚀连枷/瘟疫喷吐炮/衰败术/瘟疫之风/腐化法杖等含毒素/剧毒规则）、阵营规则（毒素指示物 + 恼人韧性 + 飞蝇云 + 阿斯塔特）、计谋（战略：传染/慢步死亡/飞蝇云/纳垢灵；交战：致命毒素/剧毒破灭/恶心韧性/腐烂诅咒）、阵营装备（瘟疫之钟/疫病手雷/瘟疫弹药/排毒口）；全部结构化、无 GW 原文。
2. **AC2（毒素时机正确）**：毒素指示物规则的核心时序——**`AT_PIPELINE_END`**（流程结束时获得指示物，**不是当次攻击生效**）：即同一次攻击中的「剧毒」武器规则（对已有毒素指示物的目标伤害属性 +1）**不当次生效**，因为指示物在流程结束才挂上。这是关键金样（架构 §3.4 示例 + FR-7 R11）。激活时（`ON_ACTIVATION_START`）对持有指示物特工造成 1 伤。
3. **AC3（恼人韧性 + 恶心韧性互斥）**：恼人韧性 = 每枚攻击骰造成 ≥3 伤时 D6 4+ 减 1（`DAMAGE_MITIGATION` @ `ON_DAMAGE_TOTAL`，每枚独立判定）；恶心韧性计谋 = 激活/反应期间改为固定减 1（最低降到 2，无需掷骰），与恼人韧性同 step 但更强，标注叠加关系（恶心韧性激活时覆盖恼人韧性的掷骰，而非叠加两份减伤——同源每枚上限 1 语义，FR-7 R3）。
4. **AC4（飞蝇云遮挡 + 传染）**：飞蝇云 = `OBSCURING` 地形类语义（3" 外射击特工完全位于标识 1" 内则被遮挡），用 `targetInCover`/遮挡谓词表达；传染 = 命中 -1 + 移动 -2，`MUTUALLY_EXCLUSIVE_WITH(injured)`（不与受创累计，FR-7 R12）。
5. **AC5（buildConstraints）**：1 名勇士 + 5 名从列表选；每类特工限 1；掷弹兵/恶瘟投放者等装备组合；无子阵营选择器（瘟疫战士无混沌印记，全员纳垢背景）；无点数（D-30）。
6. **AC6（golden tests，AR-3/SM-C1）**：每条瘟疫机制一条金样，全部通过。至少覆盖：毒素指示物时机（攻击不挂→流程结束挂→下次激活 1 伤）、剧毒武器对已有毒素目标伤害 +1、恼人韧性减伤（每枚独立 D6 4+）、恶心韧性计谋固定减 1（覆盖掷骰）、传染不与受创叠、飞蝇云遮挡生效、腐烂诅咒（掷出 3 即伤且不可重掷）、剧毒破灭（残废时范围挂指示物+伤）、慈父的祝福回复。

## Tasks / Subtasks

- [ ] **T1 — 数据包骨架**（AC1）
  - [ ] 复制 `legionaries.v1.json`（或 `angels_of_death`）为 `plague_marines.v1.json`，改 `packId:"plague_marines"`、`faction.id:"plague_marines"`、`keywords:["CHAOS","PLAGUE_MARINES","HERETIC_ASTARTES"]`
  - [ ] **无 subFactionSelector**（瘟疫战士无印记选择，背景全员纳垢但作为 faction keyword 而非 per-operative 选择）
  - [ ] `rulesetVersion:"kt-lite-1.0"`；packLoader schema 校验通过
- [ ] **T2 — 特工 profiles**（AC1/AC5）
  - [ ] 7 类特工 stats（move 5" 统一；APL 3；save 3+；wounds 15 勇士/14 其他）；base.diameterMm:32（D-27）
  - [ ] 勇士/掷弹兵/斗士/重炮手/持徽手/恶瘟投放者/士兵，各自 weaponRefs + abilities
  - [ ] 持徽手 APL+1（控制权）走基础值（与军团/死亡天使持徽手一致，FR-2）
- [ ] **T3 — 武器 profiles**（AC1）
  - [ ] 瘟疫之剑(严重+毒素+剧毒)、腐蚀连枷(残暴+严重+震荡+毒素)、瘟疫喷吐炮(集中+严重+洪流2+毒素)、衰败术/瘟疫之风/腐化法杖(灵能+严重+毒素)、疫病手雷(集中+严重+毒素+爆炸2)
  - [ ] **毒素 vs 剧毒区分**（规则源明确）：`TOXIN` = 流程结束挂指示物（阵营规则级）；`VIRULENT` = 对已有指示物目标伤害 +1（武器级，挂 weaponRules）
- [ ] **T4 — 毒素指示物阵营规则（核心，AC2）**
  - [ ] `poison_weapon_grant_marker` effect：`trigger.point:AT_PIPELINE_END` + `condition:dealtAnyDamageThisPipeline` + `modifier:GRANT_MARKER{marker:"POISON",target:"DEFENDER"}`（己方瘟疫特工除外，条件加 `notSameFactionPlague`）+ `pipelineStep:WOUNDS_APPLY_AND_AFTER`
  - [ ] `poison_marker_activation_damage` effect：`trigger.point:ON_ACTIVATION_START` + `condition:operativeHasMarker("POISON")` + `modifier:DAMAGE_MINUS{amount:1}` + `pipelineStep:ACTIVATION_PRE`
  - [ ] **关键金样**：同次攻击中剧毒武器（伤害 +1）不生效，因指示物流程结束才挂——验证 effect 时序对齐（架构 §3.4）
- [ ] **T5 — 恼人韧性 + 恶心韧性（AC3）**
  - [ ] 恼人韧性（阵营规则）：`DAMAGE_MITIGATION{threshold:3, roll:"4+"}` @ `ON_DAMAGE_TOTAL`，`CAP_PER_ATTACK_DIE{amount:1}`（每枚独立判定，每枚上限减 1，FR-7 R3）
  - [ ] 恶心韧性（交战计谋）：激活/反应期间覆盖恼人韧性的掷骰——固定减 1（最低 2），`UNIQUE_PER_GROUP` 与恼人韧性同组（激活期恶心韧性生效则恼人韧性掷骰不再触发，避免双叠）；或 `MUTUALLY_EXCLUSIVE_WITH` 标注
  - [ ] 金样：D6 掷骰版 vs 计谋固定版，确保不双叠
- [ ] **T6 — 飞蝇云 + 传染（AC4）**
  - [ ] 飞蝇云（战略计谋）：放置标识（`GRANT_MARKER{marker:"FLY_CLOUD"}` 板面标识）+ 射击时若目标完全位于标识 1" 内且射击方在 3" 外 → 遮挡（OBSCURING 语义，复用遮挡谓词 + `targetInCover` 类条件）；下战略就绪移除
  - [ ] 传染（战略计谋）：毒素指示物特工在己方瘟疫 3" 内可见，或持徽手 3" 内 → 命中 -1 + 移动 -2，`MUTUALLY_EXCLUSIVE_WITH(injured)`（不与受创累计）
- [ ] **T7 — 其他计谋 effect**（AC1）
  - [ ] 慢步死亡（战略）：激活移动≤3" 时射击/近战/反击附加无休（`ATTACH_WEAPON_RULE{rule:"RELENTLESS"}`）
  - [ ] 纳垢灵（战略）：毒素目标 APL -1
  - [ ] 致命毒素（交战）：激活/反应中 3" 内或 7" 可见敌方挂毒素指示物（或 2D6 7+ 版本）
  - [ ] 剧毒破灭（交战）：被残废时 `ON_INCAPACITATED` 范围 3" 可见敌方挂指示物 + 已有指示物的受 1 伤
  - [ ] 腐烂诅咒（交战）：近战/射击后对手掷骰每出 3 即伤且不可保留不可重掷（特殊 modifier，评估谓词——可能需「掷骰结果计数」类条件，移 Story 3.2 评估）
- [ ] **T8 — 阵营装备 effect**（AC1）
  - [ ] 瘟疫之钟：忽略受创属性修改（`IMMUNITY{groupKeys:[injured]}`，同军团坚不可摧纳垢段）
  - [ ] 疫病手雷：附加远程武器 profile（每场≤2 次），剧毒规则
  - [ ] 瘟瘟弹药：爆矢枪/手枪附加毒素+严重（`ATTACH_WEAPON_RULE`）
  - [ ] 排毒口：3" 内敌方激活时 D3=3 挂指示物 / 已有则受 D3 伤（激活期 effect）
- [ ] **T9 — 特殊行动 effect（斗士连枷挥打 / 恶瘟投放者灵能行动）**（AC1）
  - [ ] 连枷挥打（1AP）：2" 内可见每名特工 D3+2 伤，敌方且 D3=3 挂毒素指示物（视作近战，隐匿禁）
  - [ ] 有毒瘴气（1AP 灵能）：7" 可见敌方挂指示物，已有则 3 伤
  - [ ] 腐烂活力（1AP 灵能）：3" 内可见友方 2D6，7 则回 7，否则回最高 D6 数；每 TP 限 1；敌方控制范围禁
  - [ ] 慈父的祝福（勇士被动）：7" 内有毒素指示物的敌方失耐伤时，回复等量（每 TP 上限 3，未残废时）
- [ ] **T10 — buildConstraints**（AC5）
  - [ ] 队长=勇士；5 名从掷弹兵/斗士/重炮手/持徽手/恶瘟投放者/士兵选；每类限 1
  - [ ] 掷弹兵/斗士等 loadout option；无 subFactionSelector
- [ ] **T11 — golden tests**（AC6，AR-3/SM-C1）
  - [ ] `tests/golden/plague_marines/` 每机制一 `*.golden.test.ts`，最低 9 条（见 AC6 列表）
  - [ ] **毒素时序金样**最关键：固定 seed 跑一次攻击→验证当次伤害不含剧毒加成→流程结束指示物挂上→下次激活 1 伤
- [ ] **T12 — 验证**（AC1-6）
  - [ ] `npm test` 全绿（含 Epic 1/2 金样不回归）；`npm run build` 无 any 泄漏
  - [ ] 跑 1 局瘟疫 vs 军团/死亡天使端到端手测

## Dev Notes

### 架构合规（必须遵循）

- **数据驱动（AR-9/§3.4）**：毒素/恼人韧性等全部以 effect 存在 `effects[]`；引擎不写 `if faction==='plague_marines'`。架构 §3.4 已给毒素 effect 接入示例（直接照搬结构）。
- **effect 四问（§2.4）**：每个 effect 必含四字段（Story 1.2 schema 强制）。
- **毒素时序=触发点约束（FR-7 R11）**：`AT_PIPELINE_END` 非当次攻击——这是规则源明确的（「流程结束时获得指示物」），架构 §3.3 R11 明示。**不是 stacking 约束，是触发点约束**。
- **恼人韧性每枚独立（§3.4）**：与军团纳垢恼人生命力同 step 不同阈值（4+ vs 5+），每枚骰独立判定；同源每枚上限 1（FR-7 R3）。
- **谓词封闭性（AQ-3）**：本故事先复用现有谓词；腐烂诅咒的「掷骰结果计数」类条件、连枷挥打的范围多目标等疑似缺口标 `TODO(AQ-3)` 移 Story 3.2 评估。

### 关键约束

- **IP（NFR-7/D-29）**：`docs/rules/merged_kt_plague_marines_zh.md` 不入库；数据包仅结构化数据 + 本地名称。
- **KT Lite（D-23）**：仅 Lite；不在范围的休眠不实现。
- **毒素 vs 剧毒语义**（规则源）：`TOXIN`（阵营规则）= 流程结束挂指示物（对所有毒素武器生效，己方瘟疫除外）；`VIRULENT`（武器规则）= 对已有指示物目标该武器两伤害属性 +1。两者时序差是关键金样。**勘误注意**：规则源勘误把毒素触发改为「流程结束时」（已对齐 AC2）。
- **阿斯塔特阵营规则**（瘟疫版）：激活期可两次近战或两次射击（其中一次须爆矢/灵能远程）；每次激活不能重复同一灵能远程武器；任何命令可反应。与军团阿斯塔特类似但灵能武器条款略不同（勘误版）。
- **恶瘟投放者灵能行动**：有毒瘴气/腐烂活力都是 1AP 灵能行动，敌方控制范围禁，腐烂活力每 TP 限 1——状态机追踪。
- **纳垢的圣数 7 / 徽记 3**：多处规则用 7"（慈父祝福/致命毒素/腐烂活力范围）和 3"（传染/剧毒破灭/纳垢灵）——数据里直接写数值，无特殊逻辑。

### 不要做

- 不新增引擎谓词（移 Story 3.2）。
- 不把毒素指示物提前到当次攻击生效（违反规则源 + FR-7 R11）。
- 不让恼人韧性与恶心韧性双叠（同源每枚上限 1）。
- 不在数据包放 GW 原文。

### References

- 架构 §2 schema / §2.4 effect / §3.3 enforcer R3/R11/R12 / §3.4 毒素接入示例 / §11 — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- PRD FR-6/FR-22 / NFR-1/6/7 / D-23/D-29/D-30 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- Epic 3 Story 3.1/3.2 — `planning-artifacts/epics.md`
- 规则源（本地不入库）：`docs/rules/merged_kt_plague_marines_zh.md`
- 军团兵数据包参考（Story 2.1）：`src/data/packs/legionaries.v1.json`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
