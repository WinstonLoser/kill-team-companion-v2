# Story 4.1: 平板手势与几何渲染性能 (tablet-gestures-perf)

Status: in-progress

## Story

As a 玩家（平板 pass-and-play 场景）,
I want 平板手势不冲突（双指缩放/平移 vs 单指拖特工）且密集棋盘实时几何渲染流畅,
so that 桌上触控体验好、LOS/射程/控制圈不卡顿（NFR-3 + UX-OQ-2/9）。

## Acceptance Criteria

1. **AC1（手势优先级，UX-OQ-2）**：平板棋盘上双指缩放/平移 与 单指拖特工/画地形的手势优先级明确——双指一旦识别（≥2 触点 + 移动阈值）即接管为视口变换，单指保留为操作；无误触（拖特工时不会意外缩放，缩放时不会误移特工）。
2. **AC2（拖动/点击阈值）**：单指按下后移动 < 阈值（约 4-6px / ~0.05"）判定为点击（选中），≥ 阈值判定为拖动；阈值可调，避免微动误判为拖动。
3. **AC3（密集板渲染帧率，UX-OQ-9/NFR-3）**：在密集棋盘（满 14 特工 + 几十地形多边形 + 全部 LOS/射程/控制圈可视化开启）下，实时交互（拖特工/平移/缩放）帧率 ≥ 30fps（平板目标 768-1024+ 分辨率），桌面 ≥ 60fps。
4. **AC4（按需降级）**：当帧率掉阈以下时自动降级——(a) 拖动/缩放期间只渲底图 + 拖动元素，几何 overlay（LOS 射线/射程环/控制圈）延迟到操作结束再算；(b) 或按需显示（仅选中特工时画其 overlay，非全局）；降级与恢复静默无闪烁。
5. **AC5（无回归）**：桌面键鼠交互（Story 1.14 已实现）行为不变；所有 Epic 1-3 的几何/结算金样与 e2e 不回归。

## Tasks / Subtasks

- [ ] **T1 — 手势识别层**（AC1/AC2）
  - [ ] 在 `src/ui/Board/` 加手势状态机（pointer events 统一处理 touch/mouse/pen）：`IDLE → TOUCH_START → {SINGLE_DRAG | PINCH_ZOOM | PAN}`
  - [ ] 双指检测：`touchstart` ≥2 触点 + 移动距离超阈值 → 进 PINCH_ZOOM/PAN，取消任何 single_drag 进行中的操作（如特工拖动回滚到按下点）
  - [ ] 单指拖动阈值：`pointerdown` 后 track 移动距离，<阈值（5px）=点击选中，≥阈值=拖动开始
  - [ ] 阈值常量化（`GESTURE:{dragThreshold:5, pinchThreshold:8}`），便于调参
- [ ] **T2 — 视口变换（缩放/平移）**（AC1）
  - [ ] 棋盘画布维护 `viewport:{scale, offsetX, offsetY}`；双指手势映射到 scale/offset
  - [ ] 缩放以双指中点为锚点（pinch center），避免跳变
  - [ ] 平移=双指同向移动；与单指拖特工互斥（手势状态机保证）
  - [ ] 桌面：滚轮缩放 + 中键/右键平移（键鼠等价，不破坏 1.14）
- [ ] **T3 — 渲染优化基线测量**（AC3）
  - [ ] 用 Chrome DevTools Performance（或 `requestAnimationFrame` 帧时间打点）测密集板基线：满特工 + 全 overlay 开启下的帧时间
  - [ ] 记录瓶颈点（多边形相交 / canvas 重绘 / React 重渲染），决定优化方向
- [ ] **T4 — 几何 overlay 按需/延迟计算**（AC4）
  - [ ] LOS/射程/控制圈改为：(a) 仅选中攻击方 + 悬停目标时画对应 overlay（非全局常驻）；(b) 拖动/缩放期间 overlay 暂停计算，操作结束（`pointerup`/`wheelend`）后重算
  - [ ] 用 `requestIdleCallback` 或 debounce（~50ms）延迟几何重算
  - [ ] 降级阈值：帧时间 > 33ms（<30fps）触发降级；恢复 < 22ms（>45fps）解除——hysteresis 防抖动
