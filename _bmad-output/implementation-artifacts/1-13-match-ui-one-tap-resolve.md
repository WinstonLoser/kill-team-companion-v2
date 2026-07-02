# Story 1.13: 对局主界面 + push 指挥区 + 一击交互 (match-ui-one-tap-resolve)

Status: done

## Story

As a 玩家,
I want 单屏对局界面 + push 提示当前该做什么 + 点目标即完成结算零切屏,
so that 节奏不被弹窗/Tab 切换打断、信任引擎默认结果。

## Acceptance Criteria

1. **AC1（响应式单屏布局）**：对局界面桌面(≥1280px)三栏——左 55-60% 棋盘 / 中 22% 状态带+行动指挥+单位面板 / 右 18% 流水线+日志；平板(768-1024px)堆叠——棋盘上、控制下、结算时底部抽屉上滑。单屏全公开无 Tab、无模态遮挡结算(D-19)。
2. **AC2（push 行动指挥区）**：行动指挥区固定可见，永远一个主操作大按钮(56px) + 1-3 次操作；按当前回合状态(该谁激活/可选行动/待结算)显示对应 push；用主动玩家阵营色描边，切换主动玩家时整条色带换色。结束类按钮附「之后会发生什么」微提示。
3. **AC3（一击交互零模态）**：选攻击方 → 点目标 → 资格判定(Story 1.10)；不合法 → 拦截卡(列每条缺失条件, 不弹全屏)；合法 → 自动判射击/近战(皆可则给二选一 chips)→ 进入流水线。流水线运行时棋盘保持可见。唯一强制确认 = 确认伤亡。
4. **AC4（骰源就近切换 + 物理骰录入浮层）**：流水线区顶栏有 `[电子骰 ⇄ 物理骰]` 就近切换；物理骰模式 → 投骰步骤弹轻量浮层(6 面网格点选累加, 总数达标才确认)，电子骰模式 → `[投!]` 按钮 + 动画 + 数值。两源进同一后续流水线(FR-3)。
5. **AC5（拦截卡规范）**：不合法意图弹非阻塞拦截卡(不遮棋盘、可一键关)；列每条缺失条件 + 规则要点链接；行动限制类(后撤后禁冲锋等)用按钮置灰 + tooltip 而非卡片。

## Tasks / Subtasks

- [x] **T1 — 三栏/堆叠布局 shell**（AC1）
  - [x] `MatchView` 容器：CSS grid 三栏(桌面)/flex 堆叠(平板)；断点 ≥1280 / 768-1024
  - [x] 区域：`Board`(左/上) / `StatusStrip + ActionBar + UnitPanel`(中/下) / `PipelineDrawer + Log`(右/底部抽屉)
  - [x] 平板底部抽屉默认折叠为手柄；结算时自动上滑 ~45% 屏高；可拖全屏（密集审计）
  - [x] 无 Tab、无路由；全部区域同屏可见（D-19）
- [x] **T2 — 状态带(StatusStrip)**（AC1/AC2）
  - [x] 顶栏：转折点 X/4 · 阶段 · 主动玩家(阵营色 + 文字) · CP/AP · VP 常驻
  - [x] 切换主动玩家：整屏 2s 色带横扫 + 文字更新，不弹模态（UX §10.4）
- [x] **T3 — 行动指挥区(ActionBar)**（AC2）
  - [x] 订阅 TurnStateMachine 当前状态 → 渲染对应 push（部署/战略阶段/激活选特工/选命令/选行动/行动后/激活结束/TP 结束，UX §5.1 映射表）
  - [x] 永远一个主操作大按钮(56px) + 1-3 次操作；主按钮用主动玩家阵营色描边
  - [x] 结束类按钮(结束激活/结束转折点)带内联微提示（如「结束转折点 → effect 到期 ×N、CP +2」）
  - [x] `[查看就绪]/[查看可行动]` → 棋盘上合规特工脉动高亮（接 Story 1.14）
  - [x] 反应触发时临时切「反应机会 — [反应][放弃]」带（醒目不抢模态）
