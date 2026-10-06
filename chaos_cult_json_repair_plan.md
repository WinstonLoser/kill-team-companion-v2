# 混沌教派 JSON 修复计划

状态：待实施  
规则基线：[`docs/rules/merged_kt_chaos_cult_zh.md`](docs/rules/merged_kt_chaos_cult_zh.md)  
目标数据包：`src/data/packs/chaos_cult.v1.json`

## 1. 目标

修复混沌教派数据包与 2025 年 7 月勘误后规则不一致的内容，并将其整理为与现有阵营包相同的结构和命名风格。完成后，数据卡、建队、规则查询和引擎所读取的内容必须来自同一份数据；引擎尚不能自动结算的规则仍须完整展示，不得用不等价的近似规则代替。

本计划不改变原 PDF/合并规则文档，也不顺带重写其他阵营数据。

## 2. 统一风格基线

以 `angels_of_death.v1.json`、`legionaries.v1.json` 和 `plague_marines.v1.json` 的共同约定为准：

- 顶层顺序统一为 `packId`、`version`、`rulesetVersion`、`faction`、`factionRules`、`abilities`、`operatives`、`weapons`、`effects`、`stratagems`、`wargear`、`buildConstraints`。
- `packId` 与 `faction.id` 保持 `chaos_cult`；修复属于兼容性数据更新，文件名保持 `.v1.json`，包版本建议升为 `1.1.0`。
- 可见名称使用 `English / 中文`；规则关键字使用项目已有英文规范写法，中文解释放在描述中。
- ID 使用稳定的 `snake_case`，在同类集合内唯一；阵营专属武器优先使用 `chaos_cult_` 或简短且无碰撞的 `cc_` 前缀。
- 特工通过 `abilityRefs`、`factionRuleRefs` 引用定义，不复制另一份容易漂移的规则正文。
- `loadouts.options` 中每个武器引用都必须存在；同名但数值不同的武器必须使用不同 ID。
- 可由当前引擎准确表达的机制写入 `effects`；不能准确表达的机制保留完整 `description`，并通过 `CUSTOM_HOOK` 或明确的“仅展示”标记进入后续实现，禁止写成效果更强或更弱的近似值。
- 结构化效果填写 `rulesRef.doc = "merged_kt_chaos_cult_zh.md"` 和精确章节名。
- 4 项阵营装备进入 `wargear`；若需要规则正文，应先给 `Wargear` 类型和 schema 增加可选 `description`，而不是依赖未声明字段。

## 3. 已确认问题与修复要求

### P0：会直接改变规则结果

1. **变异选择被错误合并**：每次触发只能选择“虔信者转变异者”“变异者转受难者”或“回复最多 D3+1”，不能自动转型并同时治疗。
2. **变异武器规则错误**：渎神附肢、骇人变异应为 `Ceaseless`，不是 `Relentless`；原有 `Rending` 按卡面保留。
3. **重复武器 ID**：三个 `autopistol` 和两个不同面板的 `brutal_melee_weapon` 会被 `.find()` 错配。所有重复项须拆成唯一 ID；徽记头领的 3 攻击与虔信者的 4 攻击不得共享同一武器记录。
4. **憎恶突变对象错误**：排除所有 `DARK COMMUNE`，并补齐每名特工每场一次、变异后永久保留。
5. **忠诚追随者流程缺失**：保护对象是任意 `DARK COMMUNE`；替代者必须是可见、3 英寸内、非 `DARK COMMUNE`；同时覆盖射击和近战，射击时继承掩护/遮挡，并排除 `Blast`、`Torrent`。
6. **燃烧香炉规则错误**：`Concentrate` 改为 `Saturate`。

### P1：条件、时点或作用域不完整

- 强肌只忽略“受创状态导致的”近战命中修正，不忽略其他来源的修正。
- 带刺只在该特工近战或反击时生效，且指该流程中的首次出击，不是通用先制。
- 变异补齐：每名特工每转折点一次、敌人须在虔信者控制范围内、模型替换、已损失耐伤继承、特工身份连续，以及每转折点转型次数上限。
- 恶心气场注明不与受创造成的同类惩罚累计。
- 噩梦生物按“至少一名争夺标识的敌人位于己方变异者/受难者 2 英寸内”触发，并令所有争夺该标识的敌方特工总 APL 减 1。
- 毁灭徽记、邪恶洪流和恶毒漩涡补齐敌方控制范围限制、持续时间、重新执行条件、既有标识移除和放置条件。
- 变异者、受难者的行动限制补齐 `Operate Hatch` 例外。
- 笨重只影响隐匿特工借轻型地形规避有效目标，不取消其依法获得的掩护保留骰。
- 英文名规范化：`Crude melee weapon`、`Diabolical stave`、`Infernal gaze`。
- 收录邪恶魔典、秘密伪装、不洁护身符、污秽祝福四项阵营装备及其完整限制。

## 4. 实施阶段

### 阶段 A：先加数据完整性护栏

涉及文件：

- `src/rules/packLoader.ts`
- `src/rules/types.ts`
- `src/rules/schema/faction-pack.schema.json`
- `tests/rules/packLoader.test.ts`

任务：

