# Story 2.1: 军团兵数据包与机制接入 (legionaries-data-pack)

Status: ready-for-dev

## Story

As a 玩家,
I want 用军团兵建队并完整对战（含 5 混沌印记 + 阵营计谋 + 阵营装备）,
so that 阵营池从 1 个扩到 2 个，且军团兵机制经引擎正确结算（FR-6/FR-22 扩展）。

## Acceptance Criteria

1. **AC1（数据包结构）**：`src/data/packs/legionaries.v1.json` 加载成功；含 9 类特工（野心勇士/神选者/受选者/邪火使徒/屠夫/炮手/重炮手/持徽手/赦罪之爪/战士）、武器（等离子手枪双模/腐化爆矢/动力拳套/恶魔之刃/吸魂武器等）、混沌印记 5 选 1（恐虐/纳垢/色孽/奸奇/无分）、计谋（战略：血祭血神/坚不可摧/迅捷速度/无常命运；交战：无尽杀戮/变异与扭转/邪恶光环/不祥迷惑）、阵营装备（守护护甲/腐化弹药/混沌护身符/凶恶利刃）；全部结构化、无 GW 原文，仅本地名称标识。
2. **AC2（机制接入正确 step）**：混沌印记与计谋的每个 effect 都挂正确 `trigger.point` + `pipelineStep` 并经 enforcer 过滤——恐虐严重(近战武器附加)/纳垢恼人生命力(每受≥3 伤 D6 5+ 减 1，同源减伤每枚上限 1)/色孽移动+1(属性 modifier)/奸奇远程严重(远程武器附加)/无分无休(条件附加)；释放恶魔/灵魂盛宴/血祭血神等各机制接入正确 step。
3. **AC3（buildConstraints）**：结构性建队约束——1 名野心勇士或神选者 + 5 名其他；除战士外每类特工限 1 次；装备组合选项（野心勇士的枪/近战各选一）；印记 5 选 1（`subFactionSelector`）；无点数（D-30）。
4. **AC4（golden tests，AR-3/SM-C1）**：每条军团兵机制一条金样（输入快照→期望输出），全部通过。至少覆盖：恐虐近战严重升级、纳垢恼人生命力减伤（同源每枚上限 1）、色孽移动属性、奸奇远程严重、无分条件无休、释放恶魔减伤（每骰上限 1 + 纳垢互斥）、灵魂盛宴近战后回复、血祭血神出击额外伤害（恐虐 vs 非恐虐）、混沌护身符吸魂代伤。
5. **AC5（阵营接入示例 + 版本）**：数据包 `rulesetVersion: "kt-lite-1.0"` 与核心包匹配；阵营接入示例（架构 §3.4 形式）在 effect 层面无 `if faction==='legionaries'` 代码（纯数据驱动）。

## Tasks / Subtasks

- [ ] **T1 — 数据包骨架**（AC1/AC5）
  - [ ] 复制 `packs/angels_of_death.v1.json` 为 `legionaries.v1.json`，改 `packId/faction`（`id:"legionaries"`、`keywords:["CHAOS","LEGION","HERETIC_ASTARTES"]`）
  - [ ] `subFactionSelector.id:"markOfChaos"`、`options:["KHORNE","NURGLE","SLAANESH","TZEENTCH","UNALIGNED"]`、`default:"UNALIGNED"`（建队时每特工各选，允许不同；邪火使徒禁恐虐见 AC3）
  - [ ] `rulesetVersion:"kt-lite-1.0"`；packLoader 校验通过（Story 1.2 schema）
- [ ] **T2 — 特工 profiles**（AC1）
  - [ ] 9 类特工按 `operative.stats{apl,move,save,wounds}` + `base.diameterMm:32`（野心/神选）/其他 28.5（D-27 约定）
  - [ ] 武器 `weaponRefs` 指向 weapons[]；阵营规则/计谋挂 `abilities`/`stratagems`；持徽手 APL+1（控制权判定）走基础值非修正（FR-2/§2.2，与瘟疫/死亡天使持徽手一致）
