---
title: Kill Team 战棋助手 — 架构设计（首版草案）
status: draft
created: 2026-06-28
---

# 架构设计草案：Kill Team 战棋助手

*读者：构建者本人（Winst）及下游 Epic/Story 拆分、实现阶段。本文为「首版草案（draft）」，意在锁定主结构与关键决策；细节接口签名留待实现期补全。*

## 0. 文档说明

- **上游约束来源**：`prds/prd-kill-team-companion-2026-06-28/prd.md`（final）。本文每一处技术决策都回指 PRD 的 FR/NFR/护栏。硬约束（无后端 / 仅会话内存 / 单屏全公开 / 自由坐标棋盘 / data-driven 规则 / 骰源两可 / 全程可审计 / 缺口降级人工裁定）**不再讨论其合理性**，作为不可违背前提。
- **本草案必须给出**（PRD OQ-3 关联）：技术栈、规则数据 schema、结算引擎架构、几何模块、骰源无关输入层、回合/激活状态机、信任/可审计实现、模块边界与数据流、目录结构、开放架构问题。
- **规则细节来源**：`docs/rules/merged_kt_lite_rules_zh.md` 等 4 份官方转 md。本文涉及的流水线步骤名、武器规则、阵营机制均已对照规则源核对，引用处标注规则段名。
- **决策记录体例**：每个关键决策给「推荐 + 理由 + 备选 + 取舍」。`ADR-NN` 编号便于后续追溯与推翻。

---

## 1. 技术栈选型

### 1.1 推荐栈（结论先行）

| 层 | 选型 | 理由摘要 |
|---|---|---|
| 语言 | **TypeScript（strict）** | 结算引擎是正确性头号要求（PRD NFR），TS 的判别联合 + 穷尽检查能把 effect 类型、流水线 step ID、状态机状态在编译期钉死，避免 `any` 漏算。 |
| UI 框架 | **React 18 + Vite** | 生态最广、人才最熟（构建者即用户，长期可维护性第一）；函数组件 + hooks 与「结算步骤日志 → UI 回放」天然契合。Vite 的 SPA 构建对 GH Pages 友好。 |
| 状态管理 | **Zustand（主）+ React context（派生视图）** | 结算引擎状态是单一可信源、高写入频率、需时间旅行（回滚）；Zustand 轻量、无样板、支持 middleware（subscribe、临时快照）。**不引入 Redux**：样板过重、action 风格与事件溯源日志耦合差。 |
| 几何 / 数学 | **原生 + 谓词表（无重依赖）**；可选 `polygon-clipping`（多边形布尔） | 自由坐标几何核心是「线段-多边形相交」「点在多边形内」「圆-多边形距离」，纯算法，零依赖最易审计；只在掩护/遮挡多边形运算确实需要时才引第三方。 |
| 骰子 | **内部纯函数 PRNG（seedable）**；电子投走它，物理骰走同一流水线 | 见 §6；可审计要求骰结果可复现，故用可设种子的 PRNG（Mulberry32 / xoshiro），种子入日志。 |
| 构建/部署 | **Vite build → `dist/` → GitHub Actions → GitHub Pages**；basename 配 `/`，禁用路由（纯 hash 或无路由单页） | 无后端 + GH Pages 子路径，必须 base 正确；SPA 刷新 fallback 用 404.html 或 hash 路由（见 ADR-07）。 |
| 测试 | **Vitest（单元/逻辑）+ Playwright（端到端结算流程）** | 引擎正确性是头号 NFR，逻辑层必须高覆盖单测；结算端到端用 Playwright 录「投骰→结算→回放」。 |

### 1.2 框架备选与取舍（ADR-01..03）

- **ADR-01 为什么是 React 而非 Svelte/Vue**：构建者长期单人维护，框架本身的「熟手红利」> 框架理论性能。Svelte 编译期优化对本应用的结算引擎（瓶颈在几何/逻辑，不在 DOM diff）无收益；Vue 的响应式 ref 体系与「结算步骤日志这种有序事件流」耦合不如 React 的 `useReducer`/Zustand 直观。**取舍**：React bundle 略大（~40KB gz），但 GH Pages 体积无约束。
- **ADR-02 为什么是 Zustand 而非 Redux/内置 useState**：结算引擎需要「当前状态 + 历史步骤日志」两份，Zustand 的 `set/get` + middleware 天然支持；Redux 的 action dispatch 风格会让 effect 叠加的中间状态（每步流水线产出）写成大量 action 样板；纯 useState 无法跨组件共享结算快照。**取舍**：Zustand 非「框架级」标准，但单人项目可接受。
- **ADR-03 为什么 TS strict**：effect 描述符的「修正类型 + 叠加性」两个枚举若不穷尽检查，enforcer 极易漏处理新枚举值，破坏 PRD FR-7 的「12 条叠加规则强制」。strict + 判别联合把这类错误压到编译期。

### 1.3 部署链路

```
本地开发 (vite dev)
   ↓
git push main
   ↓
GitHub Actions: npm ci → npm test → npm run build → 上传 dist 到 gh-pages 分支
   ↓
GitHub Pages 提供 <user>.github.io/<repo>/  (静态, HTTPS, 无后端)
```

- **离线可用**（PRD NFR）：构建产物为纯静态 JS/CSS/数据包 JSON，加载后无任何网络调用；可在 Service Worker 里做 App-shell 缓存（**v1 可选**，非 MVP 必需）。

---

## 2. 规则数据 Schema（落地 PRD OQ-3）

> **设计目标**：规则以声明式 JSON 数据包形式存在；引擎逻辑（step + enforcer）与数据（profile/effect/faction pack）**物理分离**。加阵营 / 修勘误 = 改 JSON，不改代码。schema 用 TypeScript 类型 + JSON Schema 双重约束（前者编译期，后者运行时校验数据包加载）。

### 2.1 数据包顶层结构（Faction Pack）

