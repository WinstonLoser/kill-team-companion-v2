# Story 1.3: 死亡天使数据包与 golden tests 框架 (angels-data-pack-golden-tests)

Status: ready-for-dev

## Story

As a 引擎,
I want 死亡天使完整结构化数据包（特工/武器/8 战团战术/战斗条令/计谋/装备，结构化无 GW 原文）+ golden resolution test 框架 + 死亡天使金样,
so that 引擎能跑死亡天使机制、且每个招牌机制的正确性可被「输入快照→期望输出」断言锁定。

## Acceptance Criteria

1. **AC1（数据包完整且结构化）**：`src/data/packs/angels_of_death.v1.json` 加载通过 Story 1.2 的 packLoader + schema；含特工（至少 Champion/Gunner/Fighter 等典型数人）/武器（爆矢类 + 近战类）/8 战团战术/战斗条令（猛攻/毁灭/肉搏，参数化）/计谋/装备；全部为结构化计算数据，**无 GW 原文**（NFR-7/D-29）。
2. **AC2（8 战团战术各挂正确 step）**：每条战团战术 = 一个 effect 描述符，`pipelineStep` + `trigger.point` 落在正确射击/近战 step（如命中类挂 `HIT_ROLL`/`BEFORE_HIT_ROLL`，防御类挂 `DEFENCE_ROLL`，APL 类挂激活 step）。钢铁光环 = `IGNORE_DAMAGE` modifier + `oncePerBattle` 计数语义（policy 标注 + 数据带 `oncePerBattleId`）。
3. **AC3（战斗条令→平衡等武器规则附加）**：战斗条令以 `ATTACH_WEAPON_RULE` modifier 形式表达（如毁灭条令→`BALANCED`），挂 `BEFORE_HIT_ROLL`；数据可被引擎识别为「给武器临时附加规则」。
4. **AC4（golden test 框架）**：`tests/golden/` 下有框架：给定「输入快照（特工状态/武器/effect 栈/骰源 seed 或固定骰）」→ 调引擎结算 → 断言「期望输出快照」；框架与阵营无关，可复用于 Epic 2/3。
5. **AC5（死亡天使金样）**：至少 5 条金样全部通过：
   - 猛攻条令撕裂（`ATTACH_WEAPON_RULE(RENDING)` + `REROLL` 语义）
   - 决斗家格挡（`ON_PARRY_ALLOCATION`，普通挡关键——近战 step，本 story 先以射击侧可表达的部分或 stub 近战占位，标注近战金样在 Story 1.7 补全）
   - 强健（`UPGRADE_SUCCESS`@`AFTER_DEFENCE_ROLL`）
   - 钢铁光环（`IGNORE_DAMAGE` + oncePerBattle，首次触发忽略整枚伤害，二次不再生效）
   - 战斗条令平衡（`ATTACH_WEAPON_RULE(BALANCED)`@`BEFORE_HIT_ROLL`）
   > 注：Story 1.6 前引擎未完工，金样可对 enforcer + effect 解析层做断言（如「该 effect 被 enforcer 接受、policy 正确、modifier 解析出预期 payload」），完整 pipeline 输出断言在 Story 1.6 完成后补齐——在 Completion Notes 标注衔接点。
5. **AC6（IP 护栏）**：数据包内名称（死亡天使/爆矢等）仅作本地标识；`docs/rules/merged_kt_angels_of_death_zh.md` 已在 `.gitignore`（Story 1.1），不入公开仓库；effect 的 `rulesRef.doc` 指向该本地路径。

## Tasks / Subtasks

- [ ] **T1 — 数据包骨架**（AC1）
  - [ ] `src/data/packs/angels_of_death.v1.json`：packId/version/rulesetVersion("kt-lite-1.0")/faction{id,name,keywords:[IMPERIUM,ASTARTES],subFactionSelector(战团战术 8 选 2)}
  - [ ] 用 Story 1.2 类型为注释/校验基准；跑 packLoader 自校验通过
- [ ] **T2 — 特工与武器**（AC1）
  - [ ] operatives：Champion/Gunner/Fighter 等，stats{apl,move,save,wounds} + base.diameterMm（25/28.5/32 按 GW 约定，D-27）+ weaponRefs + abilities
  - [ ] weapons：爆矢手枪/爆矢步枪/链锯剑等，profile{attacks,hit,normalDamage,criticalDamage,range,weaponRules[]}
  - [ ] 数值取自本地规则源 `docs/rules/merged_kt_angels_of_death_zh.md`，**只搬数值不搬原文**
- [ ] **T3 — 8 战团战术为 effect**（AC2）
  - [ ] 逐条写 effect 描述符：effectId/source:"ability:chapterTactic"/trigger{point,condition?}/pipelineStep/modifier/stacking{policy,groupKeys}
  - [ ] 钢铁光环：`modifier.kind=IGNORE_DAMAGE`，payload `{oncePerBattleId:"angels_iron_halo"}`，stacking.policy=UNIQUE_PER_SOURCE；标注 oncePerBattle 由状态机追踪（Story 1.9），本 story 数据层就绪
  - [ ] 每条 effect 的 pipelineStep 对照架构 §3.1 step 表（命中类→HIT_ROLL/ATTACK_UPGRADE，防御类→DEFENCE_ROLL/DEFENCE_UPGRADE，伤害类→DAMAGE_*）