- [ ] **T5 — 渲染层优化（按 T3 瓶颈选做）**（AC3）
  - [ ] canvas 分层：静态层（地形/目标点）+ 动态层（特工/overlay），静态层缓存不每帧重画
  - [ ] 几何计算结果 memoize（同一帧内 LOS/掩护不变则复用）；特工拖动时仅重算受影响 overlay
  - [ ] React 重渲染：特工位置用 Zustand selector 订阅，避免全局重渲；canvas 用 ref 直接绘制不进 React（Story 1.14 模式核对）
  - [ ] 必要时空间索引（网格 bucket）加速多边形相交——但 v1 棋盘规模小（架构 §4.3），优先不做，仅在 T3 证明确实瓶颈时加
- [ ] **T6 — 触控目标尺寸复核**（AC1，UX-DR15）
  - [ ] 复核 1.17 已实现的 44px/56px 在缩放后仍成立（缩放下特工底座/控制点 hit-target 不能小于 44px）——必要时放大 hit-area 独立于视觉
- [ ] **T7 — 测试 + 验证**（AC1-5）
  - [ ] 单测：手势状态机迁移（IDLE/SINGLE_DRAG/PINCH/PAN）覆盖；拖动阈值边界
  - [ ] e2e（Playwright touch）：双指缩放不误触特工拖动；单指拖特工路径正确
  - [ ] 手测：真实平板（或 Chrome device emulation iPad）跑密集板，确认帧率达标
  - [ ] 全金样/e2e 回归（Epic 1-3 不破坏）

## Dev Notes

### 架构合规（必须遵循）

- **几何零重依赖（AR-6/§4.3）**：原生算法，不引第三方渲染/几何库。canvas 用原生 2D context；性能优化靠分层/memoize/按需，不靠引库。
- **UI 只读 store（AR-9）**：手势/视口状态进 Zustand（或局部 ref），不直接调引擎/几何；几何 overlay 是几何模块的纯计算结果渲染。
- **咨询式几何不变（§4.4）**：性能优化不能牺牲 AMBIGUOUS 翻转交互——overlay 延迟计算时，翻转假设仍实时重算资格（FR-10）。若延迟导致翻转卡顿，则翻转路径走快通道（不降级）。
- **平台（NFR-8）**：响应式桌面 + 平板 768-1024+；优化目标分档（平板 30fps / 桌面 60fps）。

### 关键约束

- **UX-OQ-2 手势冲突**：原 UX 设计的开放问题——双指缩放 vs 单指拖特工的优先级。本故事收口：双指优先（一旦识别接管），单指按下未达双指阈值前为候选拖动。
- **UX-OQ-9 渲染性能**：原 UX 开放问题——密集板 LOS/射程/控制圈帧率。本故事收口：按需显示 + 操作期间降级。
- **不平添复杂度（架构 §4.3）**：v1 棋盘规模小，暴力 O(n·m) 够用；空间索引仅在 T3 证明瓶颈时加，避免过早优化。
- **无闪烁降级**：用户不应感知「降级了」，只感知「跟手了」——降级/恢复静默。
- **不影响正确性**：降级只影响「何时算/画」，不影响「算出什么」——几何 finding 值不变（NFR-1）。

### 不要做

- 不引第三方 canvas/手势库（保持零重依赖）。
- 不为性能牺牲几何正确性或咨询式翻转。
- 不做空间索引除非 T3 证明必要。
- 不破坏桌面键鼠交互。

### References

- 架构 §4 几何 / §4.3 性能 / §4.4 咨询式 / AR-6/AR-9 / NFR-3/8 — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- UX §UX-DR5 棋盘交互 / §UX-DR15 触控 / UX-OQ-2/9 — `planning-artifacts/ux/ux-design-kill-team-companion-2026-06-28.md`
- Story 1.14 棋盘交互与几何可视化（基线，不回归）：`_bmad-output/implementation-artifacts/1-14-*`（或对应实现）
- Epic 4 Story 4.1 — `planning-artifacts/epics.md`

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