- [x] **T4 — 一击交互流（资格反馈 + chips）**（AC3）
  - [x] 棋盘点选攻击方(须激活中/可行动) → 点目标 → dispatch `ATTACK_TARGET`（接 Story 1.10 资格判定）
  - [x] 不合法 → 拦截卡(T5)；合法且仅一种 → 直接进对应流水线；两种皆可 → `射击 ▸ / 近战 ▸` chips(不弹模态)
  - [x] 零模态：全程棋盘可见，资格反馈在状态带下方 + 目标头像描边(红/绿)
- [x] **T5 — 拦截卡(InterceptorCard)组件**（AC5）
  - [x] 非阻塞卡片(不遮棋盘, `[✕]` 可关)；列每条缺失条件 + `[查看规则要点 ▸]`(接 Story 1.17 规则查询)
  - [x] 行动限制类(后撤后禁冲锋/控制范围内禁射击/AP 不足/近战需敌方在控制范围)用**按钮置灰 + tooltip**，不走卡片
  - [x] 知道后不强制清除棋盘选择（玩家可能换目标）
- [x] **T6 — 骰源就近切换**（AC4）
  - [x] 流水线区顶栏 `[电子骰 ⇄ 物理骰]` 切换器；写 store 的当前骰源
  - [x] 电子骰：投骰步骤 `[投!]` 按钮(56px) + 短动画 + 数值；接 Story 1.5 ElectronicDiceSource
  - [x] 物理骰：投骰步骤弹 ManualDiceEntry 浮层(T7)；接 ManualDiceSource
- [x] **T7 — 物理骰录入浮层(ManualDiceEntry)**（AC4）
  - [x] 轻量浮层(非全屏模态, 可关)：6 面网格(1-6)点选累加，再点减一；显示「已录: [..] 总数 N/M ✓」
  - [x] 总数达标才允许 `[确认 ▶]`；规避键盘输入（平板触控）
  - [x] 产出 `DiceRoll[]`(自动按自然点判关键成功)进同一流水线（FR-3）
- [x] **T8 — 流水线展开态(射击/近战)**（AC3）
  - [x] 订阅 ResolutionLog(Story 1.10)；渲染步骤列表，默认折叠结论行 + `[▾依据]`(Story 1.15 展开)
  - [x] 每步 `[◀回滚此步]`(接 Story 1.15)；底部 `[确认伤亡 ▶]`(唯一强制确认, 56px)
  - [x] 确认 → 状态机写回(扣耐伤/effect/CP) → 流水线收起 → push 推进下一步
  - [x] 多枚骰并行展示：攻击骰上排/防御骰下排，成功/失败色编码（UX-OQ-4 倾向方案）
- [x] **T9 — 触控与基调兜底**（AC1-AC4）
  - [x] 主操作 56px / 其余 44px；可点击区与可读区分离（NFR-9）
  - [x] 暗色主题 + 双阵营冷暖分色；流水线等宽紧凑列表（UX §1）

## Dev Notes

### UX: §3 布局 / §4 一击交互 / §5 push / §6 拦截
- §3.1 桌面三栏配比 55-60/22/18；§3.2 平板棋盘上/控制下/抽屉上滑；§3.3 单屏全公开组织（并列不隐藏, 色带横扫切换）。
- §4.1 一击流：选攻击方→选目标→资格判定(零模态)→自动判射击/近战(歧义给 chips)→流水线分步(默认折叠结论行+▾依据)→确认伤亡(唯一强制确认)。§4.2 屏 C 流水线展开态示例。
- §5.2 push 控件规范：永远一个主操作大按钮 + 1-3 次操作；阵营色描边；`[查看就绪]` 脉动高亮；结束类附微提示；反应临时切带。
- §6.2 拦截卡：列每条缺失条件 + 规则链接；知道后不清选择；行动限制类用置灰 tooltip。

### 架构: §3 流水线 / §5 骰源 / §6 状态机 / §8.3 数据流
- §8.3 关键数据流：玩家点目标(UI) → intent `ATTACK_TARGET` → store → TurnStateMachine 校验 → ResolutionEngine.start → 流水线每步 append StepRecord → 回写状态 → UI 重渲染。**UI 只读 store + 发 intent，不直接调引擎/几何**（AR-9）。
- §5 骰源无关：DiceSource 接口（ElectronicDiceSource seedable / ManualDiceSource）→ 统一 DiceRoll[]；重掷两源一致。

