# Epic 1 UI Code Review — 1.11-1.17（2026-07-01）

三层对抗审查：Blind Hunter（仅 diff）/ Edge Case Hunter（diff+项目）/ Acceptance Auditor（diff+7 spec）。
Diff 源 `114592c..HEAD`（src/+tests/，+2734/−341，37 文件）。

> 注：审查期间引擎已并 DN7（`validateTarget` 支持 `findingOverrides` + `FindingStore`），使「翻转未回算资格」从架构缺口降为接线 patch。

## Decision-Needed（须用户定夺，先于 patch）

- **[D1][Critical] AR-9 架构违背**（1.13/1.14）：`PlayView` 直接 `import { runShooting, runMelee, losFinding, coverFinding, engagementFinding, validateTarget, ElectronicDiceSource, ManualDiceSource }` 并在组件内结算，未走 store intent → 引擎 → ResolutionLog。违背架构 §8.3 与 AR-9（每 story 重申硬约束）。store 仅收事后结果。
  - 选项：A 现在大重构为 intent 驱动（大）；B 接受 v1 在视图层结算、记录为已知技术债留 Epic 4；C 折中（抽 `resolveAttack()` 到 store action，UI 只 dispatch）。
- **[D2][Med] 1.12 画地形缺件**（AC2）：缺 复制/镜像 工具、独立「放目标点/降落区」按钮、困难地形 flag。现空白板硬编码 1 目标点 + 三分降落区，玩家无法自建目标点。
  - 选项：A 现在补全编辑器；B defer 到 Epic 4 打磨。
- **[D3][Med] 1.15 单步回滚只回滚日志、不同步棋盘**（AC1/§7.2）：`rollbackStep` 截断 ResolutionLog，但 token 耐伤/状态不从快照恢复；`onReplay` 空实现、`onRollbackToHere` 恒为 `undoLastShot`。
  - 选项：A 建快照恢复机制；B defer（标已知缺口）。
- **[D4][High] 1.15 effect 到期 push + 单位卡 effect 列表**（AC3/AC4）：`scoreAndEndTP` 不结算/不记 effect 到期；单位卡无 effect 剩余 TP。match UI 完全未建模 effect。
  - 选项：A 建 effect 追踪（大）；B defer。

## Patch（明确修复，15）

### High
- **[P1] 确认伤亡未清 lastShot → undo 可撤销已确认伤亡**（1.13）`src/ui/match/PlayView.tsx:onConfirm` 未 `setLastShot(null)`；`hasLastShot` 仍真，回滚可静默还原玩家刚确认的伤亡，且无日志。修：confirm 后清 lastShot。
- **[P2] 伤亡日志双数据源**（1.13）`onConfirm` 用渲染闭包 `t.wounds` 算 `nw` 写日志，`applyDamage` 另从 store 算 → 「剩 N」可能与实际不符。修：以 store 应用后的值为准。
- **[P3] 几何翻转未回算资格**（1.14，D-24）`FindingStrip` toggle overrides，但 `startAttack`/`resolveShoot` 的 `validateTarget`/`losFinding` 未传 `findingOverrides`。引擎现已支持 → 接线：把 store overrides 转 `findingOverrides` 注入。

### Med
- **[P4] RANGED/MELEE 非空断言致导入期崩溃**（1.13）`pack.weapons.find(...)!` 模块加载即抛，缺近战武器的阵营会白屏。修：guard + 友好降级。
- **[P5] activate 双写/竞态**（1.13）`matchStore.activate` 先手填 operatives 再 dispatch `ACTIVATE`，绕过 reducer 校验、可能产生孤儿条目。修：只 dispatch，让 reducer 拥有 operatives。
- **[P6] 物理骰数量不匹配**（1.13）收集 `attacks*2`，但近战防御方也掷骰 + 可能关键伤升级，引擎实耗更多 → `ManualDiceSource` 供不上。修：按实际消耗算 needed，或分攻击/防御两段录入。
- **[P10] 规则查询两套实现**（1.17）顶栏「规则查询」切到 `App.tsx` 内硬编码列表视图，而非 `RulesQuery` 浮层；浮层仅 match 内可达。修：统一为浮层。
- **[P11] TP 结束无 VP push 文案**（1.16）`scoreAndEndTP` 只写日志，无 ActionBar push「TP 结束 — A 控制 N 点，VP +N」。修：emit push。