- 在 loader 二次校验中拒绝重复的 `operativeId`、`weaponId`、`abilityId`、`ruleId`、计谋 `id`、装备 `id` 和 `effectId`。
- 校验所有 `loadouts.options` 武器引用、`abilityRefs`、`factionRuleRefs` 和 selector/effect 引用均可解析。
- 将实际已使用的 `factionRules`、`abilities`、`abilityRefs`、`factionRuleRefs`、`description` 等字段补入 TypeScript 类型与 schema，减少依赖 `additionalProperties` 的隐式契约。
- 暂不把 `additionalProperties` 全局改为 `false`；先消除现有阵营的类型漂移，再单独评估严格模式。

验收：构造重复 ID 和悬空引用的坏包时 `loadPack()` 必须失败；四个现有包仍可加载。

### 阶段 B：修正数据并统一排版

涉及文件：

- `src/data/packs/chaos_cult.v1.json`

任务：

- 按第 2 节重排顶层结构、统一双语名称与 ID。
- 逐卡抄录 7 类特工的属性、底座、关键字、武器、能力和专属行动，并与规则文档逐字段复核。
- 拆分所有面板不同的同名武器；修复 `Ceaseless`、`Saturate` 和三个英文名称。
- 逐条重写 2 项阵营规则、4 项战略计谋、4 项交战计谋和 4 项阵营装备。
- 对当前引擎能够无损表达的内容建立 effect；其余内容保持完整描述，并登记清晰的 hook，不制造近似结算。

验收：JSON 格式化稳定；全包 ID 唯一；所有引用闭合；角色卡显示的数值与规则文档一致。

### 阶段 C：补足混沌教派建队约束

当前的 `min/max + leaderFrom + maxPerTypeExcept` 不能表达固定组成，也不能阻止玩家初始选择变异者和受难者。建议扩展通用 `BuildConstraints`，而不是在 UI 中写阵营特判：

- 增加按 `operativeId` 的精确/区间数量约束，例如 `operativeTypeLimits`。
- 增加初始建队可选性，例如 `initialRosterEligible: false`，用于变异者和受难者。
- 混沌教派约束为：煽动家 1、祝福战刃 2、徽记头领 1、头脑巫师 1、虔信者 9；变异者和受难者初始 0。
- 更新 `evaluateLegality()`、`computeDefaultRoster()` 和 `OperativePicker`，全部读取通用约束。

涉及文件：

- `src/rules/types.ts`
- `src/rules/schema/faction-pack.schema.json`
- `src/rules/legality.ts`
- `src/ui/roster/OperativePicker.tsx`
- `tests/rules/legality.test.ts`

验收：默认阵容自动生成正确的 14 人；增减任一固定角色或初始加入变异者/受难者都会被判违规。

### 阶段 D：引擎与对局状态接入

按准确性和复用价值分批实现：

1. 先接入简单、可验证的骰子与属性效果，如 `Ceaseless`、`Rending`、`Saturate` 和受创限定修正。
2. 再实现每特工/每转折点/每场次数记录与永久恩赐状态。
3. 最后实现变异实体替换：保留 token 身份、位置、命令、已损失耐伤、装备/恩赐和次数状态，只替换数据卡与模型类型。
4. 忠诚追随者、范围 APL 和标识物行动必须走目标选择/控制/标识物层，不应塞进攻击伤害 modifier。

若某阶段尚未实现，UI 应显示完整规则和“需手动结算”，不能静默自动结算错误结果。

### 阶段 E：回归测试与交付

新增 `tests/data/chaos-cult-golden.test.ts`，至少覆盖：

- 包版本、规则集、7 类特工、全部武器/能力/计谋/装备数量。
- 数据卡属性、底座与关键武器面板的表驱动快照。
- 重复 ID、悬空引用和每个 loadout 的引用闭合。
- 两种变异路线与治疗互斥；每名特工/每转折点限制；最多两次变异者转受难者。
- 两把 `Ceaseless` 变异武器不具有 `Relentless`。
- 忠诚追随者的合法/非法目标、Blast/Torrent 排除、射击与近战路径。
- 憎恶突变排除所有 `DARK COMMUNE`，并在变异后保留。
- 固定 14 人建队及初始禁止变异者/受难者。
- 4 项阵营装备与 `rulesRef` 指向合并规则文档。

执行：

```powershell
npm test -- tests/rules/packLoader.test.ts tests/rules/legality.test.ts tests/data/chaos-cult-golden.test.ts
npm test
npm run build
```

## 5. 完成定义

- [ ] `chaos_cult.v1.json` 通过 schema、唯一性与引用完整性校验。
- [ ] 第 3 节所有差异均有修复项和对应测试。
- [ ] 14 人固定组成可由通用建队模型表达，无 `chaos_cult` UI 硬编码。
- [ ] 数据卡、规则查询、建队和对局读取同一份修复后数据。
- [ ] 自动效果与原规则等价；未自动化规则明确标为手动结算。
- [ ] 全量测试与构建通过，或对与本改动无关的既有失败单独记录基线。

## 6. 建议提交拆分

1. `test(rules): validate pack ids and references`
2. `fix(data): align chaos cult pack with rules`
3. `feat(roster): support fixed operative composition`
4. `feat(rules): wire chaos cult stateful rules`
5. `test(data): add chaos cult golden coverage`