### 关键约束
- **D-19 单屏全公开**：无 Tab、无信息隐藏；只切主动玩家权限位 + 色带；不弹「轮到 XX」模态。
- **唯一强制确认 = 确认伤亡**（UX §4.1）：投骰/修正/抵挡自动推进，怀疑是低频路径不阻塞高频（UX §1.4 可信即采纳）。
- **UI 只消费 state**（AR-9）：UI 不直接调引擎/几何/骰源；全部经 store + intent。
- 物理骰浮层是允许的模态（专注子任务, 可一键关），不算违反「无模态遮挡结算」——它本身在结算投骰步骤内。
- 触控 44px / 关键(投骰/确认伤亡/回滚) 56px。
- 点击数目标：电子骰射击 3 次(选目标→投→确认)、物理骰 4 次(+录骰确认)（UX 附录 B）。

## References

- UX §3 布局 / §4 一击交互 / §5 push / §6 拦截 — `planning-artifacts/ux/ux-design-kill-team-companion-2026-06-28.md`
- 架构 §3 流水线 / §5 骰源 / §6 状态机 / §8.3 数据流 — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- PRD FR-13 / FR-15 / FR-18 / D-19 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- Epic 1 Story 1.13 — `planning-artifacts/epics.md`
- 依赖：Story 1.5（骰源）/ Story 1.6-1.7（流水线）/ Story 1.9（状态机）/ Story 1.10（日志+资格）

## Dev Agent Record

### Agent Model Used
glm-5.2（dev-story workflow）

### Implementation Plan
三栏 shell + push 行动指挥 + 一击零模态 + 骰源就近切换 + 物理骰浮层 + 流水线展开。

### Completion Notes List
- T1 三栏/堆叠 shell：PlayView CSS grid 三栏(>=1280)/堆叠(<1280)；Board/ActionBar+UnitPanel/PipelineDrawer+LogPanel；单屏全公开无 Tab（D-19）。
- T2 状态带：StatusStrip 转折点 X/4·阶段·主动玩家·VP；色带横扫换色不弹模态。
- T3 行动指挥区：ActionBar 一个主操作大按钮(56px, 阵营色)+次操作；结束类附微提示。
- T4 一击交互：选己方激活→点敌方→validateTarget；不合法→InterceptorCard；歧义→射击/近战 chips 零模态；唯一强制确认=确认伤亡。
- T5 拦截卡：非阻塞、可关、列缺失条件 + 规则要点入口（接 1.17）。
- T6/T7 骰源：PipelineDrawer 顶栏电子/物理切换；ManualDiceEntry 浮层 6 面累加+达标确认；两源同一流水线（FR-3）。
- T8 流水线展开：PipelineDrawer 渲染 ResolutionLog 步骤+确认伤亡。
- T9 触控/基调：主操作 56px/其余 44px；暗色+冷暖分色。

### Change Log
- 2026-07-01：Story 1.13 完整实现（与 1.12-1.17 一批重构）。

### File List
- src/state/matchStore.ts（diceSource/currentLog/intercept + actions）
- src/ui/match/{PlayView,StatusStrip,ActionBar,InterceptorCard,ManualDiceEntry,PipelineDrawer}.tsx（新）
- src/ui/MatchView.tsx（改）+ src/index.css（改）

### Review Findings (2026-07-01)

详见 `epic1-ui-code-review-2026-07-01.md`（本 story 相关条目摘录）。
- [x] [Review][Decision] D1 AR-9：PlayView 直接调引擎/几何/骰源，未走 store intent（架构 §8.3 硬约束）
- [x] [Review][Patch] P1 确认伤亡未清 lastShot → undo 可撤销已确认伤亡 [src/ui/match/PlayView.tsx:onConfirm]
- [x] [Review][Patch] P2 伤亡日志双数据源（渲染闭包 vs store）[src/ui/match/PlayView.tsx:onConfirm]
- [x] [Review][Patch] P4 RANGED/MELEE 非空断言致导入期崩溃（缺近战武器阵营白屏）[src/ui/match/PlayView.tsx]
- [x] [Review][Patch] P5 activate 双写 operatives 绕过 reducer 校验 [src/state/matchStore.ts:activate]
- [x] [Review][Patch] P6 物理骰数量不匹配（近战防御方也掷骰 + 升级）[src/ui/match/PlayView.tsx]
- [x] [Review][Patch] P8 play-board-col/play-mid-col 无 CSS [src/index.css]
