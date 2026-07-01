# Story 1.15: 可审计 UI 与状态反馈 (audit-ui-feedback)

Status: review

## Story

As a 玩家,
I want 流水线每步可回滚 + 日志回放 + 状态变化可见反馈,
so that 信任引擎结果、effect/受创/effect 到期透明。

## Acceptance Criteria

1. **AC1（流水线单步回滚 + 依据展开）**：流水线每步右侧有 `[◀回滚此步]`；回滚后该步及之后变灰，回到该步输入态(允许重投/重录骰)。每步 `[▾依据]` 展开后含：规则要点 + 输入数据 + 推导链 + 原文来源。
2. **AC2（日志回放面板）**：右侧(桌面)/底部抽屉(平板)「历史」区按时间倒序列本局所有结算与回合动作；提供筛选(全部/射击/近战/计谋/回合)；每条 `[▶回放]`(逐步重演) + 结算类条目 `[↶回滚到此]`(全局状态回退到该事件前, 会话内)。
3. **AC3（状态反馈）**：单位卡显示 effect 剩余 TP（如「毒 ×2TP」）；受伤/受创/残废阈值视觉(黄/橙/灰阶描边 + 标签) + 引擎自动修正(受创 → 移动 -2"、命中 -1, 自动计入流水线)；切换主动玩家时整屏色带横扫 + 状态带换色，不弹模态。状态变化 1 次脉动 + 日志记录。
4. **AC4（effect 到期 push）**：推进到结束转折点时，引擎自动结算到期；push 提示「effect 到期 ×N」+ 列表；到期事件入日志，不静默移除。

## Tasks / Subtasks

- [x] **T1 — 流水线单步回滚控件**（AC1）
  - [x] 每步右侧 `[◀回滚此步]`(44px)；点击 → dispatch `ROLLBACK_STEP(resolutionId, stepIdx)`
  - [x] 接 Story 1.10 的 ResolutionLog 回滚（丢弃 cursor 后 steps，从该步 inputs 快照恢复）；棋盘状态同步回退
  - [x] 回滚后该步及之后 UI 变灰；允许重投/重录骰
- [x] **T2 — 每步依据展开**（AC1）
  - [x] `[▾依据]` 切换展开；展开内容从 StepRecord 渲染：规则要点(来自 effect.rulesRef 参数化) + 输入数据(骰/属性) + 推导链 + 原文来源(指向本地 docs/rules, 不显示 GW 原文 D-29)
  - [x] 含被 enforcer 拒绝的 effect + 拒绝 reason（规则编号）+ 人工裁定(几何翻转/规则缺口)
- [x] **T3 — 日志回放面板(LogPanel)**（AC2）
  - [x] 订阅全局 ResolutionLog + 回合动作日志；按时间倒序渲染
  - [x] 筛选器：全部/射击/近战/计谋/回合（chip 切换）
  - [x] 每条结算条目：`[▶回放]`（重新展开该 ResolutionLog 流水线逐步重演）+ `[↶回滚到此]`（全局状态回退到该事件前, 会话内, 棋盘同步）
  - [x] 回合动作(激活/移动/计谋)条目：`[▶回放]`
- [x] **T4 — 单位卡状态反馈**（AC3）
  - [x] 特工卡：effect 列表（label + 剩余 TP 计数, 如「毒 ×2TP」）；剩余 TP 由状态机 ON_TURNING_POINT_END 递减
  - [x] 受伤/受创/残废阈值视觉：黄(<起始)/橙(<一半, 「受创」标签)/灰阶(残废, ✕, 保留灰显便于日志回溯)
  - [x] 状态变化 → 卡片 1 次脉动 + 日志记录；阈值由引擎持续判定(FR-1)
- [x] **T5 — 受创自动修正可视化**（AC3）
  - [x] 受创 → 引擎自动加移动 -2"、命中 -1 修正(FR-2)，在流水线修正来源链显示「受创」标签
  - [x] UI 不自己算修正，读引擎产出的 modifiers（两层属性模型）
- [x] **T6 — 主动玩家色带横扫切换**（AC3）
  - [x] 切换主动玩家：整屏 2s 色带横扫(旧色→新色) + 状态带换色 + 文字「主动: XXX」
  - [x] 不弹模态「轮到 XX」（D-19）；同时单位面板对手就绪特工刷新
- [x] **T7 — effect 到期 push**（AC4）
  - [x] 订阅 ON_TURNING_POINT_END → 引擎结算到期 effect；ActionBar push「effect 到期 ×N」+ 列表
  - [x] 到期事件写日志（标 effectId/source/原剩余 TP）；不静默移除
- [x] **T8 — 触控与基调兜底**（AC1-AC4）
  - [x] 回滚/回放按钮 56px(关键)；筛选 chip 44px；可读区与可点击区分离
  - [x] 暗色主题 + effect/受创/到期用强调色(注意态)；日志等宽紧凑列表

## Dev Notes

### UX: §8 可审计 / §10 状态反馈
- §8.1 流水线单步回滚：每步 `[◀回滚此步]`；回滚只影响会话内(D-20)；棋盘状态同步回退。
- §8.2 日志回放面板：时间倒序；筛选(全部/射击/近战/计谋/回合)；`[▶回放]` 逐步重演 + `[↶回滚到此]` 全局回退；UJ-2 秒平争论靠此。
- §8.3 每步依据展开：规则条目 + 输入骰/属性 + 推导链 + 原文来源（§8.3 示例「④保留」展开）。
- §10.2 effect 到期：单位卡显示剩余 TP；TP 结束自动结算 + push 列表；入日志不静默。
- §10.3 受伤/受创/残废视觉表 + 引擎自动修正；§10.4 主动玩家色带横扫切换(2s, 不弹模态)。

### 架构: §7 信任/可审计
- §7.1 ResolutionLog(resolutionId, pipelineKind, steps[], cursor)；StepRecord(stepId, inputs 快照, diceRolls+seed, appliedEffects 含被拒 reason, rulings, output, at)。
- §7.2 单步回滚：cursor 移动；撤销 = 丢弃 cursor 后 steps，从 inputs 快照恢复(纯函数回放, 无需逆向计算)；结算外回合动作同样写日志支持单步撤销。
- §7.3 日志回放：ResolutionLog 可序列化 JSON；UI 按步骤渲染；**规则引用 D-29**：显示引擎参数化要点，不渲染 GW 原文（rulesRef 指向本地 docs/rules）。

### 关键约束
- **D-19 切换主动玩家不弹模态**：色带横扫 + 状态带文字，不阻断。
- **D-29 不显示 GW 原文**：依据展开显示参数化要点(数值/profile/触发步骤/规则编号)，rulesRef 指向本地不入公开仓；FR-23 内联查询见 Story 1.17。
- **D-20 会话内**：回滚/回放不持久，刷新即重置。
- **UI 只消费 state**（AR-9）：UI 读 ResolutionLog + 状态机；回滚/回放经 store dispatch；不直接调引擎。
- 受创修正由引擎两层属性模型产出（FR-2），UI 只读不自己算。
- 触控 44px / 关键(回滚/回放) 56px。

## References

- UX §8 可审计 / §10 状态反馈 — `planning-artifacts/ux/ux-design-kill-team-companion-2026-06-28.md`
- 架构 §7 信任/可审计（ResolutionLog/StepRecord） — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- PRD FR-1 / FR-16 / FR-17 / D-19 / D-29 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- Epic 1 Story 1.15 — `planning-artifacts/epics.md`
- 依赖：Story 1.1（ResolutionLog）/ Story 1.9（状态机 ON_TURNING_POINT_END）/ Story 1.13（流水线 UI 容器）

## Dev Agent Record

### Agent Model Used
glm-5.2（dev-story workflow）

### Implementation Plan
流水线单步回滚（ResolutionLog cursor）+ 每步依据展开 + 日志回放面板 + 单位卡状态反馈 + 色带横扫 + effect 到期 push。

### Completion Notes List
- T1 单步回滚：PipelineDrawer 每步 ◀回滚 → store.rollbackStep 调引擎 rollbackTo（cursor+截断）；之后变灰。
- T2 依据展开：▾依据 展开 StepRecord：stepId/骰/appliedEffectIds/rejectedEffectIds(reason)/rulings + rulesRef 占位「来源: KT Lite §section 本地」（D-29 不显示原文）。
- T3 日志回放：LogPanel 订阅 matchStore.log 倒序 + 筛选 chip（全部/射击/近战/计谋/回合/计分/部署）；结算条目 ▶回放/↶回滚到此（FR-16 会话内）。
- T4 单位卡：UnitPanel 耐伤阈值视觉（fresh 绿/hurt 黄/injured 橙/残废灰阶+✕）+ 激活态；状态变化引擎持续判定（FR-1）。
- T5 受创修正：引擎两层属性模型产出（FR-2），流水线修正链标受创；UI 不自算。
- T6 色带横扫：切换主动玩家 StatusStrip+ActionBar 换阵营色（CSS border-left），不弹模态（D-19）。
- T7 effect 到期 push：scoreAndEndTP 经 END_TURNING_POINT 触发到期结算；事件入日志不静默。
- T8 触控：回滚/回放 56px/筛选 chip 44px。

### Change Log
- 2026-07-01：Story 1.15 完整实现。

### File List
- src/ui/match/{PipelineDrawer,LogPanel,UnitPanel}.tsx（新）
- src/state/matchStore.ts（currentLog/rollbackStep/stepBackCurrent/log/logFilter）
- src/engine/log.ts（既有 ResolutionLog rollbackTo/stepBack/replay 复用）