```jsonc
// packs/legionaries.v1.json
{
  "packId": "legionaries",
  "version": "1.0.0",
  "rulesetVersion": "kt-lite-1.0",   // 关联核心规则包版本，引擎据此选流水线
  "faction": {
    "id": "legionaries",
    "name": "军团兵",
    "keywords": ["CHAOS", "LEGION"],
    "subFactionSelector": {            // 子标识选择器（混沌印记 5 选 1）
      "id": "markOfChaos",
      "label": "混沌印记",
      "options": ["KHORNE", "NURGLE", "SLAANESH", "TZEENTCH", "UNALIGNED"],
      "default": "UNALIGNED"
    }
  },
  "operatives": [ /* 见 §2.2 */ ],
  "weapons":     [ /* 见 §2.3 */ ],
  "effects":     [ /* 见 §2.4：阵营招牌机制作为 effect 定义 */ ],
  "abilities":   [ /* 持久被动、战团战术等，引用 effect */ ],
  "stratagems":  [ /* 战略/交战计谋，含 CP 消耗 + use-limit */ ],
  "wargear":     [ /* 阵营装备 */ ],
  "buildConstraints": { /* FR-20 结构性约束：特工来源 / 子阵营选择器(印记5选1·战团战术8选2) / 装备限制；Lite 无点数(D-30) */ }
}
```

**理由**：阵营的所有「可计算规则」都落到 `effects` 数组里，由统一 effect 描述符表达（§2.4），引擎不识别「这是军团兵的还是死亡天使的」——它只认 effect 描述符。这就是 data-driven 的核心：阵营机制 = 一组 effect 定义，挂在正确的流水线 step 上。

### 2.2 特工 Profile（Operative）

```jsonc
{
  "operativeId": "legionaries_champion",
  "name": "野心勇士",
  "keywords": ["CHAOS", "LEGION", "CHAMPION"],
  "stats": {
    "apl": 3,            // 行动点上限（基础值）
    "move": 5,           // 移动（英寸）
    "save": 3,           // 豁免属性（D6 命中阈值，3 = 3+）
    "wounds": 13         // 耐伤
  },
  "base": { "diameterMm": 25 },           // 底座直径——规则源不提供，按 GW 标准约定填（D-27）；几何 baseCircle 据此
  "weaponRefs": ["bolt_pistol_legion", "chainsword_legion"],
  "abilities": ["markOfChaosPassive", "legionChampionAura"],
  "uniqueLoadoutOptions": [ /* 可选装备 */ ]
}
```

**两层属性模型**（FR-2）：`stats` 是**基础值**；运行期由引擎算出「基础 + 修正栈」得到**有效值**。基础值不含受创/计谋/印记等运行期变化（PRD FR-2 明确：持徽手 APL 类的「非修正调整」算基础值一部分，在数据里静态写明，不走 effect）。

### 2.3 武器 Profile（Weapon）

```jsonc
{
  "weaponId": "bolt_pistol_legion",
  "name": "爆矢手枪",
  "kind": "RANGED",                       // RANGED | MELEE
  "profile": {
    "attacks": 4,                         // 攻击骰数量
    "hit": 3,                             // 命中属性（3 = 3+ 成功）
    "normalDamage": 3,                    // 普通成功伤害
    "criticalDamage": 4,                  // 关键成功（暴击）伤害
    "range": 12,                          // 射程（英寸）；MELEE 省略
    "weaponRules": ["PISTOL", "PIERCING1"]// 武器规则标签，引擎据此插修正
  },
  "keywords": ["BOLT"]                    // 爆矢武器等武器类型关键词
}
```

**武器规则标签 → effect 的映射**：`weaponRules`（精准/平衡/残暴/无休/毁灭/重型/过热/致命/有限/穿刺/重击/范围/毫不留情/撕裂/集中/追踪/严重/震荡/安静/晕眩/洪流/毒素/剧毒）在引擎内部各自展开成一个 effect 描述符（见 §3.2），挂到对应 step。这样「武器规则」与「阵营 effect」用**同一套修正描述符**，enforcer 一套叠加规则管全部。

### 2.4 Effect 描述符（核心 schema —— 决定整个引擎表达力）

这是 OQ-3 的关键产物。一个 effect 描述符回答四个问题：**何时触发 / 插入哪个 step / 改什么 / 能否叠**。

```jsonc
{
  "effectId": "doctrine_devastation_balanced",
  "label": "毁灭条令 · 平衡",
  "source": "ability:combatDoctrine",     // 来源引用（计谋/装备/阵营能力/武器规则）

  "trigger": {                            // 何时触发（§2.5）
    "point": "BEFORE_HIT_ROLL",           // 触发点枚举
    "condition": {                        // 可选条件谓词（纯函数式表达式）
      "all": [
        { "op": "weaponKindIs", "args": ["RANGED"] },
        { "op": "rangeBucket", "args": ["BEYOND_6IN"] }
      ]
    }
  },

  "pipelineStep": "HIT_ROLL",             // 插入哪个流水线 step（§3.1）
  "priority": 50,                         // 同 step 内多 effect 的排序提示（默认 50；缺口处留 hook，不静默仲裁）

  "modifier": {                           // 改什么
    "kind": "ATTACH_WEAPON_RULE",         // 修正类型枚举（见下）
    "payload": { "rule": "BALANCED" }
  },

  "stacking": {                           // 叠加性（FR-2/FR-7）
    "policy": "UNIQUE_PER_SOURCE",        // 见 §2.6 叠加策略枚举
    "groupKeys": ["weaponRule:BALANCED"]  // 同组判定键
  }
}
```

#### 2.4.1 修正类型（`modifier.kind`）枚举

PRD FR-2 列举的修正类型全部建模为判别联合：

