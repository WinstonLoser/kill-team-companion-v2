# Story 1.12: 开局准备——选图 + 画地形 + 部署 (setup-map-deploy)

Status: ready-for-dev

## Story

As a 玩家,
I want 选预设地图或手画地形，并交替把特工部署到降落区,
so that 开局棋盘就绪、合法拦截在前。

## Acceptance Criteria

1. **AC1（地图模板选择）**：进入对局首屏为地图选择网格——预设 MapPack 模板(缩略图 + 名称 + 预览)可载入；或选「空白板」进自定义画地形模式。载入后展示完整棋盘(地形多边形 + 目标点图标 + 双方降落区色块)。
2. **AC2（自定义画地形）**：空白板提供画地形工具(矩形/多边形/橡皮/复制/镜像/网格吸附)，画完一块弹属性标签多选(阻碍LOS / 掩护源 / 飞蝇云(遮挡) / 困难地形 / 可攀爬 / 制高点)；独立按钮放置目标点与双方降落区多边形。自定义板会话内有效，刷新重置(D-20)。
3. **AC3（部署阶段交替部署）**：载入地图后进入部署——push 提示「轮到 A — 在降落区放置特工」；从单位面板拖特工到己方降落区落子(底座圆 + 朝向)；A 放 1 → B 放 1 交替(色带切换, D-19 全公开无遮罩)；出降落区/重叠 → 拦截卡。
4. **AC4（部署完成门禁）**：双方全部特工部署完 → 「开始转折点 1 ▶」可点 → 进入对局主界面(Story 1.13)；未全部署时该按钮置灰 + tooltip 显示待部署数。

## Tasks / Subtasks

- [ ] **T1 — 地图选择视图**（AC1）
  - [ ] 从 `packs/maps/*.json`（架构 §4.7 MapPack）读预设模板列表；网格渲染（缩略图 = 简化 SVG/Canvas 地形 + 目标点 + 降落区）
  - [ ] 点击模板 → 预览抽屉（地形/目标点/降落区）+ `[载入 ▶]`
  - [ ] 「空白板」入口 → 进自定义画地形模式(T2)
  - [ ] UI 只读 store + dispatch `loadMapPack(mapId)`；store 调 packLoader
- [ ] **T2 — 画地形工具（自定义板）**（AC2）
  - [ ] 工具栏：`[矩形][多边形][橡皮][复制][镜像][网格吸附]`；英寸标尺 + 网格背景
  - [ ] 画完一块 → 弹属性标签多选（地形 `kind`: BLOCKING/COVER/OBSCURING + `vantage`/`climbable` 标志，架构 §4.1 TerrainFeature）
  - [ ] 独立按钮放目标点(`ObjectiveMarker`, §4.6)与双方降落区多边形(`dropZones.a/b`)
  - [ ] 产物写入 store 的 `board.terrain/objectives/dropZones`（会话内, D-20）
  - [ ] 与 Story 1.14 棋盘交互共享 canvas/拖拽底层（避免重复实现）
- [ ] **T3 — 部署阶段状态机接入**（AC3/AC4）
  - [ ] 接 Story 1.9 的 TurnStateMachine `DEPLOYMENT` 状态；push 提示由状态机驱动
  - [ ] 交替部署：A 放 1 → 切主动玩家(色带横扫, UX §10.4) → B 放 1；循环至全部署
  - [ ] 单位面板拖拽源：未部署特工卡片可拖到棋盘己方降落区
- [ ] **T4 — 部署合法性拦截**（AC3）
  - [ ] 落点校验：底座圆完全在己方 `dropZones` 多边形内 + 不与已部署特工底座圆重叠
  - [ ] 违规 → 拦截卡(UX §6)列「出降落区」/「与 X 重叠」；不落子
  - [ ] 复用 geometry 模块(Story 1.8)的点-多边形/圆-距离判定
- [ ] **T5 — 落子渲染 + 朝向**（AC3）
  - [ ] 落子显示底座圆(阵营色描边) + 朝向三角(UX §7.1)；朝向双击旋转(部署期可调)
  - [ ] 拖放时实时显示英寸数(对齐 Story 1.14)
- [ ] **T6 — 开始转折点 1 门禁**（AC4）
  - [ ] 双方所有 roster 特工均已部署 → 「开始转折点 1 ▶」可点 → dispatch 推进状态机到 `TURNING_POINT_START` → 切 `currentView` 到 match(Story 1.13)
  - [ ] 未全部署：置灰 + tooltip「待部署: A×N B×M」
- [ ] **T7 — 触控与基调兜底**（AC2/AC3）
  - [ ] 工具栏按钮 44px；地图缩略图/载入按钮 56px；可点击区与可读区分离(NFR-9)
  - [ ] 暗色主题 + 阵营冷暖分色(A 蓝/B 红)；目标点占位色（Story 1.16 定稿菱形+圈）

## Dev Notes

### UX: §11 开局准备
- §11.1 地图选择：预设模板网格(缩略图 + 名称)→ 点击预览 → `[载入 ▶]`；空白板入口进画地形。
- §11.2 画地形工具：工具栏(矩形/多边形/橡皮/复制/镜像/网格吸附)；画完弹属性标签多选；独立按钮放目标点与降落区；自定义板会话内(D-20)。
- §11.3 部署：push「轮到 X — 在降落区放置特工」；拖特工到己方降落区；外红框拦截；交替部署(色带切换, D-19 全公开)；全部署完 → 开始 TP1。

### 架构: §4.7 MapPack / §4.1 terrain / §4.6 objectives
- `MapPack: { mapId, name, bounds, terrain[], objectives[], dropZones:{a,b} }`（§4.7）——预设模板随版本发布在 `packs/maps/*.json`，自定义手画会话内。
- `TerrainFeature: { id, polygon, kind: BLOCKING|COVER|OBSCURING, vantage?, climbable?, height?, keywords[] }`（§4.1）。
- `ObjectiveMarker: { id, pos, controlRange }`（§4.6）。
- 部署合法性 = dropZones 多边形内 + 不重叠（FR-24）。

### 关键约束
- **D-20 无存档刷新重置**：自定义板会话内有效，刷新即丢；想复用须走预设模板（数据包发布）。
- **D-19 单屏全公开**：交替部署靠色带/状态带切换主动玩家，**不遮罩、不藏信息**。
- **UI 只消费 state**（AR-9）：拖拽/绘制经 store dispatch，几何判定调 geometry 模块（UI 不内嵌几何算法）。
- **MapPack 是静态数据**（架构 §4.7），随版本发布，不违 D-20（非对局状态）。
- 触控 44px / 关键 56px；手势优先级（缩放 vs 拖特工）留 UX-OQ-2，本故事先做基础拖放。

## References

- UX §11 开局准备 — `planning-artifacts/ux/ux-design-kill-team-companion-2026-06-28.md`
- 架构 §4.1 terrain / §4.6 objectives / §4.7 MapPack — `planning-artifacts/architecture/architecture-kill-team-companion-2026-06-28.md`
- PRD FR-24 / D-19 / D-20 / D-28 — `planning-artifacts/prds/prd-kill-team-companion-2026-06-28/prd.md`
- Epic 1 Story 1.12 — `planning-artifacts/epics.md`
- 依赖：Story 1.8（geometry）/ Story 1.9（状态机 DEPLOYMENT）/ Story 1.11（roster）

## Dev Agent Record

### Agent Model Used
（dev-story 时填）

### Completion Notes List

### File List
