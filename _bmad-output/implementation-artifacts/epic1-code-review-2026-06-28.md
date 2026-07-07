# Epic 1 Code Review — 2026-06-28

范围：src/ + tests/（~2210 LOC，引擎核心 story 1.1-1.10 + 1.3）。三层并行（Blind Hunter / Edge Case Hunter / Acceptance Auditor）。

## 结论

引擎**能跑**（66 测试绿、build 通过、UI demo 接通），但评审发现 **7 处需决策的规格偏离**（简化低于 AC）+ **22 处明确 bug（可修）** + 若干低风险项。核心问题集中在：① 回放可复现契约（seed）② enforcer 可审计（被拒留痕）③ reducer 与 guard 解耦 ④ 近战格挡双重计数 ⑤ 几何咨询式 margin/flip 死代码。

## Decision-Needed（规格偏离，需你定：重构达 AC vs 接受简化延后）

- **DN1** pipeline 非 StepFn 注册表+游标（1.6 AC1/AC5 要 step 数组 + advance/pause/rollback）— 现为单函数 + 事后 log cursor
- **DN2** enforcer 仅 5 policy、CONDITIONAL 不求值（FR-7 要 R1-R12 + R2/R7 条件谓词 + R9 UNIQUE_PER_ACTION）
- **DN3** melee 非交替游标 + 出击/格挡子决策不入日志（1.7 AC2）
- **DN4** LOS center-to-center（1.8 AC2/架构 §4.2 要 头部→目标底座圆）
- **DN5** CAP_PER_ATTACK_DIE 实现为「每源总数」非「每枚攻击骰」（需 per-die 上下文，减伤应移到 DAMAGE_PER_DIE）
- **DN6** reducer 不调 guard（DO_ACTION/USE_PLOY 可执行非法行动/CP 扣负）— 架构：reducer 内嵌 guard vs 调用方先 guard
- **DN7** 几何咨询式 flip 未接线（validateTarget 不接受翻转、不写 rulings、无 finding store）

## Patch（明确 bug，可直修）

1. **DiceRoll 缺 seed** → 电子骰不可复现（FR-17/1.5 AC2）— `dice/source.ts`
2. **enforcer 丢被拒 modifier 无 RejectionTrace** + `rejectedEffectIds` 硬编码 `[]`（1.4 AC5/FR-17）— `enforcer.ts`,`pipeline.ts`,`melee.ts`
3. **melee parry 双重计数**：双方从全池互格挡，非对称场景重复计算（真 bug）— `melee.ts:123`
4. **parry 两份实现分歧**（pipeline vs melee 顺序不同）— `pipeline.ts:120`,`melee.ts:50`
5. **losFinding margin 死**（恒 ±1，AMBIGUOUS 永不触发，D-24 咨询式失效）— `geometry.ts:115`
6. **melee mitigation 单向**（dmgToAtk 不减伤）— `melee.ts:138`
7. **wounds=0 → 残废**（`woundsDealt>=wounds` 当 0>=0 为真）— `pipeline.ts:159`,`melee.ts:163`
8. **攻击方在 BLOCKING 内自身 LOS 被挡**（部署废墟常见）— `geometry.ts:90`
9. **退化 polygon（length<3）未拒** → 共线/水平边 NaN 误判 — `geometry.ts`
10. **CP 可负 + ployUses perTurningPoint 跨 TP 不重置** — `turnStateMachine.ts:180,188`
11. **turningPoint 无界 + BATTLE_END 非终态**（END 后仍可派 event 污染）— `turnStateMachine.ts:188`
12. **pipeline 不调几何**（TARGET_VALIDATE 占位字符串，非法目标直入流水线）— `pipeline.ts:48`
13. **validateTarget 缺「命令」+「控制范围内无己方」两条**（FR-10）— `geometry.ts:188`
14. **UPGRADE_SUCCESS 忽略 fromNatRoll + chapterTactic_relentless（近战）在射击触发**（trigger 不限 pipelineKind）— `pipeline.ts:73`
15. **HEAL_OPERATIVE target 联合不一致（`'SELF'|'target'`）+ heal 从未应用**（静默 no-op）— `types.ts:59`,`melee.ts:149`
16. **COVER_SAVE effect 被忽略**（掩护硬编码 +1，不读 extraNormal/攻城战专家取消）— `pipeline.ts:101`
17. **AUTO_SUCCESS count 未 clamp**（负值→负成功/负伤害）— `pipeline.ts:80`
18. **save 未 clamp + melee save 死参**（runMelee 全程不用 save）— `pipeline.ts:96`,`melee.ts`
19. **ResolveDemo defender 默认 = attacker（自射）+ `operatives[0]!` 非空断言** — `ResolveDemo.tsx:11`
20. **packLoader toIssues 丢 allowedValues** — `packLoader.ts:36`
21. **StepRecord 缺 inputs/output 快照**（回滚无法从快照恢复）— `context.ts:18`
22. **resolveStat 死代码**（pipeline 自建 modsOf 绕过 FR-2 两层模型）— `statResolver.ts`

## Defer（低风险/已认知简化）

- hashSeed charCodeAt 对中文碰撞（低概率）
- DiceRoll.grade 字段未消费（与 #1 一并）
- mitigation 按 -1 / UI 仅 demo / CP 双方+2（已知简化，记 D-24/故事）
- golden 框架未阵营无关化、金样仅 3 条（1.3 增强）

## Dismiss

- PIERCE 多源叠加 STACKABLE（正确，Blind 自撤）
- hashSeed FNV `>>>0`（正确，Blind 自撤）