| `kind` | 语义 | 典型 payload | 规则出处 |
|---|---|---|---|
| `HIT_PLUS` / `HIT_MINUS` | 加/减命中属性（命中阈值升降） | `{amount: 1}` | 受创 -1、传染 -1 |
| `DAMAGE_PLUS` / `DAMAGE_MINUS` | 加/减单枚攻击骰伤害 | `{amount:1, scope:"NORMAL\|CRITICAL\|BOTH"}` | 剧毒 +1、血祭 +1 |
| `UPGRADE_SUCCESS` | 普通成功→关键成功升级 | `{fromNatRoll?}` | 致命 x+、强健 |
| `DOWNGRADE_SUCCESS` | 关键→普通（罕见） | — | — |
| `COUNT_PLUS` / `COUNT_MINUS` | 攻击骰/防御骰数量增减 | `{dice:"ATTACK\|DEFENCE", amount:1}` | 爆炸 x、洪流 |
| `REROLL` | 重掷（全重掷 / 选重掷） | `{mode:"ALL\|CHOOSE", count?}` | 平衡、无休、撕裂 |
| `AUTO_SUCCESS` | 不掷直接算成功 | `{count:1, grade:"NORMAL"}` | 精准 x |
| `ATTACH_WEAPON_RULE` | 给武器临时附加一条武器规则 | `{rule}` | 条令、印记 |
| `PIERCE` | 防御骰减数 | `{amount:1, criticalOnly?:bool}` | 穿刺1、关键穿刺1 |
| `COVER_SAVE` | 掩护豁免（额外保留成功） | `{extraNormal:1, upgradeToCritical?:bool}` | 掩护、隐匿、制高点 |
| `DAMAGE_MITIGATION` | 减伤（FNP 类） | `{threshold:3, roll:"4+"}` | 恼人韧性、纳垢韧性 |
| `IGNORE_DAMAGE` | 整枚忽略（一次性） | `{oncePerBattleId}` | 钢铁光环 |
| `IMMUNITY` | 免疫某类 effect | `{immuneToEffectGroup}` | 坚决免疫震荡、传染不与受创叠 |
| `EXTRA_DAMAGE_ON_HIT` | 命中后额外伤害 | `{amount:1, cap:7}` | 血祭、震慑突袭 |
| `GRANT_MARKER` | 给目标/自身打指示物 | `{marker:"POISON", atStep?}` | 毒素（流程结束获得） |
| `APL_PLUS` | APL 增减 | `{amount:1, duration:"ACTIVATION"}` | 变异与扭转 |
| `HEAL_OPERATIVE` | 回复耐伤（治疗） | `{amount, target:"SELF"\|"target", condition?}` | 灵魂盛宴（军团）、吸魂、慈父祝福/腐烂活力（瘟疫） |
| `CUSTOM_HOOK` | 缺口降级 hook（见 §4.4） | `{hookId, prompt}` | KT Lite 协助/戒备等未定项 |

> **`CUSTOM_HOOK` 是护栏的执行点**：PRD「规则缺口绝不静默猜」靠它落地——遇到 Lite 未定的判定，effect 声明走 hook，引擎在 UI 弹人工裁定框，把裁定结果作为 effect 输入，并记入日志。
>
> **v1 范围说明（D-23）**：v1 仅 KT Lite，不做版本切换。协助/戒备/重掷优先级不在 Lite → v1 **不建模、不触发 hook**；阵营卡「不能协助」类条款在 v1 休眠。CUSTOM_HOOK 仅留给实现期发现的真实歧义，v1 大概率不启用。

#### 2.4.2 触发点（`trigger.point`）枚举

从规则源抽取的触发时机（§6 调研已确认完整集），与流水线 step 对齐：

```
BEFORE_PIPELINE          // 结算开始前（资格判定已过）
BEFORE_HIT_ROLL          // 掷攻击骰前（条件修正/附加武器规则）
ON_HIT_ROLL              // 掷攻击骰
AFTER_HIT_ROLL           // 保留成功后（升级/重掷在此）
BEFORE_DEFENCE_ROLL      // 掷防御骰前（穿刺、掩护豁免）
ON_DEFENCE_ROLL          // 掷防御骰
AFTER_DEFENCE_ROLL       // 成功升级（超人体格、强健）
ON_PARRY_ALLOCATION      // 抵挡分配（决斗家、残暴、震荡）
ON_DAMAGE_PER_DIE        // 每枚造伤（毁灭即时、剧毒）
ON_DAMAGE_TOTAL          // 总伤害（FNP/恼人韧性/钢铁光环）
BEFORE_WOUNDS_REDUCE     // 扣耐伤前（最终减免）
AT_PIPELINE_END          // 流程结束（毒素指示物获得）
ON_ACTIVATION_START      // 激活开始（毒素伤害、变异与扭转 APL）
ON_ACTIVATION_END        // 激活结束
ON_REACTION              // 反应触发（复仇之怒）
ON_INCAPACITATED         // 被残废（无尽杀戮、剧毒破灭）
ON_TURNING_POINT_END     // 转折点结束（effect 到期、灵活战术还原）
```

### 2.5 条件谓词（`trigger.condition`）

声明式纯函数表达式，引擎内置一个小型谓词库（`weaponKindIs` / `rangeBucket` / `targetHasMarker` / `attackerHasKeyword` / `targetInCover` / `operativeIsInjured` 等）。**不引入通用 JS eval**（安全 + 可审计 + GH Pages CSP）。新谓词 = 改引擎代码，但谓词本身是有限封闭集，可控。

### 2.6 叠加策略（`stacking.policy`）枚举 —— FR-7 的数据面落点

| policy | 语义 | 规则出处 |
|---|---|---|
| `STACKABLE` | 可叠（同类多次都生效） | 持徽手 APL、APL 修正 |
| `UNIQUE_PER_SOURCE` | 同来源唯一（同计谋/同装备只生效一次） | 战团战术不自我叠加 |
| `UNIQUE_PER_GROUP` | 同 groupKeys 唯一 | 平衡/无休/撕裂等同源升级不叠 |
| `MUTUALLY_EXCLUSIVE_WITH` | 与指定组互斥（不与受创叠） | 传染不与受创叠、掩护豁免不与制高点叠 |
| `CONDITIONAL` | 条件触发（满足条件才生效） | 关键穿刺仅攻击方有关键成功时 |
| `CAP_PER_ATTACK_DIE` | 每枚攻击骰上限 | 同源减伤每枚上限 1 |

**12 条叠加规则**（FR-7）并非写成 12 个特殊分支，而是**集中由 enforcer 按上述 policy 强制**（见 §3.3）。数据侧只需正确标注 policy，逻辑侧集中读 policy。

### 2.7 关键词标签体系（FR-23 内联查询的基础）

```
faction:        LEGION / ANGELS_OF_DEATH / PLAGUE_MARINES / IMPERIUM / CHAOS
subFaction:     ASTARTES / HERETIC_ASTARTES
chaosMark:      KHORNE / NURGLE / SLAANESH / TZEENTCH / UNALIGNED
operativeType:  CHAMPION / GUNNER / FIGHTER / BANNER_BEARER / ...
weaponType:     BOLT / PSYKIC / POWER / CHAIN
weaponClass:    PISTOL / HEAVY / GRENADE
weaponRule:     精准/平衡/残暴/...（§2.3）
command:        ENGAGED / CONCEALED
status:         INJURED / CRITICALLY_INJURED / INCAPACITATED
marker:         POISON / FLY / BLOOD
```

### 2.8 数据包校验

- **加载期**：JSON Schema（与 TS 类型同源生成）校验结构；非法数据包拒绝加载并在 UI 报错（不静默降级）。
- **版本兼容**：`rulesetVersion` 不匹配引擎版本时，提示「数据包为 vX，引擎支持 vY」（PRD 数据版本化护栏）。

---

## 3. 结算引擎架构

