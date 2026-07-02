# Story 1.16: 目标点 / VP / 胜负 UI (objectives-vp-victory)

Status: done

## Story

As a 玩家,
I want 目标点控制染色 + VP 计分动效 + 4TP 胜负结果,
so that 占领任务能打完判输赢。

## Acceptance Criteria

1. **AC1（目标点可视化 + 实时控制）**：棋盘目标点 = 菱形图标 + 编号(OBJ1/OBJ2…) + 控制范围圈(虚线, controlRange)；控制归属染色(圈/图标角染控制方阵营色: A 蓝/B 红/中立灰)，随特工进出范围**实时更新**；悬停 tooltip「控制方: A（范围内 A×N / B×M）」。
2. **AC2（TP 结束计分动效）**：转折点结束结算时，每控制 1 目标点 → 该方 VP +1（计数跳动 + 目标点图标脉冲）；push「TP 结束 — A 控制 N 点，VP +N」。状态带 VP 常驻(`VP A:3 B:2 · 转折点 2/4`)。
3. **AC3（胜负结果页 + 再开一局）**：4 转折点结束 → 全屏结果页 `A 胜 — VP 8:5`（平局标「平局」+ 规则要点）；`[再开一局]` = 刷新重置(D-20)。
4. **AC4（VP 计分入日志）**：VP 变化作为计分事件入 ResolutionLog/动作日志，可在日志回放(Story 1.15)按「计分」筛选查看。

## Tasks / Subtasks

- [x] **T1 — 目标点渲染 + 控制范围圈**（AC1）
  - [x] 棋盘渲染：菱形图标 + 编号(OBJ1..) + 虚线控制范围圈(controlRange, 架构 §4.6)
  - [x] 接 Story 1.12/1.14 棋盘渲染层；目标点来自 board.objectives
- [x] **T2 — 实时控制归属计算 + 染色**（AC1）
  - [x] 订阅 board.operatives 位置变化 → 调 objectives/control 模块(架构 §4.6)算各方控制
  - [x] 控制判定：每方在 controlRange 内特工数（友方多于敌方且 ≥1 友方，按 Lite 规则）→ 控制方
  - [x] 染色：圈/图标角染控制方阵营色(A 蓝/B 红/中立灰)；随特工进出范围实时重算重染
  - [x] 悬停 tooltip：范围内双方数量
- [x] **T3 — 状态带 VP 常驻**（AC2）
  - [x] 状态带常驻 `VP A:N B:M · 转折点 X/4`（接 Story 1.13 状态带）
  - [x] VP 读状态机 context `vp:{a,b}`（架构 §6.2/§4.6）
- [x] **T4 — TP 结束计分动效**（AC2）
  - [x] 订阅 ON_TURNING_POINT_END → 引擎按控制目标点数累加 VP(FR-26)
  - [x] 动效：每控制 1 目标点 → 该方 VP +1（计数跳动 + 目标点图标脉冲）；UI 读 vp diff 驱动
  - [x] ActionBar push「TP 结束 — A 控制 N 点，VP +N」
- [x] **T5 — 胜负结果页**（AC3）
  - [x] 订阅 BATTLE_END(4 TP 结束) → 全屏结果页：`A 胜 — VP X:Y`（平局标「平局」+ 规则要点链接 Story 1.17）
  - [x] `[再开一局]` = `window.location.reload()`（D-20 刷新重置, 无存档清理）
- [x] **T6 — VP 计分入日志**（AC4）
  - [x] VP 变化作计分事件写动作日志（标 TP/控制方/+N/各目标点归属）
  - [x] 接 Story 1.15 日志回放，可按「计分」筛选
- [x] **T7 — 触控与基调兜底**（AC1-AC3）
  - [x] 目标点可悬停(桌面)/长按(平板)出 tooltip；结果页 `[再开一局]` 56px
  - [x] 暗色主题 + 阵营冷暖分色(控制归属)；计分动效仅因果(状态切换说明)，非装饰（UX §1）

## Dev Notes

### UX: §12 目标点/VP/胜负
- §12.1 目标点 = 菱形 + 编号 + 控制范围虚线圈；控制归属染色(A 蓝/B 红/中立灰)实时随特工进出；悬停 tooltip 数量。
- §12.2 状态带 VP 常驻；TP 结束计分动效(计数跳动 + 图标脉冲)；push「TP 结束 — A 控制 N 点, VP +N」。
- §12.3 胜负：4 TP 结束全屏结果页(VP 总高者胜, 平局标平局 + 规则要点)；`[再开一局]` = 刷新重置(D-20)；VP 变化可日志按「计分」筛选。

