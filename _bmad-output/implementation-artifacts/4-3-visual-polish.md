# Story 4.3: 视觉基调收口 (visual-polish)

Status: done

## Story

As a 玩家,
I want v1 视觉基调统一（配色色盲安全 + 字号阶/间距 token 化 + 强调色仅注意态）,
so that 桌上易读、长时间用不疲劳，且美学决策有据可循（D-31 后置美学，但收口基线）。

## Acceptance Criteria

1. **AC1（配色色盲模拟）**：全应用配色通过色盲模拟（CVD：protanopia/deuteranopia/tritanopia，至少前两种）——双方阵营冷暖分色 + 状态色（成功/警告/危险/中性）在色盲视图下仍可区分（靠明度差+形状冗余，不仅靠色相）；不通过则调。
2. **AC2（字号阶/间距 token 统一）**：所有字号、行高、间距、圆角、阴影走 design token（CSS 变量或 Tailwind/组件库 theme），消除硬编码魔法值；token 集中定义（如 `--space-1..8`、`--text-xs..xl`、`--radius-sm/lg`）。
3. **AC3（强调色仅注意态）**：强调色（accent，如亮黄/橙/红）**仅**用于需玩家注意的状态（待确认伤亡、待结算提示、拦截卡、AMBIGUOUS 几何⚠），不用于装饰；常规信息用中性色。
4. **AC4（深色主题兜底 + 双阵营分色）**：深色中性底（Story 1.17 已套组件库暗色主题）保留并统一；双方阵营冷暖分色（A 暖/B 冷或类似），全应用一致（棋盘特工/状态带/单位卡/日志）。
5. **AC5（美学后置 D-31，可选 ui-ux-pro-max）**：本故事是「基线收口」非「完整设计系统」——满足 AC1-4 即达标。若资源允许，可选调用 `ui-ux-pro-max` 技能产出完整设计系统（更多色板/字体配对/组件样式），作为 v1.x 美学升级的基础，但**非 v1 阻塞项**。
6. **AC6（无回归）**：Epic 1-3 功能/金样/e2e 不回归；触控尺寸（44/56px，UX-DR15）不被 token 化破坏。

## Tasks / Subtasks

- [x] **T1 — 现状盘点**（AC1/AC2/AC3）
  - [x] 扫 `src/ui/` 全部硬编码颜色/字号/间距（grep `#`、`px`、`rem` 字面量），输出清单
  - [x] 盘点现有强调色使用点，标出「装饰性误用」（违反 AC3）
- [x] **T2 — design token 体系**（AC2）
  - [x] 建 `src/ui/tokens.css`（或组件库 theme override）：颜色（neutral/accent/faction-a/faction-b/success/warn/danger）、字号阶（xs/sm/base/lg/xl）、间距（1=4px 节奏）、圆角、阴影
  - [x] 全应用替换硬编码为 `var(--token)`；组件库主题对齐 token
  - [x] token 命名语义化（`--color-accent` 非 `--color-yellow`），便于后续调色不改引用
- [x] **T3 — 配色 + 色盲模拟**（AC1/AC4）
  - [x] 选双方阵营分色（A 暖/B 冷，明度差足够）；状态色（success 绿/warn 橙/danger 红）调到色盲可分
  - [x] 用色盲模拟工具（Chrome DevTools rendering emulation / Stark / 在线 CVD 模拟器）跑关键屏（对局棋盘/结算流水线/拦截卡/胜负结果页）
  - [x] 不通过的配色调明度/饱和度或加形状冗余（如危险态加⚠图标不仅靠红）
- [x] **T4 — 强调色收口**（AC3）
  - [x] 移除装饰性强调色误用（如标题/分隔线用 accent 的情况）→ 改中性
  - [x] 强调色仅保留：待确认伤亡按钮、待结算 push、拦截卡、AMBIGUOUS ⚠、当前激活特工高亮
  - [x] 核对「动画仅因果」原则（UX-DR13）——强调色变化对应状态变化，无常驻闪烁
- [x] **T5 — 深色主题统一**（AC4）
  - [x] 确认组件库暗色主题（Story 1.17 套的）与 token 一致；自定义组件（棋盘 canvas、流水线、日志）颜色对齐
  - [x] 双阵营分色在棋盘/状态带/单位卡/日志全场景一致
- [x] **T6 —（可选）ui-ux-pro-max 完整设计系统**（AC5）
  - [x] 若资源允许：调用 `ui-ux-pro-max` 技能，产出完整设计系统（色板扩展/字体配对/按钮态/卡片样式/图标集）
  - [x] 产出物作为 v1.x 美学升级基础，不在 v1 阻塞
- [x] **T7 — 触控尺寸复核**（AC6，UX-DR15）
  - [x] token 化后复核 44px/56px 仍成立（关键操作不缩水）；可点击区与可读区分离不被破坏
- [x] **T8 — 验证 + 无回归**（AC6）
  - [x] 视觉走查关键屏（建队/部署/对局/结算/胜负）
  - [x] `npm test`/e2e 全绿；手测触控尺寸

## Dev Notes

### 架构合规（必须遵循）

- **美学后置（D-31）**：v1 用组件库暗色主题兜底，纯美学后置——本故事是「基线收口」（token 化 + 色盲 + 强调色收口），不是完整美学升级。完整设计系统是 v1.x 可选项。
- **平台（NFR-8/9）**：响应式桌面 + 平板 768-1024+；触控 44/56px（UX-DR15）不被破坏。
- **UI 只读 store（AR-9）**：视觉变化对应 store 状态变化，不引入视觉层独立状态。

### 关键约束

- **UX-DR13 视觉基调**（已定义）：深色中性底 + 双阵营冷暖分色 + 强调色给注意态 + 等宽紧凑流水线 + 动画仅因果。本故事是把它从「原则」落到「token + 实现」。
- **色盲安全是易读底线**：桌上 pass-and-play 双方需一眼区分阵营——不能仅靠红/绿（最常见的色盲冲突）。明度差 + 形状冗余是双保险。
- **强调色经济学**：强调色用多了等于没用——收敛到注意态，保持其「吸睛」效力。
- **token 化是可维护性投资**：避免散落硬编码，后续调色改 token 即可全局生效。
- **不阻塞 v1**：AC1-4 达标即可发 v1；AC5（完整设计系统）是 nice-to-have。

### 不要做

- 不做完整重设计（D-31 后置；除非走 AC5 可选路径且有资源）。
- 不引重 CSS 框架（保持组件库暗色主题 + token 覆盖）。
- 不为美学牺牲触控尺寸或功能正确性。
- 不引入常驻动画（UX-DR13 仅因果）。

### References

- 架构 §1 技术栈 / AR-9 / NFR-8/9 — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- UX §UX-DR13 视觉基调 / §UX-DR15 触控 — `planning-artifacts/ux/ux-design-kill-team-companion-2026-06-28.md`
- Story 1.17 规则查询与触控/视觉兜底（暗色主题基线）：`_bmad-output/implementation-artifacts/1-17-*`（或对应实现）
- Epic 4 Story 4.3 — `planning-artifacts/epics.md`
- 可选：`ui-ux-pro-max` 技能（完整设计系统，v1.x）

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
