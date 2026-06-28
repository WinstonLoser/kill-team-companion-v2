# Story 1.2: 规则数据 schema 与 packLoader (rules-schema-packloader)

Status: ready-for-dev

## Story

As a 引擎,
I want 一套声明式规则数据 schema（effect 描述符四问 / modifier.kind 判别联合 **21 种含 HEAL_OPERATIVE** / 6 stacking.policy / 触发点枚举）+ 与之同源的 JSON Schema 校验器 + 一个 packLoader,
so that 规则以 JSON 数据包存在、引擎逻辑与数据物理分离、非法数据包被拒绝而非静默降级、版本不兼容被提示。

## Acceptance Criteria

1. **AC1（schema 同源）**：`src/rules/` 下用 TS strict 类型完整建模 Faction Pack 顶层结构（§2.1）+ Operative/Weapon（§2.2/2.3）+ Effect 描述符（§2.4）；并有一份与之**同源**的 JSON Schema（手写或类型生成），二者结构一一对应、不漂移。
2. **AC2（effect 四问强制）**：解析任一 effect 时，`trigger.point` / `pipelineStep` / `modifier.kind` / `stacking.policy` 四字段缺一即**拒绝并报错**，绝不静默补默认值。四字段取值必须落在枚举内（§2.4.1 modifier.kind **全集 21 种含 HEAL_OPERATIVE**、§2.4.2 触发点、§2.6 6 policy、§3.1 step id）。
3. **AC3（packLoader 拒绝非静默）**：`packLoader(json)` 加载 faction pack，结构非法 → 抛结构化错误（含路径+原因），不返回部分结果、不静默降级（NFR-5）。
4. **AC4（版本兼容）**：`rulesetVersion` 与引擎支持版本不匹配 → 提示「数据包 vX，引擎支持 vY」并拒绝加载（D-23 单一 Lite 规则集）。
5. **AC5（core.kt-lite 骨架）**：`src/data/packs/core.kt-lite.v1.json` 提供最小可加载骨架（packId / version / rulesetVersion + 空数组占位 operatives/weapons/effects），能通过自身 schema 校验；packLoader 能加载它。
6. **AC6（模块边界 + 可单测）**：`src/rules/` 零 UI/React 依赖；schema、校验器、packLoader 全部可独立单测，覆盖合法/非法/缺字段/枚举越界/版本不符各一例。

## Tasks / Subtasks