### Low
- **[P7] controlOf 闭包陈旧**（1.16）`controlOf` 捕获渲染 tokens，scoreAndEndTP 用其计分而非 store 当下 tokens。修：在 store 内或读 `get().tokens`。
- **[P8] play-board-col/play-mid-col 无 CSS**（1.13）`index.css` 只定义 `.play-main`/`.play-right-col`。修：补或移除类名。
- **[P9] loadMapPack 校验不全**（1.12）未校验 `bounds.w/h>0`、polygon≥3 点，违背 NFR-5「绝不静默降级」声明。修：补校验。
- **[P12] 目标点 hover tooltip 未渲染**（1.16）`onObjectiveHover` 接线但无 tooltip 元素显「控制方 + 双方数量」。修：渲染。
- **[P13] 建队违规未链到违规特工**（1.11 AC3）`LegalityPanel` 仅文字 detail，无可点跳转。修：加 onClick 定位特工卡。
- **[P14] 入队默认勾全部 weaponRefs 可立即违装备限**（1.11）`OperativePicker.toggleOp` 入队即全选武器，可能超 `equipmentLimits`。修：默认选首件或不选。
- **[P15] 缺横屏提示**（1.17 UX-OQ-7）竖屏无「请横屏」。修：加提示。

## Defer（预存/设计如此，2）
- **[W1] logId 模块级可变计数器**，`reset()` 不重置 → 测试/HMR 共享、跨刷新不确定。低。
- **[W2] 再开一局 reload 丢 roster**（1.16）— D-20 刷新重置即如此；store 有 `reset()` 可保 roster 但未用。低。

## Dismiss（1）
- **组件库**（1.17 T1）：手写 CSS token 而非 shadcn/Radix。**D-31 美学后置**明确允许，dismiss。

## 完成度真实性
多个 task `[x]` 与实际不符：1.12 AC2（编辑器缺件）、1.14 AC3（翻转未回算）、1.15 AC4（effect 到期未做）、1.17 T3（顶栏非浮层）。D1-D4 决策后，对应 `[x]` 应按「defer 则改为 [ ] + Defer 标注」「补做则保留」。

## Resolution（2026-07-01，全部修复）

4 决策全选最完整方案 + 15 patch 全修 + 1.14 AC2 几何可视化补全，分 6 commit：
- `19eaf39` Batch 1：AR-9 intent 驱动结算（matchStore.resolveAttack/confirmCasualties）+ P1/P2/P3/P5 + P4 guard + reducer ACTIVATE 自包含
- `095f01a` Batch 2：D4 effect 系统（activeEffects/addEffect/tickEffects + 到期 push + 单位卡 effect 列表）+ 4 单测
- `3b5e640` Batch 3：D3 快照回退（snapshots/rewindToSnapshot + replayLog/replayLast）+ LogPanel ▶回放/↶回滚到此 + 3 单测
- `2e24b84` Batch 4：D2 地形编辑器补全（复制/镜像/目标点/降落区/困难地形 + draft commit）
- `fcc2353` Batch 5：P7-P15（controlOf 入 store / play-cols CSS / loadMapPack 校验 / 规则查询统一 / VP push / 目标点 tooltip / 违规定位 / 入队默认空装备 / 横屏提示）
- `6d46934` 1.14 AC2：1" 控制圈 + 自身掩护染色 + 遮挡轮廓

**Defer（2，低）**：W1 logId 模块级计数器；W2 再开一局 reload 丢 roster（D-20 设计）。
**Dismiss（1）**：组件库（D-31 美学后置允许手写 CSS）。

最终：159/159 测试绿（+7 新单测：effect 4 + snapshot 3），build 绿（387.77 kB）。Story 1.11-1.17 状态 → done。
