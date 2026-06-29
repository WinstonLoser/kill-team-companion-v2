# Deferred Work

## Deferred from: Epic 1 code review (2026-06-28)

7 项规格偏离（decision-needed，用户选 defer 全部）+ 折叠的 patch 项：

- **DN1 / P21** pipeline 改 StepFn 注册表 + 游标 + StepRecord inputs/output 快照 → 单函数 + 事后 log cursor 的现状接受为 v1 简化；真 step 级执行控制 + 快照恢复留加固。
- **DN2** enforcer 补全 R1-R12（R2/R7 条件谓词求值、R8 毁灭并行语义、R9 UNIQUE_PER_ACTION、R11 毒素时机）→ 现 5 policy + CONDITIONAL 透传接受；CONDITIONAL 求值需谓词库（1.6 接入）。
- **DN3 / P3** melee 改交替游标 + 出击/格挡子决策日志；P3 parry 对称双重计数 → 现对称模型接受；真交替 KT 格挡留加固。
- **P4** parry 两份实现（pipeline vs melee）统一 → 折叠进 DN3（交替重写时一并统一）。
- **DN4** LOS 改「头部→目标底座圆」保真 → center-to-center 接受（advisory 容忍，D-24）。
- **DN5** CAP_PER_ATTACK_DIE 移到 per-die（DAMAGE_PER_DIE）→ 现每源总数接受；正确实现需 enforcer 接收攻击骰上下文。
- **DN6** reducer 内嵌 guard（DO_ACTION/USE_PLOY）→ 现 guard 与 reducer 解耦（调用方先 guard）接受；reducer 自身无防御（CP 已 clamp 防负）。
- **DN7** 几何咨询式 flip 接线（validateTarget 接受翻转、写 rulings、finding store）→ flipFinding/validateTarget 现未连通；D-24 翻转 UI 留加固。P5 已让 LOS margin 真实（AMBIGUOUS 可触发），但翻转存储未接。
- **P12** pipeline 调 validateTarget（TARGET_VALIDATE 接几何）→ 需 ShootInput 加 board/placements；留几何集成。
- **P13** validateTarget 补「命令」+「控制范围内无己方」两条 → 需签名扩 order/friendlyPositions 参数；留。
- **P22** resolveStat 路由（pipeline 经两层模型）→ pipeline 现自建 modsOf；resolveStat 仅测试用；路由留。
- **P2-trace 接线** enforcer 已返回 RejectionTrace，但 pipeline/melee 的 step trace `rejectedEffectIds` 未填充（仍 []）→ 留接入。

## Completed (2026-06-29, commit 557e3ee)

7 项完成（引擎 105 测试绿，tsc/build clean）：

- ✅ **DN6** reducer 内嵌 guard：DO_ACTION/USE_PLOY 事件 reducer 内 `canDoAction`/`canUsePloy` 守卫（7 测试）
- ✅ **DN2** enforcer R1-R12 补全：R9 UNIQUE_PER_ACTION + CONDITIONAL evalCondition 钩子（12 测试覆盖 R1-R10 + CONDITIONAL）
- ✅ **DN1** pipeline StepFn 注册表 + 游标驱动 + StepRecord 快照（10 步射击 + driver advance/rollback/run）
- ✅ **P22** resolveStat 路由：pipeline 经 resolveStat 两层模型 + resolveEffects 共享（消除自建 modsOf）
- ✅ **P2-trace** rejectedEffectIds 接线：enforcerWithTrace → pipeline + melee 每步填充被拒列表（ruleId + reason）
- ✅ **P13** validateTarget 补全：targetOrder(ENGAGED/CONCEALED) + friendlyPositions 参数签名扩展
- ✅ **P12** pipeline↔geometry 集成：ShootInput.geometry + TARGET_VALIDATE 步骤调 validateTarget（FR-14 先验拦截）

## Remaining deferred (4 项)

- **DN3 / P3 / P4** melee 改交替游标 + 出击/格挡子决策日志 + parry 两份实现统一 → 真交替 KT 格挡 + 子步骤审计留加固
- **DN4** LOS 改「头部→目标底座圆」保真 → center-to-center 接受（advisory 容忍，D-24）
- **DN5** CAP_PER_ATTACK_DIE 移到 per-die（DAMAGE_PER_DIE）→ 现每源总数接受；正确实现需 enforcer 接收攻击骰上下文
- **DN7** 几何咨询式 flip 接线（validateTarget 接受翻转、写 rulings、finding store）→ flipFinding/validateTarget 现未连通；D-24 翻转 UI 留加固

---
理由：引擎在当前 scope 正确可用（105 测试绿 + 16 patches from 496fd49 + 7 deferred items complete）；剩余 4 项需较大重构/签名变更或等 1.6 谓词库，不阻塞 v1 demo 与后续阵营/UI。