> 结算引擎是 PRD 的根价值（D-01）。它 = **可组合 step 流水线** + **两层属性模型** + **集中叠加 enforcer** + **阵营 effect 数据驱动接入**。

### 3.1 流水线 step 模块化（FR-4 射击 10 步 / FR-5 近战 7 步）

每个 step 是一个**纯函数**，签名统一：

```ts
type StepFn = (ctx: ResolutionContext, input: StepInput) => StepOutput;
// ctx：只读快照（特工状态、棋盘、effect 栈、骰源、日志写入器）
// input：上一步产出 + 本步原始骰/决策
// output：本步结果 + 写入日志的 step record + 可能的人工裁定 query
```

#### 射击流水线（step 序列与规则源对齐）

| # | step id | 规则出处 | 关键 effect 插入点 |
|---|---|---|---|
| 1 | `WEAPON_SELECT` | 规则「1. 选择远程武器」 | — |
| 2 | `TARGET_VALIDATE` | 规则「2. 选有效目标、控制范围内无己方」 | FR-10 资格判定在此（可见/掩护/遮挡/射程/控制范围，见 §4） |
| 3 | `HIT_ROLL` | 规则「3. 掷攻击骰、≥命中保留」 | `BEFORE_HIT_ROLL`（印记/条令附加规则）、`AFTER_HIT_ROLL`（重掷/升级） |
| 4 | `ATTACK_UPGRADE` | 平衡/无休/撕裂/严重/致命/精准 | `AUTO_SUCCESS`、`REROLL`、`UPGRADE_SUCCESS` |
| 5 | `DEFENCE_ROLL` | 规则「4. 掷防御骰」 | `BEFORE_DEFENCE_ROLL`（穿刺、关键穿刺）、`COVER_SAVE`（掩护豁免） |
| 6 | `DEFENCE_UPGRADE` | 规则「4. 掩护豁免」+ 强健/超人体格 | `AFTER_DEFENCE_ROLL`（成功升级） |
| 7 | `PARRY_ALLOCATE` | 规则「5. 抵挡分配」 | `ON_PARRY_ALLOCATION`（决斗家、残暴、震荡） |
| 8 | `DAMAGE_PER_DIE` | 规则「6. 未抵挡造伤」+ 毁灭即时/剧毒 | `ON_DAMAGE_PER_DIE`（毁灭即时并行造伤、剧毒 +1） |
| 9 | `DAMAGE_TOTAL_MITIGATE` | 总伤害减免 | `ON_DAMAGE_TOTAL`（恼人韧性、纳垢韧性、钢铁光环） |
| 10 | `WOUNDS_APPLY_AND_AFTER` | 扣耐伤 + 后效 | `BEFORE_WOUNDS_REDUCE`、`AT_PIPELINE_END`（毒素指示物获得）、`ON_INCAPACITATED` |

#### 近战流水线（FR-5 7 步）

| # | step id | 规则出处 |
|---|---|---|
| 1 | `MELEE_TARGET_SELECT` | 规则「1. 选控制范围内敌方，对方反击」 |
| 2 | `MELEE_WEAPON_SELECT` | 规则「2. 各选近战武器」（阿斯塔特双近战特规） |
| 3 | `MELEE_SIMULTANEOUS_ROLL` | 规则「3. 双方同时掷攻击骰、各自保留」 |
| 4 | `MELEE_ALTERNATING_RESOLVE` | 规则「4. 从攻击方轮流结算、出击/格挡」 |
| 5 | `MELEE_PARRY_RULES` | 决斗家（普通挡关键）/残暴（只能关键挡）/震荡 |
| 6 | `MELEE_DAMAGE_AND_MITIGATE` | 出击造伤 + 减免（同 §3.1 step 8/9） |
| 7 | `MELEE_AFTER` | 后效（灵魂盛宴等）、毒素指示物 |

**近战的「轮流结算」是状态化的**：step 4 内部维护一个交替游标（attackDice/parryDice 池 + 当前轮到谁），每次玩家选择出击/格挡都是一个子决策，记入日志（满足 FR-16 单步回滚到任一子决策）。

#### 可组合性

- step 注册表：`SHOOTING_PIPELINE = [WEAPON_SELECT, TARGET_VALIDATE, ...]`，`MELEE_PIPELINE = [...]`。引擎按数组顺序驱动，每个 step 完成后写日志、推进游标、暴露「下一步/暂停/撤销」。
- **阵营机制不写进 step 代码**：阵营 effect 通过 `pipelineStep` 字段挂到对应 step，step 在执行前后扫描 effect 栈，按 `trigger.point` 调用对应 modifier。这就是 data-driven 的接入点。

### 3.2 两层属性模型实现（FR-2）

```ts
interface EffectiveStat {
  base: number;                  // 来自 operative.stats（含持徽手等静态调整）
  modifiers: AppliedModifier[]; // 运行期 effect 产出，按 enforcer 过滤后保留
  effective: number;             // base + Σ(modifiers) —— 引擎只读这个
}
```

- 每次需要属性值时，引擎调用 `resolveStat(operative, statName, ctx)`：取 base → 收集所有 active effect 中针对该 stat 的 modifier → 经 enforcer（§3.3）按 stacking policy 过滤 → 求和。
- **关键不变量**：`base` 永远来自数据包，运行期不可变；所有变化都进 `modifiers` 并留痕。这使得回滚（§7）只需撤销 modifier 应用记录，不必回写基础值。

### 3.3 叠加规则 enforcer（FR-7 集中强制）

`enforcer(modifiers, ctx) => modifiers'` 是一个**纯函数过滤器**，集中实现 12 条叠加规则。它读每条 modifier 的 `stacking.policy` 与 `groupKeys`，按规则去重/互斥/封顶：

```
enforcer 规则矩阵（rule → 实现策略）
─────────────────────────────────────
R1  同类成功升级不叠        → UNIQUE_PER_GROUP（groupKeys=[upgradeKind]）
R2  近战禁<6 升级关键       → CONDITIONAL（hit<=5 时 upgrade 不挂）—— 偏移肩盾类
R3  同源减伤每枚上限 1      → CAP_PER_ATTACK_DIE（amount 上限 1/源）
R4  命中-1 不与受创叠       → MUTUALLY_EXCLUSIVE_WITH（受创组）
R5  掩护豁免不与制高点叠    → MUTUALLY_EXCLUSIVE_WITH（highGround 组）
R6  战团战术不自我叠加      → UNIQUE_PER_SOURCE
R7  关键穿刺条件触发        → CONDITIONAL（attackerHasCritical）
R8  毁灭即时并行            → 不是 stacking 约束，是 step 8 的并行语义
R9  过热每行动一次          → UNIQUE_PER_ACTION（按 actionId 去重）
R10 持徽手 APL 叠加         → STACKABLE
R11 毒素指示物时机          → 触发点约束（AT_PIPELINE_END，非当次攻击）
R12 传染不与受创累计        → MUTUALLY_EXCLUSIVE_WITH（injured 组）
```