- [ ] **T3 — 武器 profiles**（AC1）
  - [ ] 等离子双模（标准/过载，过载=过热+致命5++穿刺1）、腐化爆矢手枪(撕裂)、动力拳套(残暴)、动力槌(震荡)、恶魔之刃(致命5+)、链锯斧(残暴)、收割者机炮(无休+重击)、重型爆矢枪(关键穿刺1)、吸魂武器（邪火使徒，吸魂规则）
  - [ ] `weaponRules` 标签按架构 §2.3 映射 effect（严重/平衡/残暴/无休/毁灭/重型/过热/致命/有限/穿刺/重击/范围/毫不留情/撕裂/集中/追踪/震荡/晕眩/洪流）
- [ ] **T4 — 混沌印记 5 effect**（AC2，复用 §2.4.1 modifier.kind + §2.6 policy）
  - [ ] 恐虐：`ATTACH_WEAPON_RULE{rule:"DEVASTATING"}` @ 近战 step（`MELEE_*`），`UNIQUE_PER_GROUP`
  - [ ] 纳垢：`DAMAGE_MITIGATION{threshold:3, roll:"5+"}` @ `ON_DAMAGE_TOTAL`，`CAP_PER_ATTACK_DIE{amount:1}`（同源减伤每枚上限 1，FR-7 R3）
  - [ ] 色孽：移动属性 modifier（move +1），非结算 step（建队/激活期应用）
  - [ ] 奸奇：`ATTACH_WEAPON_RULE{rule:"DEVASTATING"}` @ 远程 step，`condition:weaponKindIs(["RANGED"])`
  - [ ] 无分：`ATTACH_WEAPON_RULE{rule:"RELENTLESS"}` @ hit step，`condition:rangeBucket(["WITHIN_6IN"])` + 目标为敌方
- [ ] **T5 — 阵营计谋 effect**（AC2）
  - [ ] 血祭血神（战略）：非恐虐首次出击 `EXTRA_DAMAGE_ON_HIT{amount:1,cap:7}`；恐虐近战武器两伤害属性 +1（`DAMAGE_PLUS{scope:BOTH}`，cap 7）
  - [ ] 坚不可摧（战略）：敌方武器 穿刺1→关键穿刺1（`ATTACH_WEAPON_RULE` 替换 + `CONDITIONAL`）；纳垢忽略受创属性修改（`IMMUNITY{groupKeys:[injured]}`）
  - [ ] 迅捷速度（战略）：色孽/移动过特工的近战，敌方命中 -1，`MUTUALLY_EXCLUSIVE_WITH(injured)`（不与受创叠，FR-7 R12 类比）
  - [ ] 无常命运（战略）：奸奇射击就绪目标时保留失败升级（`UPGRADE_SUCCESS`）
  - [ ] 无尽杀戮（交战，恐虐）：被残废时 ON_INCAPACITATED 出击
  - [ ] 变异与扭转（交战，奸奇）：激活期 `APL_PLUS{amount:1}` + 行动唯一性约束（`UNIQUE_PER_ACTION` 同行动不重复）
  - [ ] 邪恶光环（交战，纳垢）：射击 `ATTACH_WEAPON_RULE{rule:"PIERCING1"}` 3" 内敌方
  - [ ] 不祥迷惑（交战，色孽）：激活中 `APL_PLUS{amount:-1}` 施加敌方
- [ ] **T6 — 阵营装备 effect**（AC1）
  - [ ] 守护护甲：豁免 2+（属性 modifier，持续到下战略就绪）
  - [ ] 腐化弹药：每 TP 1 次，爆矢武器附加撕裂（`ATTACH_WEAPON_RULE`）
  - [ ] 混沌护身符：关键词 + 2+ 失败时自伤 D3 换一次升级（`CUSTOM_HOOK` 或 `UPGRADE_SUCCESS` 组合）
  - [ ] 凶恶利刃：`weaponRefs` 附加新武器 profile
- [ ] **T7 — buildConstraints**（AC3）
  - [ ] 队长=野心勇士或神选者（1 选 1）；5 名从列表选；除战士外每类限 1
  - [ ] 野心勇士装备组合（手枪选一/近战选一）；炮手/重炮手/持徽手/战士各自的 loadout option
  - [ ] 印记 5 选 1（per-operative）；邪火使徒禁 KHORNE（建队校验）