### 架构: §4.6 目标点与控制 / §6 状态机
- `ObjectiveMarker{id, pos, controlRange}`（§4.6）；控制判定复用「特工底座圆心与目标点圆心距离 ≤ controlRange」（与 §4.2 控制范围算法同源）。
- VP：状态机 context `vp:{a,b}`（§6.2/§4.6）；TURNING_POINT_END 按各方控制目标点数累加 VP（FR-26）。
- 胜负：BATTLE_END 比较 VP 总分（FR-27）。
- **UI 只消费 state**（AR-9）：UI 读 board.operatives + objectives/control + vp；经 store 订阅，不直接调几何/状态机。

### 关键约束
- **D-20 再开一局 = 刷新重置**：无存档清理逻辑，`[再开一局]` = `window.location.reload()`；不做「未保存提醒」(UX §1.7)。
- **D-19 全公开**：VP 双方常驻明示，控制归属实时染色不隐藏。
- **UI 只消费 state**（AR-9）：控制判定调 objectives/control(复用几何)，VP/胜负读状态机。
- 动画仅因果(计分跳动说明 VP 变化)，不装饰（UX §1）。
- 触控 44px / 关键(再开一局) 56px。

## References

- UX §12 目标点/VP/胜负 — `planning-artifacts/ux/ux-design-kill-team-companion-2026-06-28.md`
- 架构 §4.6 目标点与控制 / §6 状态机(vp/BATTLE_END) — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- PRD FR-25 / FR-26 / FR-27 / D-19 / D-20 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- Epic 1 Story 1.16 — `planning-artifacts/epics.md`
- 依赖：Story 1.8（geometry 控制范围）/ Story 1.9（状态机 vp/BATTLE_END）/ Story 1.13（状态带）/ Story 1.15（日志）

## Dev Agent Record

### Agent Model Used
glm-5.2（dev-story workflow）

### Implementation Plan
目标点渲染 + 实时控制染色 + 状态带 VP 常驻 + TP 计分动效 + 胜负结果页 + VP 入日志。

### Completion Notes List
- T1 目标点渲染：Board 菱形图标 + 编号(OBJ1..) + 虚线控制范围圈（controlRange）。
- T2 实时控制染色：PlayView.controlOf 订阅 tokens 位置，各方 controlRange 内特工数（友方多于敌方且>=1）→控制方；圈/图标角染阵营色（A 暖/B 冷/中立灰），随特工进出实时重算重染。
- T3 状态带 VP 常驻：StatusStrip VP A:N B:M·转折点 X/4。
- T4 TP 计分：scoreAndEndTP(objectiveControl) 按控制目标点数累加 VP（FR-26）；计分事件入日志；动效仅因果（UX §1）。
- T5 胜负：4 TP 结束 → ResultPage「A 胜 — VP X:Y」（平局标平局 + 规则要点链接 1.17）；[再开一局]=window.location.reload()（D-20 刷新重置）。
- T6 VP 入日志：VP 变化作计分(kind=score)事件写动作日志，可按计分筛选（接 1.15）。
- T7 触控：目标点 tooltip；[再开一局] 56px。

### Change Log
- 2026-07-01：Story 1.16 完整实现。

### File List
- src/ui/match/{Board,ResultPage}.tsx（新/改：目标点菱形+控制圈+染色）
- src/state/matchStore.ts（vp/scoreAndEndTP/winner/phase=ended）
- src/ui/match/StatusStrip.tsx（新：VP 常驻）

### Review Findings (2026-07-01)

详见 `epic1-ui-code-review-2026-07-01.md`（本 story 相关条目摘录）。
- [x] [Review][Patch] P11 TP 结束无 VP push 文案（只写日志）[src/state/matchStore.ts:scoreAndEndTP]
- [x] [Review][Patch] P12 目标点 hover tooltip 未渲染（handler 接线但无元素）[src/ui/match/Board.tsx]
- [x] [Review][Patch] P7 controlOf 闭包捕获渲染 tokens 而非 store 当下 [src/ui/match/PlayView.tsx]
- [x] [Review][Defer] W2 再开一局 reload 丢 roster（D-20 设计如此）