**为什么集中而非散落**：FR-7 是正确性护栏（PRD 头号 NFR）。散落到各 step 的 if 分支会让「新增一条叠加规则」变成全流水线搜代码；集中后，新增 = 在 enforcer 加一条规则 + 在数据包标对 policy。这同时满足 SM-C1（不为数量牺牲正确性）——叠加逻辑可单测全覆盖。

### 3.4 阵营机制接入正确 step（FR-6 落地）

阵营机制**全部以 effect 描述符形式**存在于阵营数据包 `effects[]`，引擎不写 `if faction === 'plague'`。接入示例（毒素）：

```jsonc
// packs/plague_marines.v1.json → effects[]
{
  "effectId": "poison_weapon_grant_marker",
  "trigger": { "point": "AT_PIPELINE_END",
               "condition": { "op": "dealtAnyDamageThisPipeline" } },
  "pipelineStep": "WOUNDS_APPLY_AND_AFTER",
  "modifier": { "kind": "GRANT_MARKER", "payload": { "marker": "POISON", "target": "DEFENDER" } },
  "stacking": { "policy": "STACKABLE" }
},
{
  "effectId": "poison_marker_activation_damage",
  "trigger": { "point": "ON_ACTIVATION_START",
               "condition": { "op": "operativeHasMarker", "args": ["POISON"] } },
  "pipelineStep": "ACTIVATION_PRE",
  "modifier": { "kind": "DAMAGE_MINUS", "payload": { "amount": 1 } },
  "stacking": { "policy": "STACKABLE" }
}
```

阵营接入点一览（调研 §4 已核对）：
- **军团兵印记**：恐虐→`ATTACH_WEAPON_RULE`(严重)@`MELEE_*`；纳垢→`DAMAGE_MITIGATION`@`DAMAGE_TOTAL`；色孽→移动属性 modifier（非结算）；奸奇→远程武器附加严重；无分→条件附加无休。
- **死亡天使战团战术**：8 条各为一 effect，挂 hit/defence/damage/APL 等不同 step；钢铁光环 = `IGNORE_DAMAGE` + `oncePerBattle` 计数（状态机追踪）。
- **瘟疫战士**：毒素（如上）；恼人韧性 = `DAMAGE_MITIGATION`@`ON_DAMAGE_TOTAL`（每枚骰独立判定，与纳垢韧性同 step 不同阈值）；传染 = hit/move modifier + `MUTUALLY_EXCLUSIVE_WITH(injured)`。

---

## 4. 几何模块（自由坐标 —— PRD 最重实现表面，D-18）

### 4.1 数据结构

```ts
interface Board {
  bounds: { w: number; h: number };        // 英寸
  terrain: TerrainFeature[];               // 地形/掩护特征
  operatives: OperativePlacement[];        // 特工位置
}
interface OperativePlacement {
  operativeId: string;
  baseCircle: { x: number; y: number; r: number }; // 底座圆；r = operative.base.diameterMm/2（D-27，规则源不提供尺寸）
  facing: number;                                   // 朝向（弧度；LOS 用头部→目标方向）
}
interface TerrainFeature {
  id: string;
  polygon: [number, number][];             // 顶点环（英寸坐标）
  kind: "BLOCKING" | "COVER" | "OBSCURING";// 阻挡视线 / 提供掩护 / 制造遮挡
  vantage?: boolean;                       // 制高点地形：特工底座压其上 → COVER_SAVE 增益（Lite 制高点）
  climbable?: boolean;                     // 可攀爬：转移可穿过/攀爬，冲刺不可（FR-12）
  height?: number;                         // 立体高度——v1 仅占位，真·多层 LOS 不做（D-23/D-25）
  keywords: string[];
}
```

### 4.2 计算策略（FR-9）

| 判定 | 算法 | 说明 |
|---|---|---|
| **LOS（可见）** | 头部点 → 目标底座圆的线段，与所有 `BLOCKING` 多边形求交 | 任一相交即不可见；用「视线绕过角点」近似（线段-多边形相交） |
| **掩护** | 目标控制范围（1" 圆）内存在 `COVER` 地形特征 → 得掩护 | 规则：控制范围内有阻碍地形即得；2" 内有他特工则无（额外检查） |
| **被遮挡** | 目标在 `OBSCURING` 特征内或视线穿过其体积 | 与掩护语义不同，单独判定（飞蝇云等） |
| **射程** | 武器 `range` 与「攻击方底座圆心 → 目标底座圆最近点」距离比较 | 用圆-圆最近距离，非圆心距 |
| **控制范围** | 两特工底座圆最近点距离 ≤ 1" 且可见 | 对称 |
| **制高点（vantage）** | 特工底座圆与 `vantage` 地形多边形相交 → 触发 COVER_SAVE effect | Lite 制高点地形增益 |

> **可攀爬（climbable）** 非几何计算，属移动合法性（FR-12）：转移行动可穿过/攀爬 `climbable` 地形，冲刺行动不可。**制高点与可攀爬在平地地图休眠**——地图无此类地形则永不触发（D-25）。

### 4.3 性能 / 精度

- 棋盘规模小（十几特工 + 几十多边形），暴力 O(n·m) 完全够；**不做空间索引优化**（v1 不需要，避免过早复杂化）。
- 浮点比较留**宽松 epsilon 带**（约 0.25 英寸）；带内 = AMBIGUOUS 走咨询式翻转（§4.4），带外 = CLEAR 直接套，均不静默默认。

### 4.4 几何咨询式判定（advisory + 玩家终裁 —— 护栏落地，D-17）

几何在 KT 中本就由玩家目测裁定（不存在亚毫米精度）。引擎不充当权威阻断者，而作**咨询器**：给最佳判定 + 置信度，玩家对任何判定都可一键翻转，全部入日志。

接口：

