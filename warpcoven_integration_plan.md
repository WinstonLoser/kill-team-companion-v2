# 次元密会集成计划

状态：待实施  
规则基线：[`docs/rules/merged_kt_warpcoven_zh.md`](docs/rules/merged_kt_warpcoven_zh.md)  
目标数据包：`src/data/packs/warpcoven.v1.json`

## 1. 目标

新增次元密会阵营包，并接入建队、数据卡、规则查询、测试实验室和对局状态。规则以已核对中英文并合入 2026 年 4 月勘误的中文文档为唯一录入基线；中文版遗漏或未合入勘误之处采用文档中已合并的英文规则结论。

首版必须做到“数据完整、建队准确、显示准确”。自动结算按引擎能力分层接入，不能自动处理的灵能行动、标识物或位移效果明确保留为手动结算。

## 2. 目标数据包风格

沿用其他阵营的统一约定：

- `packId` 与 `faction.id` 均为 `warpcoven`，初始版本 `1.0.0`，`rulesetVersion` 与现有包一致。
- 顶层顺序为 `packId`、`version`、`rulesetVersion`、`faction`、`factionRules`、`abilities`、`operatives`、`weapons`、`effects`、`stratagems`、`wargear`、`buildConstraints`。
- 显示名统一为 `English / 中文`；ID 使用有阵营前缀的 `snake_case`，例如 `wc_sorcerer_destiny`、`wc_doombolt`。
- 10 类特工分别建卡；三类巫师可以引用共同武器，但专属灵能武器和行动单独定义。
- 武器面板完全相同才共享 `weaponId`；所有 loadout 引用必须闭合。
- 阵营规则、能力、计谋和装备保留完整描述；可自动结算的部分另建 effect，effect 均带 `rulesRef`。

## 3. 规则范围清单

### 特工与武器

录入以下 10 类特工：

1. 命运巫师
2. 时间巫师
3. 亚空间炽焰巫师
4. 红字战士炮手
5. 红字战士徽记持有者
6. 红字战士战士
7. 奸角兽勇士
8. 奸角兽号手
9. 奸角兽徽记持有者
10. 奸角兽战士

逐卡覆盖 APL、移动、豁免、耐伤、底座、关键字、全部武器面板、能力和独特行动。必须采用 2026 年 4 月勘误值，包括但不限于：巫师 15 耐伤、红字战士 2+ 豁免、普罗斯佩罗弯刀 5 攻击且无 `Balanced`、裁决闪电 4/2 伤害。

### 阵营机制

- 9 项奸奇恩惠：每名入队巫师必须选择 1 项，整队不可重复。
- 阿斯塔特：双射/双战、特定武器第二次射击额外 1AP、灵能远程武器每次激活不得重复、无视命令进行反应。
- 4 项战略计谋、4 项交战计谋。
- 4 项阵营装备：附魔弹药、魔啮武器、奥术长袍、巫术卷轴。
- 合并文档中的语义修正必须进入数据和测试：变种肢体包含放置标识；巫术卷轴即时处理命运回响；无常计划允许冲刺和/或改变命令；蹂躏命运与其他 APL 变化累计；附魔弹药仅适用于次元密会；星界轰击目标命名统一。

## 4. 建队模型扩展

次元密会不是固定人数，而是恰好 5 个选择点；普通特工计 1 点，奸角兽计 0.5 点。现有 `operatives.min/max` 不能准确表达，禁止用“人数 5”近似。

建议为通用 `BuildConstraints` 增加：

- `selectionPoints: { exact: 5 }`
- `operativeCosts: Record<operativeId, number>`，奸角兽为 `0.5`，其余为 `1`
- `minimumByKeyword` 或等价通用约束：至少 1 名 `SORCERER`
- `operativeTypeLimits`：非 `WARRIOR` 类型最多 1 名
- 继续使用 `equipmentLimits` 表达整队至多一把亚空间炽焰手枪和一门灵魂收割者炮

需要同步更新：

- `src/rules/types.ts`
- `src/rules/schema/faction-pack.schema.json`
- `src/rules/legality.ts`
- `src/ui/roster/OperativePicker.tsx`
- `src/ui/roster/LegalityPanel.tsx`（如需显示点数明细）
- `tests/rules/legality.test.ts`

UI 显示“已用点数 / 5”，允许 0.5 步进；默认阵容必须合法且至少包含一名巫师。

## 5. 奸奇恩惠选择器

现有 per-operative selector 只针对 `markOfChaos` 硬编码，且不支持“仅部分特工必选、整队不可重复”。应先通用化选择器，而不是新增第二个阵营特判。

建议扩展 selector 元数据：

- `scope: "perOperative"`
- `eligibleKeywords: ["SORCERER"]`
- `requiredPerEligible: 1`
- `uniqueAcrossTeam: true`
- `options` 指向 9 个恩惠 effect/规则 ID

实现要求：

- `OperativePicker` 根据 `scope` 与资格元数据渲染，不再判断 selector ID 是否等于 `markOfChaos`。
- `evaluateLegality()` 校验每名巫师恰好一个、非巫师不能选择、全队不得重复。
- `rosterStore.perOperativeMarks` 可保留现有存储形态，但建议后续重命名为中性的 `perOperativeSelections`；若本次迁移字段，必须为已有本地存档提供兼容读取。
- 巫术卷轴带来的临时换恩惠属于对局状态，不改写原始建队选择。