- [ ] **T8 — golden tests**（AC4，AR-3/SM-C1）
  - [ ] `tests/golden/legionaries/` 下每机制一个 `*.golden.test.ts`：固定 seed PRNG + 输入快照 + 期望 output（伤害/指示物/属性）
  - [ ] 最低 9 条（见 AC4 列表）；金样改动触发全跑
- [ ] **T9 — 验证**（AC1-5）
  - [ ] `npm test` 全绿；packLoader schema 校验通过；`npm run build` 无 any 泄漏
  - [ ] 跑 1 局军团兵 vs 死亡天使端到端（建队→部署→一击结算）手测

## Dev Notes

### 架构合规（必须遵循）

- **数据驱动（AR-9/§3.4）**：阵营机制 100% 以 effect 描述符存在于 `effects[]`；引擎**不写** `if faction==='legionaries'`。所有挂载靠 `trigger.point` + `pipelineStep` + `modifier.kind` + `stacking.policy`。
- **effect 描述符四问（§2.4）**：每个 effect 必含 `trigger.point` / `pipelineStep` / `modifier.kind` / `stacking.policy` 四字段（Story 1.2 schema 强制）；缺一拒载。
- **谓词封闭性（AQ-3）**：本故事先尽量复用现有谓词（`weaponKindIs`/`rangeBucket`/`attackerHasKeyword`/`targetHasMarker`/`operativeIsInjured`/`dealtAnyDamageThisPipeline` 等）。需新谓词一律移到 Story 2.2 盘点——本故事**不新增引擎谓词**，若发现硬缺口标 `TODO(AQ-3)` 暂记数据注释，留给 2.2 评估（可能落 `CUSTOM_HOOK`）。
- **叠加规则集中（§3.3 enforcer）**：复用 6 policy，标对即可；如同源减伤每枚上限（FR-7 R3）、不与受创叠（R4/R12）、关键穿刺条件（R7）、过热每行动一次（R9）。

### 关键约束

- **IP（NFR-7/D-29）**：`docs/rules/merged_kt_legionaries_zh.md` **不入公开仓库**（`.gitignore` 已含）。数据包仅结构化数据 + 本地名称；名称仍属 GW IP（hobby 常态，构建者自定通用化）。
- **KT Lite（D-23）**：仅 KT Lite 规则集；协助/戒备/重掷优先级不在 Lite → 不建模、不触发 hook（架构 §2.4.1 v1 说明）。阵营卡的「不能协助」类条款 v1 休眠。
- **混沌印记是 per-operative 选择**（非整阵营）：建队时每特工各选一关键词，允许不同（炼狱契约可换）。`subFactionSelector` 在 operative 层级，不是 faction 层级单一选择——核对与死亡天使「战团战术 8 选 2」语义不同。
- **释放恶魔约束**（受选者）：每场 1 次；减伤每骰上限 1（与纳垢恼人生命力同枚骰互斥——FR-7 R3 语义）；恶魔之爪获无休+致命5+；纳垢关键词下减伤数量上限 1（不能两规则把 4 普通伤害降到 2）——这是关键金样。
- **灵魂盛宴**（神选者）：近战/反击后若未残废但造成暴击或残废敌方，回复 D3+1 耐伤（勘误版，原文是「残废敌方」，勘误扩到「或造成暴击伤害」）。
- **吸魂武器**（邪火使徒）：选该武器时可选；攻击骰步骤开始时选 6" 内可见己方军团特工；该阶段每枚伤害攻击骰回复 1（关键成功 D3）；每 TP 限 1 次。

### 不要做

- 不新增引擎谓词（移到 Story 2.2）。
- 不实现 KT Full 规则（仅 Lite）。
- 不引入新依赖。
- 不在数据包里放 GW 原文段落。

### References

- 架构 §2 schema / §2.4 effect / §2.4.1 modifier / §2.4.2 触发点 / §2.5 谓词 / §2.6 policy / §3.1 流水线 step / §3.3 enforcer / §3.4 阵营接入示例 / §11 实现顺序 — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- PRD FR-6/FR-22 / NFR-1/6/7 / D-23/D-29/D-30 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- Epic 2 Story 2.1/2.2 — `planning-artifacts/epics.md`
- 规则源（本地不入库）：`docs/rules/merged_kt_legionaries_zh.md`
- 死亡天使数据包参考：`src/data/packs/angels_of_death.v1.json`（Story 1.3 产物）

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