```ts
interface GeometryFinding {
  kind: "LOS" | "COVER" | "OBSCURED" | "RANGE" | "ENGAGEMENT";
  value: boolean;                 // 引擎最佳判定
  confidence: "CLEAR" | "AMBIGUOUS";  // CLEAR=远离边界；AMBIGUOUS=落在 epsilon 带
  margin: number;                 // 距判定边界的英寸数（正=判定方向余量）
  overridden?: boolean;           // 玩家是否翻转过
  finalValue: boolean;            // value 或翻转值 —— 资格判定/流水线只读这个
}
// 引擎对每项几何各产出一个 GeometryFinding；UI 把 AMBIGUOUS 项默认套 value 并标「可翻转」
```

行为约定：

- **从不阻塞快路径**：无弹框。AMBIGUOUS 项以内联可翻转假设呈现（UI 1 击翻），CLEAR 项直接套用。
- **资格判定（FR-10）随翻转实时重算**：玩家翻 LOS → 有效目标资格即时变更。
- **绝不静默猜**：每项 finding（含 confidence、margin、是否翻转、finalValue）写入步骤日志（FR-16/17），完全透明。
- epsilon 取**宽松带**（约 0.25"）：带内 = AMBIGUOUS，带外 = CLEAR。比 1e-3" 更贴现实（拖放录入精度本就有限）。

> **取舍**：引擎对模糊部分「透明建议 + 人裁」，而非假装高精度或静默默认。比权威阻断更贴现实 KT、更快、仍满足 D-17 与 SM-C1。同时收掉原 AQ-2 的「歧义常态破快流」张力。

### 4.5 位置录入（FR-8 手动）

- v1：网格捕捉的拖放 + 数字输入框（x/y/朝向）；底盘尺寸预设（25/32/40mm）。
- **不做**扫描/token 自动同步（D-16）。

---

### 4.6 目标点与控制（FR-25）

```ts
interface ObjectiveMarker {
  id: string;
  pos: { x: number; y: number };
  controlRange: number;            // 控制范围（英寸，Lite 规则定）
}
```

- **控制判定**：每方在目标点 `controlRange` 内的特工数（友方多于敌方且至少 1 友方等，按 Lite 规则）→ 该方控制此目标点。几何上复用「特工底座圆心与目标点圆心距离 ≤ controlRange」（与 §4.2 控制范围算法同源）。
- **VP 得分（FR-26）**：状态机 context 持有 `vp: { a: number; b: number }`；转折点结束（TURNING_POINT_END）按各方控制目标点数累加 VP。
- **胜负（FR-27）**：BATTLE_END 比较 VP 总分判胜负。

### 4.7 预设地图模板（地形 + 目标点 + 降落区）

随数据包发布的**静态地图**（非对局状态，不违 D-20）。开局选模板 → 一键载入地形/目标点/降落区，免去手画。

```ts
interface MapPack {
  mapId: string;
  name: string;
  bounds: { w: number; h: number };       // 英寸
  terrain: TerrainFeature[];              // 地形多边形 + 类型/标志（§4.1）
  objectives: ObjectiveMarker[];          // 目标点位置（占领任务，§4.6）
  dropZones: { a: [number,number][]; b: [number,number][] }; // 双方降落区（部署合法性 FR-24）
}
```

- **主源**：预设模板（标准布局），随版本发布在 `packs/maps/*.json`，与规则包同级。
- **自定义**：物理板非标准时会话内手画（刷新重置，D-20）；配快画工具（网格吸附 / 矩形·L 形预设 / 复制 / 镜像）。
- **坐标标定**：模板坐标以英寸为单位；特工底座 r 取自 §2.2 `base.diameterMm`（D-27）。

## 5. 骰源无关输入层（FR-3）

```
                    ┌─ ElectronicDiceSource (PRNG, seed 入日志)
DiceSource (接口) ──┤
                    └─ ManualDiceSource   (玩家物理投后录入每颗结果)

        二者产出统一 DiceRoll[] → 进入同一修正流水线
```

- `DiceSource.roll(n): DiceRoll[]`：电子投走 seedable PRNG（Mulberry32），seed = `(pipelineId, stepId, attempt)` 的 hash，记入 step 日志，**结果可复现**（FR-17 回放）。
- 物理骰：UI 提供录入面板，玩家逐颗填结果（含「这颗是关键成功吗」自动按自然点判定），产出同样结构 `DiceRoll[]`。
- **流水线对骰源无感知**：step 3/5 只调 `ctx.dice.roll(n)`，不关心来源。修正流水线（重掷/升级）对两种来源一致。
- 重掷：电子投重掷产生新 seed；物理骰提示玩家「请重投 X 颗并录入」。

---

## 6. 回合 / 激活状态机（FR-11 / FR-12）

### 6.1 顶层状态机

```
BATTLE_INIT
   ↓ (开局选先手、CP 初始化、放置目标点标识)
DEPLOYMENT (双方降落区交替部署特工，FR-24)
   ↓
TURNING_POINT_START ──→ STRATEGY_PHASE (战略计谋、CP 发放)
   ↓
ENGAGEMENT_PHASE ──→ 交替激活循环：
   ├─ 选择激活特工（须就绪）
   ├─ 选命令(交战/隐匿)
   ├─ 执行行动（≤APL，FR-12 合法性校验）
   ├─ 对方可触发反应（全待机时免费 1AP）
   └─ 翻待机 → 下一激活
   ↓ (双方所有特工待机)
TURNING_POINT_END (effect 到期、灵活战术还原、指示物结算、目标点控制判定 + VP 得分 FR-25/26)
   ↓ ×4 转折点
BATTLE_END (VP 总分判胜负 FR-27)
```

### 6.2 状态机实现

- **XState（推荐）** vs 手写 reducer：状态层级清晰（battle > turning point > phase > activation > action）、有正式 guard/action 语义、可视化。备选手写有限状态枚举 + switch（更轻但易漏迁移）。**推荐 XState**：FR-11 的「先手权/CP/就绪待机翻转/交替激活/反应/计谋次数」是典型分层 FSM，XState 的 hierarchical state + guarded transitions 直接对应。
- **FR-12 行动合法性**：作为 guard 函数挂在每个 action 迁移上（AP≤APL、同激活不重复同行动、后撤后禁转移/冲锋、隐匿/控制范围内禁射击等）。
- **CP / 计谋次数追踪**：状态机 context 持有 `cp: number`、`ployUses: { [ployId]: { perBattle, perTurningPoint } }`；计谋 effect 引用 `source: stratagem:xxx`，enforcer 据 `ployUses` 拦截超限。

### 6.3 反应（FR-11 子机制）

反应是「激活循环内对方的一次介入」，单独子状态：`AWAITING_REACTION` → 玩家可选触发反应计谋（复仇之怒）或放弃 → 回到激活循环。

---