## 6. 数据与功能实施阶段

### 阶段 A：补齐通用数据契约

先完成混沌教派修复计划中的 ID/引用完整性校验以及类型/schema 补齐，再增加点数建队与通用 per-operative selector 字段。这样 Warpcoven 首次入库即可受完整校验保护。

验收：所有旧包仍可加载、旧建队行为不变；新增字段有 schema parity 和 legality 单测。

### 阶段 B：建立 Warpcoven 数据包

新增：

- `src/data/packs/warpcoven.v1.json`
- `tests/data/warpcoven-golden.test.ts`

录入顺序：阵营与主题 → 阵营规则 → 9 恩惠 → 10 特工 → 武器 → 能力/灵能行动 → 8 计谋 → 4 装备 → effects → 建队限制。

验收：包可由 `loadPack()` 加载；数量、ID、引用、数值和勘误项全部由表驱动测试锁定；`rulesRef.doc` 指向 `merged_kt_warpcoven_zh.md`。

### 阶段 C：统一注册并接入 UI

当前阵营列表分散在多个文件，容易只接入部分页面。建议新增单一注册模块，例如 `src/data/packs/index.ts`，由它加载并导出所有阵营，随后以下消费者统一读取注册表：

- `src/App.tsx`
- `src/ui/RosterView.tsx`
- `src/state/matchStore.ts`
- `src/ui/test-lab/AbilityLab.tsx`
- `src/ui/match/RulesQuery.tsx`

同时检查主题色、阵营名称、特工图片映射与数据卡显示；角色图复用 `docs/rules/images/warpcoven_*.png` 作为规则资料，若产品 UI 需要公共静态资源，则复制到明确的 `public` 资产目录，不从 `docs` 运行时引用。

验收：次元密会能在双方建队、测试实验室、规则查询与对局中选择；所有页面使用同一注册表，不存在漏注册。

### 阶段 D：效果自动化分层

按以下顺序实施：

1. **纯数据/骰池层**：`Saturate`、`Piercing`、`Devastating`、`Lethal`、`Rending`、重掷、普通伤害 +1、移动属性变化。
2. **激活与次数层**：阿斯塔特双射/双战限制、第二次射击 AP 变化、每次激活灵能武器不可重复、每场/每转折点次数。
3. **标识物与持续状态层**：天命庇护、蹂躏命运、时空波动、命运回响、巫术卷轴临时恩惠。
4. **空间与位移层**：亚空间飞行、星界轰击、治疗范围、控制范围限制和重新放置。

每个 effect 必须能回答触发点、流水线步骤、modifier 和叠加策略四项。不能由现有 modifier 等价表达时使用命名明确的 `CUSTOM_HOOK`，并在 UI 标记手动结算；不得把复杂空间规则压缩成无条件数值加成。

### 阶段 E：端到端验证

`tests/data/warpcoven-golden.test.ts` 至少覆盖：

- 10 类特工、9 项恩惠、8 项计谋和 4 项装备齐全。
- 三类巫师共享属性与通用装备，但专属武器/行动正确。
- 2026 年 4 月勘误数值和 6 项中英差异修正。
- 恰好 5 点、0.5 点奸角兽、至少一名巫师、非战士唯一。
- 亚空间炽焰手枪和灵魂收割者炮各至多一件。
- 每名巫师必选一项恩惠，整队恩惠不重复，非巫师不可选择。
- 所有 loadout、ability、faction rule、selector、effect 引用闭合。
- 阵营在统一注册表中出现，建队默认值合法，规则查询可找到其内容。

建议增加一个 Playwright 冒烟用例：选择次元密会 → 调整至合法 5 点 → 为所有巫师选择不同恩惠 → 进入对局 → 打开一张巫师数据卡。

执行：

```powershell
npm test -- tests/rules/packLoader.test.ts tests/rules/legality.test.ts tests/data/warpcoven-golden.test.ts
npm test
npm run build
npm run e2e
```

## 7. 完成定义

- [ ] Warpcoven 数据包通过 schema、唯一性和引用完整性校验。
- [ ] 10 类特工、全部规则、计谋、装备和恩惠均可查询并正确显示。
- [ ] 5 点制、半点奸角兽、至少一名巫师和武器上限由通用合法性引擎执行。
- [ ] 恩惠选择没有 Warpcoven 专属 UI 硬编码，且全队唯一性可验证。
- [ ] 所有阵营入口通过单一注册表接入 Warpcoven。
- [ ] 已自动化机制有结果级测试；未自动化机制明确提示手动结算。
- [ ] 全量测试、构建和核心建队 E2E 通过，或记录与本改动无关的既有失败基线。

## 8. 依赖与建议顺序

依赖关系：

1. 先实施混沌教派计划的“阶段 A：数据完整性护栏”。
2. 合并实现两份计划都需要的 `BuildConstraints`、schema 和 legality 通用扩展。
3. 修复混沌教派数据，验证新护栏不会破坏现有阵营。
4. 新增 Warpcoven 数据包和 golden tests。
5. 统一阵营注册并接入 UI。
6. 分批接入 Warpcoven 状态型与空间型规则。

建议提交拆分：

1. `feat(rules): support point-based roster constraints`
2. `feat(roster): generalize operative selectors`
3. `feat(data): add warpcoven faction pack`
4. `refactor(data): centralize faction registry`
5. `feat(rules): wire warpcoven effects`
6. `test(data): add warpcoven golden coverage`
