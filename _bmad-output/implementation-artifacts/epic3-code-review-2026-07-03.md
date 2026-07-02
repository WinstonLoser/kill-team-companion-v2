# Epic 3 Code Review — 3.1 瘟疫 + 3.2 谓词库（2026-07-03）

三层对抗审查：Blind Hunter（仅 diff）/ Edge Case Hunter（diff+项目）/ Acceptance Auditor（diff+2 spec）。
Diff 源 `48beef6..HEAD`（6 文件，+487 行，引擎流水线零改动，新 predicates.ts 纯函数模块）。

## Patch（明确修复）

- **[P1][High] `plg_blight_grenade` 拼写悬空引用**：grenadier weaponRefs 用 `plg_blight_grenade`（有 i），weapon 定义为 `plg_blght_grenade`（缺 i），equipmentLimits 用 `plg_blght_grenade`。operative ref 指不到武器。统一为 `plg_blight_grenade`。
- **[P2][High] `rangeBucket` 空值误判**：`ctx.rangeInches` 缺省 Infinity → `BEYOND_6IN` 恒真（无距离数据仍触发）。改：rangeInches 缺省时 rangeBucket 恒 false（不静默触发）。
- **[P3][Med] 封闭护栏漏 predicate `op` 校验**：closure test 只查 kind/policy/trigger/step，未查 `condition.op ∈ PREDICATE_OPS`。typo 谓词静默 dead-effect。扩护栏：effect 若有 condition，其 op 须属枚举。
- **[P4][Med] golden #1 毒素时序措辞**：VIRULENT/TOXIN 引擎从不消费 →「剧毒不当次生效」断言 vacuously true（永不生效，非时序所致）。GRANT_MARKER @ AT_PIPELINE_END 时序是 real。改测试注释诚实归类：grant 时序 real，剧毒 +1 descriptor。
- **[P5][Med] AC6 缺「剧毒破灭」golden**：spec 列 9，实覆盖 8（plg_virulent_blight 无测试）。补 descriptor golden。
- **[P6][Low] golden SEQ 注释**：「4,5,3 普通×3」与数组 [4,5,2,3] 顺序不符（4,5,3 是命中值，2 是失败）。澄清。

## Defer（引擎扩展项，非数据/枚举缺口）
- **[W1][High] 恼人韧性「D6 4+ 每枚独立掷骨」未实现**：DAMAGE_MITIGATION 引擎按 count 减伤（每 effect −1），threshold/roll payload 从不读 → 恶心韧性 roll:"4+" vs fixed-1 同效。掷骰减伤 = pipeline 增强（每枚攻击骰 D6 + threshold 判定）。留引擎强化故事。
- **[W2][Med] CAP_PER_ATTACK_DIE + UNIQUE_PER_GROUP 不可兼得**：恼人韧性 spec 要「每枚独立(CAP) + 互斥(group)」，enforcer 一 effect 一 policy 限制下无法同时表达（同军团纳垢已记）。互斥部分 OK，每枚独立语义不表达。
- **[W3][Med] dieFaceEquals 谓词已落地但未接线**：无 effect 引用 condition，enforcer evalCondition 未注线 → 运行期 dead。接线（+ pipeline ctx dieFace）标独立任务（3.2 AC3(d) 已诚实标注）。
- **[W4][Med] 谓词门控 effect 全为 descriptor**：毒素激活伤/传染/腐烂诅咒/慈父祝福条件 等待 evalCondition 接线转 real。

## Dismiss
- **持徽手 apl:4 > 勇士 apl:3**（spec T2「持徽手 APL+1 走基础值」FR-2，3+1=4，intended；同军团）。
- **fathers_blessing AT_PIPELINE_END + MELEE_AFTER**（MELEE_AFTER 是近战尾步，HEAL 在 melee 消费；spec「近战/反击后」→ 近战，正确）。
- **evalPredicate 递归深度/malformed `{}`**（JSON 无环；`{}` → evalAtom(undefined)→default false，不崩）。
- **数据层 golden ≠ input→output**（spec 允许「缺口留 3.2」+ 测试注释已标注；接受）。

## 完成度真实性
3-1 AC2（毒素时序 golden vacuous 半）、AC3（掷骨/每枚独立未实现，仅互斥）、AC6（8/9 缺剧毒破灭）；3-2 AC3(d) 接线缺口诚实标注。P1-P6 + W1-W4 defer 后按实调整。

## Resolution（2026-07-03，全部修复）

0 decision-needed + 6 patch 全修：
- **P1** plg_blight_grenade 拼写悬空引用（weapon id/equipmentLimits 统一，验证 0 dangling ref）
- **P2** rangeBucket 缺省距离→false（不静默满足 BEYOND_*）+ 2 回归测试
- **P3** 封闭护栏 += condition.op ∈ PREDICATE_OPS 校验（3 pack，防 typo 谓词 dead-effect）
- **P4** golden #1 毒素时序注释诚实归类（grant 时序 real，剧毒+1 descriptor）
- **P5** 补「剧毒破灭」descriptor golden（AC6 8→9 覆盖）
- **P6** SEQ 注释澄清

**Defer（4，引擎扩展项）**：W1 恼人韧性掷骰/pipeline 增强 / W2 CAP+GROUP 不可兼得（一 effect 一 policy）/ W3 dieFaceEquals 接线（enforcer evalCondition）/ W4 谓词门控 effect 待接线转 real。
**Dismiss（4）**：持徽手 apl:4（spec intended）/ fathers_blessing MELEE_AFTER（近战尾步正确）/ evalPredicate 递归（JSON 无环）/ 数据层 golden（spec 允许 + 注释标注）。

最终：**215/215 测试绿**（+6：3 condition.op 护栏 + 2 rangeBucket/empty-args + 1 virulent_blight golden），build 绿（389.05 kB）。Story 3-1 + 3-2 → done。