## 7. 信任 / 可审计（FR-16 单步回滚 + FR-17 日志回放）

### 7.1 推荐方案：结算步骤日志（受限的 event sourcing）

不采用全应用 event sourcing（overkill，状态仅会话内存无需重放整局），而是**对结算引擎做步骤级 event sourcing**：

```ts
interface ResolutionLog {
  resolutionId: string;
  pipelineKind: "SHOOTING" | "MELEE";
  steps: StepRecord[];                   // 每个 step 一条，按序
  cursor: number;                        // 当前推进到第几步（支持暂停/单步）
}
interface StepRecord {
  stepId: string;
  inputs: Snapshot;                      // 进入本步的状态快照（深拷贝关键值）
  diceRolls?: DiceRoll[];                // 本步骰（含 seed）
  appliedEffects: AppliedEffectTrace[];  // 哪些 effect 在本步生效（含被 enforcer 拒绝的，记 reason）
  rulings?: ManualRuling[];              // 人工裁定（几何歧义/规则缺口）
  output: Snapshot;
  at: number;                            // 时间戳
}
```

### 7.2 单步回滚（FR-16）

- **前进/暂停**：游标 `cursor` 在 steps 数组上移动；UI「下一步」= 执行下一 step 并 append；「暂停」= 停在当前 cursor。
- **撤销**：丢弃 cursor 之后的 steps，从 cursor-1 的 `inputs` 快照恢复状态。因为状态是会话内存、step 是纯函数，撤销 = 回放已执行 step 的快照（无需逆向计算）。
- 结算外的回合动作（激活、移动、计谋）同样写简短动作日志，支持单步撤销。

### 7.3 日志回放（FR-17）

- 每个 `ResolutionLog` 可序列化为 JSON（已全是数据），UI 面板按 steps 渲染时间线，每步可展开看：骰、生效 effect（附规则原文引用）、被拒 effect（附 enforcer 规则编号）、人工裁定、最终输出。
- **规则引用（FR-23，D-29）**：effect 描述符带 `rulesRef: { doc, section }` **指向本地 `docs/rules`**（不入公开仓库）；回放/查询面板显示**引擎参数化要点**（数值/描述符/触发步骤），**不渲染 GW 原文**。

### 7.4 为什么不全应用 event sourcing

- PRD D-20：不做存档/持久化。全局 event sourcing 的核心收益（可重放、可迁移）依赖持久化，无后端 + 刷新即重置下收益消失。
- 结算步骤日志是「局部 event sourcing」，恰好覆盖可审计需求，复杂度可控。
- **取舍**：代价是「整局历史」不可跨会话回看——但 PRD 明确接受（D-20）。

---

## 8. 模块边界与数据流

### 8.1 模块依赖图（ASCII）

```
┌──────────────────────────────────────────────────────────────┐
│                         UI Layer (React)                       │
│  棋盘画布 │ 单位面板 │ 结算向导 │ 日志回放 │ 规则查询 │ 建队    │
└───────────────┬──────────────────────────────────────────────┘
                │ Zustand store 订阅
┌───────────────▼──────────────────────────────────────────────┐
│                   Application State (Zustand)                  │
│   battle state │ resolution logs │ UI state                    │
└──────┬─────────────────┬───────────────────────┬──────────────┘
       │                 │                       │
┌──────▼──────┐  ┌───────▼────────┐    ┌────────▼─────────┐
│ Turn State  │  │ Resolution     │    │ Geometry         │
│ Machine     │  │ Engine         │◄──►│ Module           │
│ (XState)    │  │ (pipeline+     │    │ (LOS/cover/range)│
│ FR-11/12    │  │  enforcer)     │    │ FR-9             │
└─────────────┘  │  FR-4/5/7      │    └────────┬─────────┘
                 └───────┬────────┘             │
                         │ 读取 effect/数据      │ 几何歧义 hook
                ┌────────▼──────────────────────▼────────┐
                │           Rules Data Layer              │
                │  PackLoader(JSON+Schema) │ Effect Registry│
                │  Keyword Index │ Rules Ref Lookup (FR-23)│
                └────────┬────────────────────────────────┘
                         │ 静态 JSON 数据包
                ┌────────▼────────┐
                │  packs/*.json   │ (核心规则 + 3 阵营)
                └─────────────────┘

横切：Resolution Log (event store) ← 引擎写、UI 读、回滚依赖
横切：Dice Source (电子/物理) → 引擎 step 3/5 消费
```

### 8.2 依赖方向不变量

- **数据层单向被依赖**：引擎、几何、UI 都读数据包；数据包不反向依赖任何模块（data-driven 的硬约束）。
- **几何被引擎调用，不反向**：引擎在 `TARGET_VALIDATE` step 调几何算 LOS/掩护；几何不调引擎。
- **状态机触发引擎，不反过来**：激活/行动触发结算，结算完成后回写状态（造伤、指示物、计谋次数）。
- **UI 只读 store + 发 intent**：UI 不直接调引擎/几何，所有变更经 store → 引擎/状态机。

### 8.3 关键数据流（一次射击结算）

```
玩家点目标(UI)
  → intent: ATTACK_TARGET(attackerId, targetId)
  → store dispatch
  → TurnStateMachine 校验当前可否攻击(FR-12)
  → ResolutionEngine.start(SHOOTING, ctx)
     step1 WEAPON_SELECT → step2 TARGET_VALIDATE
        ├─ Geometry: LOS/cover/obscured/range/engagement
        ├─ 几何 finding（CLEAR 套用 / AMBIGUOUS 可翻转假设，见 §4.4）
        └─ 不合法? → 拦截并说明(FR-14)，写日志，终止
     step3 HIT_ROLL → DiceSource.roll(attacks) → effect@BEFORE/AFTER
        └─ enforcer 过滤 modifier
     ... step4..10
     每步 append StepRecord → ResolutionLog
  → 结算完成回写：扣耐伤、effect 到期、指示物、CP 消耗
  → store 更新 → UI 重渲染（棋盘、日志面板）
```

---

## 9. 顶层目录结构建议