- [ ] **T4 — 战斗条令与计谋/装备**（AC1/AC3）
  - [ ] 战斗条令：3 条 effect，modifier.kind=ATTACH_WEAPON_RULE，payload.rule ∈ {BALANCED, DEVASTATING, ...}，挂 BEFORE_HIT_ROLL（远程）/对应近战 step
  - [ ] stratagems：含 CP 消耗 + use-limit（perBattle/perTurningPoint）
  - [ ] wargear：阵营装备项
- [ ] **T5 — golden test 框架**（AC4）
  - [ ] `tests/golden/framework.ts`：`runGolden({name, input: ResolutionInputSnapshot, expected: ExpectedSnapshot, run: (input)=>output})`
    - 输入快照含：特工状态（含受伤/指示物）、武器、active effect 栈、骰源（固定 DiceRoll[] 或 seed）
    - 框架做深相等断言 + 失败时打印 diff；与阵营无关
  - [ ] `tests/golden/fixtures.ts`：构造死亡天使特工/武器快照的 helper
- [ ] **T6 — 死亡天使金样**（AC5）
  - [ ] `tests/golden/angels-of-death.test.ts`：5 条金样
    - 现阶段断言层 = effect 解析 + enforcer 接受 + modifier payload 正确（依赖 Story 1.4 enforcer）
    - 钢铁光环金样：构造同一特工两次受伤输入，断言首次 IGNORE_DAMAGE 生效（伤害 0）、二次不再生效（oncePerBattle 已耗）
    - 强健金样：断言 UPGRADE_SUCCESS modifier 在 AFTER_DEFENCE_ROLL 解析出预期 payload
  - [ ] 近战专属金样（决斗家格挡）若近战 pipeline 未就绪，标注 `// TODO Story 1.7 补近战 pipeline 断言`，先用 effect 解析层断言占位
- [ ] **T7 — IP 与 rulesRef**（AC6）
  - [ ] 每个 effect 带 `rulesRef:{doc:"docs/rules/merged_kt_angels_of_death_zh.md", section:"<小节锚>"}`
  - [ ] 确认 `docs/rules/` 在 .gitignore（Story 1.1 已加）；本 story 不新增原文入仓
- [ ] **T8 — 单测**（AC1/AC2）
  - [ ] `tests/data/angels-pack.test.ts`：packLoader 加载死亡天使包通过；8 战团战术 effect 四问齐全；钢铁光环 policy=UNIQUE_PER_SOURCE + oncePerBattleId 存在；战斗条令 ATTACH_WEAPON_RULE rule 落点正确

## Dev Notes

### 架构合规

- **§2.4 effect 描述符**：8 战团战术 + 战斗条令全部走统一 effect 描述符，引擎不写 `if faction === 'angels'`（data-driven 核心，§2 开篇理由）。
- **§3.4 阵营接入点**：死亡天使战团战术接入一览——「8 条各为一 effect，挂 hit/defence/damage/APL 等不同 step；钢铁光环 = IGNORE_DAMAGE + oncePerBattle 计数（状态机追踪）」。
- **§2.3 武器规则标签→effect**：战斗条令的 `ATTACH_WEAPON_RULE(BALANCED)` 即「给武器临时附加一条武器规则」，与武器自带规则走同一套 modifier。
- **NFR-1 规则正确性（头号）**：数值必须忠实于规则源；任何算错=缺陷。golden test 是护栏（AR-3）。

### 关键约束

- **结构化无原文（D-29）**：只搬可计算数值（attacks/hit/damage/range/规则标签/effect 参数），绝不复制规则描述句。名称（爆矢手枪等）仅本地标识。
- **rulesetVersion="kt-lite-1.0"**：与 core.kt-lite（Story 1.2）同版本，packLoader 据此放行。
- **钢铁光环 oncePerBattle**：数据层只标 `oncePerBattleId` + policy=UNIQUE_PER_SOURCE；真正的「每战一次」计数在状态机（Story 1.9）。金样可通过注入「已用过」上下文断言二次不生效，不必等状态机。
- **golden 框架阵营无关**：Epic 2/3 复用，勿写死死亡天使假设。
- **依赖关系**：本 story 依赖 Story 1.2（schema/packLoader）与 Story 1.4（enforcer）；若并行开发，金样的 enforcer 断言层可先用 stub enforcer 占位，Completion Notes 标注。

### 数值来源（本地，不入库）

- `docs/rules/merged_kt_angels_of_death_zh.md`——死亡天使官方转 md（本地）。dev agent 读取取值，不复制原文入数据包或仓库。

### Project Structure Notes

- 数据包：`src/data/packs/angels_of_death.v1.json`
- 测试：`tests/golden/{framework.ts,fixtures.ts,angels-of-death.test.ts}` + `tests/data/angels-pack.test.ts`
- 与架构 §9 `data/packs/` + `tests/` 一致。

## References

- 架构 §2.1-2.4（数据包/effect 描述符）/ §3.1（step 接入点）/ §3.4（阵营接入一览，死亡天使段）— `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- 架构 AR-3（golden resolution tests 护栏）/ NFR-1（正确性头号）— 同上
- Epic 1 Story 1.3 — `planning-artifacts/epics.md`
- 规则源（本地不入库）：`docs/rules/merged_kt_angels_of_death_zh.md`
- 依赖：Story 1.1（脚手架/.gitignore）、Story 1.2（schema/packLoader）、Story 1.4（enforcer，金样断言层）

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