- [ ] **T1 — Effect 描述符 TS 类型**（AC1/AC2）
  - [ ] `src/rules/types/effect.ts`：`Effect` 接口（effectId/label/source/trigger/pipelineStep/priority?/modifier/stacking/rulesRef?）
  - [ ] `modifier.kind` 判别联合（**21 种**，每种 payload 类型严格）：HIT_PLUS/HIT_MINUS/DAMAGE_PLUS/DAMAGE_MINUS/UPGRADE_SUCCESS/DOWNGRADE_SUCCESS/COUNT_PLUS/COUNT_MINUS/REROLL/AUTO_SUCCESS/ATTACH_WEAPON_RULE/PIERCE/COVER_SAVE/DAMAGE_MITIGATION/IGNORE_DAMAGE/IMMUNITY/EXTRA_DAMAGE_ON_HIT/GRANT_MARKER/**HEAL_OPERATIVE**（回复耐伤，payload `{amount, target:"SELF"|"target", condition?}`，触发点视机制 ON_INCAPACITATED/AT_PIPELINE_END 等，供灵魂盛宴/吸魂/慈父祝福/腐烂活力）/APL_PLUS/CUSTOM_HOOK（以架构 §2.4.1 表 + 本 HEAL 补丁为准）
  - [ ] `trigger.point` 字符串字面量联合（§2.4.2 全部 18 个）
  - [ ] `stacking.policy` 联合（6：STACKABLE/UNIQUE_PER_SOURCE/UNIQUE_PER_GROUP/MUTUALLY_EXCLUSIVE_WITH/CONDITIONAL/CAP_PER_ATTACK_DIE）
  - [ ] `pipelineStep` 联合（§3.1 射击 10 + 近战 7 step id + 激活类 ACTIVATION_PRE 等）
- [ ] **T2 — Faction Pack / Operative / Weapon 类型**（AC1）
  - [ ] `src/rules/types/pack.ts`：`FactionPack`（packId/version/rulesetVersion/faction/operatives/weapons/effects/abilities/stratagems/wargear/buildConstraints）
  - [ ] `Operative`（§2.2：stats{apl,move,save,wounds}/base.diameterMm/weaponRefs/abilities/uniqueLoadoutOptions）
  - [ ] `Weapon`（§2.3：kind RANGED|MELEE/profile{attacks,hit,normalDamage,criticalDamage,range?,weaponRules[]}/keywords）
  - [ ] `subFactionSelector`（§2.1：id/label/options/default）
- [ ] **T3 — JSON Schema 同源**（AC1/AC3）
  - [ ] `src/rules/schema/faction-pack.schema.json`：手写 JSON Schema，与 T1/T2 类型一一对应；用 `additionalProperties:false` 收口；枚举用 `enum` 穷举；必填字段进 `required`（含 effect 四问）
  - [ ] **同源校验**：写一个 `tests/schema-parity.test.ts`，断言 TS 类型的字段集 = JSON Schema 的 properties 集（防漂移）；或用 `ts-json-schema-generator`/`zod-to-json-schema` 从类型生成并比对（选其一，记录于 Dev Notes）
- [ ] **T4 — packLoader**（AC3/AC4/AC5）
  - [ ] `src/rules/packLoader.ts`：`loadPack(raw: unknown): FactionPack`
    - JSON.parse → JSON Schema 校验（用 Ajv 或等价，GH Pages CSP 友好）→ 结构化错误（path + message + 期望枚举值）
    - effect 四问二次断言（即便 schema 漏标也兜底拒绝）
    - `rulesetVersion` 比对引擎常量 `SUPPORTED_RULESET_VERSIONS`，不匹配抛 `RulesetVersionMismatchError`
  - [ ] 错误类型：`PackValidationError`（结构）/ `RulesetVersionMismatchError`（版本），均含可序列化字段供 UI 报错
- [ ] **T5 — core.kt-lite 骨架**（AC5）
  - [ ] `src/data/packs/core.kt-lite.v1.json`：`packId:"core.kt-lite"`、`rulesetVersion:"kt-lite-1.0"`、各数组空占位
  - [ ] 导出 `SUPPORTED_RULESET_VERSIONS = ["kt-lite-1.0"]` 常量于 `src/rules/version.ts`
- [ ] **T6 — 单测**（AC6）
  - [ ] `tests/rules/packLoader.test.ts`：合法包加载通过、缺 trigger.point 拒绝、modifier.kind 越界拒绝、policy 非 6 之一拒绝、rulesetVersion 不符拒绝、core.kt-lite 骨架自校验通过
  - [ ] `tests/rules/schema-parity.test.ts`：TS/JSON Schema 同源断言
- [ ] **T7 — 导出与目录落位**（AC6）
  - [ ] `src/rules/index.ts` 导出类型 + loadPack + 常量；确认 `src/rules/` 无 `import ... from 'react'` 或 zustand

## Dev Notes

### 架构合规

- **架构 §2.1-2.8**：数据包顶层 / Operative / Weapon / Effect 描述符 / 触发点 / policy / 关键词标签 / 校验，全部按原文建模。
- **§2.4 effect 四问是核心不变量**：trigger.point / pipelineStep / modifier.kind / stacking.policy 缺一拒绝。这是 data-driven 与 enforcer（Story 1.4）能工作的前提。
- **§2.4.1 modifier.kind 总数 = 21（含 HEAL_OPERATIVE 补丁，D-32）**：原架构表列 20 项缺「回复耐伤」，但 3 阵营均有治疗机制（军团灵魂盛宴/吸魂、瘟疫慈父祝福/腐烂活力）→ 补 `HEAL_OPERATIVE`（payload `{amount,target,condition?}`，触发点视机制 ON_INCAPACITATED/AT_PIPELINE_END 等）。架构表已同步加该行。
- **rulesRef 字段**：Effect 接口含 `rulesRef?:{doc,section}`（指向本地 `docs/rules`，不入公开仓库 D-29），供 FR-23 规则查询与日志回放渲染**参数化要点**（不渲染 GW 原文）。阵营数据包（1.3/2.1/3.1）应**为每个 effect 填 rulesRef**。
- **§2.8 校验**：JSON Schema（TS 同源）+ `rulesetVersion` 版本护栏，非法拒绝不静默降级。

### 关键约束

- **判别联合必须用字面量联合 + `kind`/`policy` 作为判别字段**，使 switch 穷尽检查在编译期生效（ADR-03 strict 的核心理由）。`noUncheckedIndexedAccess: true` 已在 tsconfig。
- **不引入通用 eval**（§2.5）：条件谓词是有限封闭集，本 story 只定义 `ConditionPredicate` 类型壳，谓词库实现留 Story 1.4/1.6。
- **CUSTOM_HOOK 仅声明类型**（§2.4.1 v1 范围说明）：v1 不触发 hook、不建模协助/戒备，schema 允许该 kind 但不强制实现其执行器。
- **零 UI 依赖**：`src/rules/` 不 import react/zustand；可被 engine/ui/dice 任意层引用。
- **IP（D-29）**：本 story 只建 schema 与空骨架，不含任何 GW 原文/阵营名称。阵营数据在 Story 1.3。
- **JSON Schema 校验器选型**：优先 Ajv（轻、CSP 友好）；避免任何 `new Function`/`eval` 类库（GH Pages CSP）。选定后记入 Dev Notes。

### Project Structure Notes

- 落位 `src/rules/{types,schema,packLoader.ts,version.ts,index.ts}` + `src/data/packs/core.kt-lite.v1.json`。与架构 §9 目录一致。
- JSON Schema 文件放 `src/rules/schema/`，作为运行时资产被 import（Vite 支持 JSON import）。

## References

- 架构 §2.1-2.8（数据包 schema / effect 描述符 / modifier.kind / 触发点 / policy / 校验）— `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- 架构 §3.1（step id 枚举，pipelineStep 取值源）— 同上
- 架构 ADR-03（strict + 判别联合为何）— 同上
- Epic 1 Story 1.2 — `planning-artifacts/epics.md`
- PRD FR-21 / FR-7 / NFR-5 / D-23 / D-29 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- 依赖 Story 1.1（脚手架/tsconfig strict/目录已建）

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