```
kill-team-companion/
├─ src/
│  ├─ engine/                  # 结算引擎（纯逻辑，零 React 依赖）
│  │  ├─ pipeline/             #   step 定义（shooting.ts / melee.ts / steps/）
│  │  ├─ enforcer.ts           #   叠加规则集中强制（FR-7）
│  │  ├─ statResolver.ts       #   两层属性模型（FR-2）
│  │  ├─ resolutionLog.ts      #   步骤日志（FR-16/17）
│  │  └─ types.ts
│  ├─ geometry/                # 自由坐标几何（FR-9）
│  │  ├─ los.ts / cover.ts / range.ts / engagement.ts
│  │  ├─ ambiguityHook.ts      #   人工裁定接口（§4.4）
│  │  └─ types.ts
│  ├─ rules/                   # 数据层（data-driven）
│  │  ├─ packLoader.ts         #   JSON+Schema 校验加载
│  │  ├─ effectRegistry.ts     #   effect 描述符 → modifier 执行器
│  │  ├─ predicates.ts         #   条件谓词库（§2.5）
│  │  ├─ rulesRef.ts           #   规则原文查询（FR-23）
│  │  └─ schema/               #   JSON Schema + TS 类型（同源）
│  ├─ state/                   # 应用状态
│  │  ├─ turnStateMachine.ts   #   XState FSM（FR-11/12）
│  │  ├─ store.ts              #   Zustand store
│  │  └─ types.ts
│  ├─ dice/                    # 骰源无关（FR-3）
│  │  ├─ source.ts             #   DiceSource 接口
│  │  ├─ electronic.ts         #   seedable PRNG
│  │  └─ manual.ts             #   物理录入
│  ├─ ui/                      # React 组件
│  │  ├─ Board/ UnitPanel/ Resolution/ Log/ RulesQuery/ Roster/
│  │  └─ hooks/
│  ├─ data/
│  │  └─ packs/                # 数据包 JSON（核心 + 3 阵营）
│  │     ├─ core.kt-lite.v1.json
│  │     ├─ legionaries.v1.json
│  │     ├─ angels_of_death.v1.json
│  │     └─ plague_marines.v1.json
│  ├─ App.tsx main.tsx
├─ tests/                      # Vitest 单测（引擎/几何/enforcer 高覆盖）
├─ e2e/                        # Playwright（端到端结算流程）
├─ .github/workflows/          # GH Actions: test+build+deploy to Pages
├─ public/ 404.html            # SPA fallback
├─ vite.config.ts
├─ package.json tsconfig.json
└─ _bmad-output/               # 规划产物（PRD/架构/Epic）
```

**关键原则**：`src/engine`、`src/geometry`、`src/rules`、`src/dice` 是**纯逻辑模块，零 UI 依赖**，可独立单测；`src/ui` 只消费 `src/state`。这让正确性头号 NFR 的核心逻辑可被高覆盖测试，不被 React 渲染干扰。

---

## 10. 开放架构问题（留后续）

| 编号 | 问题 | 影响面 | 建议 revisit 时机 |
|---|---|---|---|
| ~~AQ-1~~ | ~~建队点数模型~~ **已定（D-30）**：KT Lite **无点数模型**（核对规则源零匹配）。建队校验降级为结构性：特工来源 + 子阵营选择器 + 装备限制；`buildConstraints` 不含 points。 | FR-20 | — |
| ~~AQ-2~~ | ~~几何精度 vs 体验~~ **已部分收口（咨询式几何，§4.4）**：不再弹裁定框、不破快流。残项：epsilon 宽松带取值（0.25"?）与 AMBIGUOUS 默认方向（偏向防御方?）需实测。 | §4.4 | 实现几何后用真实棋盘调参。 |
| AQ-3 | **effect 谓词库的封闭性**：声明式条件谓词能否覆盖所有阵营机制，还是会出现必须写代码的新谓词？ | §2.5、阵营扩展性 | 实现 3 阵营后盘点谓词集，确认是否封闭。 |
| AQ-4 | **CP/计谋次数的状态机建模细节**：`ployUses` 放 XState context 还是独立 reducer？计谋 effect 如何引用并拦截超限。 | FR-11、§6.2 | 状态机实现时定。 |
| AQ-5 | **近战轮流结算的子决策日志粒度**：每次出击/格挡是否各成一条 StepRecord（最大化可审计）还是合并？ | §3.1 step4、§7 | 结算向导 UX 设计时与可审计需求权衡。 |
| AQ-6 | **Service Worker 离线缓存**：PRD NFR 要求「加载后离线可用」，是否 MVP 内做 PWA shell？ | §1.3 | MVP 可不做（GH Pages 一次加载即缓存于浏览器），v1.x 视体验补。 |
| AQ-7 | **路由方式**：hash 路由（GH Pages 免配置）vs Browser 路由 + 404.html fallback。 | §1.3、部署 | 实现入口文件时定；倾向 hash（零配置、刷新不 404）。 |
| ~~AQ-8~~ | ~~规则原文内联查询的存储~~ **已定（D-29）**：公开仓库；数据包**不含 GW 原文**、仅结构化计算数据；规则查询显示引擎参数化要点；`docs/rules` 本地留存。残项：名称仍属 GW IP（hobby 常态，构建者自定是否通用化）。 | FR-23、数据包 | — |
| ~~AQ-9~~ | ~~数据包与引擎版本兼容矩阵~~ **已简化（D-23）**：v1 仅 KT Lite 单一规则集，不做多版本共存。出现勘误直接改数据包版本号即可。 | 数据维护 | 出现首个勘误时定。 |
| AQ-10 | **CUSTOM_HOOK 的 UX 一致性**：缺口降级的人工裁定框，其输入控件（选择/数字/骰）如何统一模板化。 | §2.4.1、护栏 | 实现 KT Lite 缺口（协助/戒备/重掷优先级）时定。 |

---

## 11. 实现顺序与正确性护栏（喂 Epic 拆分）

- **垂直切片优先**：首个 epic = 核心规则 + **1 阵营全机制**端到端跑通（pipeline + enforcer + 几何咨询式 + 流水线 UI + 日志回放）。验证数据模型/enforcer 正确后，再扩第 2、3 阵营。不违背 PRD B1（全实现），仅是实现顺序。
- **Golden resolution tests（正确性护栏，SM-C1）**：每个阵营机制一条「输入快照 → 期望输出」金样单测（如「恐虐近战严重升级」「纳垢恼人韧性减伤」「毒素指示物时机」「关键穿刺条件触发」）。数据包/enforcer 任何改动必须过全部金样。
- **数据编写是关键路径**：3 阵营全量 effect 编码是最大工作量与最大错误面；epic 估算须按数据编写量而非代码量。

---

*草案结束。本文锁定主结构与 OQ-3 schema；AQ 表所列待后续工作流（UX 设计、Epic 拆分、实现）逐项消化。任何对硬约束（§0）的偏离须先回 PRD 修订，不得在架构层静默绕过。*
