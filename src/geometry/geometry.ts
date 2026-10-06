// 自由坐标几何（FR-8/FR-9，架构 §4）。纯算法，零重依赖，零 UI 依赖。

export interface Point {
  x: number
  y: number
}
export type Polygon = Point[]

export type TerrainKind = 'BLOCKING' | 'COVER' | 'OBSCURING'

export interface TerrainFeature {
  id: string
  polygon: Polygon
  kind: TerrainKind
  /** 沃库斯地形原本的轻/重类型；二维几何仍保留简化判定。 */
  terrainClass?: 'HEAVY' | 'LIGHT'
  /** 地图图例中的地形编号。 */
  pieceId?: string
  /** 门可穿越；其视线、近战等特殊规则由玩家现场裁定。 */
  accessible?: boolean
  /** 明确标记门，供后续隔门近战与门状态规则识别。 */
  isDoor?: boolean
  /** 只标位置，不自动参与二维裁定（复杂/不确定附件）。 */
  advisoryOnly?: boolean
  vantage?: boolean
  climbable?: boolean
  difficult?: boolean // 困难地形（移动修正；D2 AC2）
  bottom?: number
  top?: number
}

export interface OperativePlacement {
  operativeId: string
  pos: Point
  baseRadius: number // 英寸；底座直径毫米 ÷ 50.8
  height?: number // 底座距战场地面的高度（英寸）
  facing?: number
}

export interface Board {
  terrain: TerrainFeature[]
  operatives: OperativePlacement[]
  platforms?: { id: string; polygon: Polygon; height: number; targetingHeight?: number }[]
}

export type Confidence = 'CLEAR' | 'AMBIGUOUS'

/** 咨询式 finding：引擎给判定 + 置信度 + 余量，玩家可翻转 finalValue（D-24）。 */
export interface GeometryFinding {
  kind: 'LOS' | 'COVER' | 'OBSCURED' | 'RANGE' | 'ENGAGEMENT'
  value: boolean
  confidence: Confidence
  margin: number
  overridden?: boolean
  finalValue: boolean
}

const EPS = 0.25 // 宽松 epsilon 带（英寸），带内 = AMBIGUOUS

function confidence(margin: number): Confidence {
  return Math.abs(margin) < EPS ? 'AMBIGUOUS' : 'CLEAR'
}
function finding(kind: GeometryFinding['kind'], value: boolean, margin: number): GeometryFinding {
  return { kind, value, confidence: confidence(margin), margin, finalValue: value }
}

// ===== 基础几何 =====
function orient(a: Point, b: Point, c: Point): number {
  const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
  return v > 0 ? 1 : v < 0 ? -1 : 0
}
function onSeg(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a.x, b.x) - 1e-9 <= p.x &&
    p.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= p.y &&
    p.y <= Math.max(a.y, b.y) + 1e-9
  )
}
function segSeg(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const o1 = orient(a1, a2, b1)
  const o2 = orient(a1, a2, b2)
  const o3 = orient(b1, b2, a1)
  const o4 = orient(b1, b2, a2)
  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && onSeg(a1, a2, b1)) return true
  if (o2 === 0 && onSeg(a1, a2, b2)) return true
  if (o3 === 0 && onSeg(b1, b2, a1)) return true
  if (o4 === 0 && onSeg(b1, b2, a2)) return true
  return false
}
function pointInPoly(p: Point, poly: Polygon): boolean {
  if (poly.length < 3) return false // P9：退化多边形（点/线段）不算体积
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x
    const yi = poly[i]!.y
    const xj = poly[j]!.x
    const yj = poly[j]!.y
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** 点是否在多边形内（导出版，部署/目标控制复用，FR-24/FR-25）。 */
export function pointInPolygon(p: Point, poly: Polygon): boolean {
  return pointInPoly(p, poly)
}

/**
 * 底座圆是否完全在多边形内（部署合法性 FR-24）。
 * 判定：圆心在内，且圆心到多边形各边的最近距离 ≥ 半径。
 */
export function circleInsidePolygon(center: Point, radius: number, poly: Polygon): boolean {
  if (!pointInPoly(center, poly)) return false
  return nearestPoly(center, poly) >= radius - 1e-9
}

/** 两底座圆是否重叠（部署/移动合法性）。 */
export function circlesOverlap(a: Point, ra: number, b: Point, rb: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < ra + rb - 1e-9
}

/** 点到多边形边界最近距离（导出版，掩护/控制范围复用）。 */
export function distanceToPolygon(p: Point, poly: Polygon): number {
  return nearestPoly(p, poly)
}

/**
 * 底座圆是否撞上**阻拦**地形（墙体）：圆心在多边形内，或到边界距离 < 半径。
 * 仅 BLOCKING 地形阻挡移动/重叠（COVER/OBSCURING 可站上去获得掩护）。
 */
export function circleHitsBlockingTerrain(center: Point, radius: number, terrain: TerrainFeature[]): TerrainFeature | null {
  for (const tf of terrain) {
    if (tf.kind !== 'BLOCKING' || tf.advisoryOnly) continue
    if (pointInPoly(center, tf.polygon) || nearestPoly(center, tf.polygon) < radius - 1e-9) return tf
  }
  return null
}
function segIntersectsPoly(a: Point, b: Point, poly: Polygon): boolean {
  if (poly.length < 2) return false // P9：不足 2 顶点无法成边
  if (pointInPoly(a, poly) || pointInPoly(b, poly)) return true
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segSeg(a, b, poly[i]!, poly[j]!)) return true
  }
  return false
}
/** 线段在多边形内部的参数区间。 */
function insideIntervals(a: Point, b: Point, poly: Polygon): [number, number][] {
  if (poly.length < 3) return []
  const ts = [0, 1]
  const dx = b.x - a.x, dy = b.y - a.y
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!
    const ex = q.x - p.x, ey = q.y - p.y
    const den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-9) continue
    const px = p.x - a.x, py = p.y - a.y
    const t = (px * ey - py * ex) / den
    const u = (px * dy - py * dx) / den
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) ts.push(t)
  }
  ts.sort((x, y) => x - y)
  const intervals: [number, number][] = []
  for (let i = 1; i < ts.length; i++) {
    const l = ts[i - 1]!, r = ts[i]!
    if (r - l < 1e-8) continue
    const m = (l + r) / 2
    if (pointInPoly({ x: a.x + dx * m, y: a.y + dy * m }, poly)) intervals.push([l, r])
  }
  return intervals
}
function crossesVolume(a: Point, b: Point, za: number, zb: number, t: TerrainFeature): boolean {
  if (t.bottom === undefined || t.top === undefined) return segIntersectsPoly(a, b, t.polygon)
  const bottom = t.bottom, top = t.top
  return insideIntervals(a, b, t.polygon).some(([l, r]) => {
    const zl = za + (zb - za) * l, zr = za + (zb - za) * r
    return Math.min(zl, zr) <= top + 1e-6 && Math.max(zl, zr) >= bottom - 1e-6
  })
}
function crossesPlatform(a: Point, b: Point, za: number, zb: number, board: Board): boolean {
  return (board.platforms ?? []).some(p => {
    const level = p.targetingHeight ?? p.height
    if (Math.abs(za - level) < 1e-6 || Math.abs(zb - level) < 1e-6) return false
    const t = (level - za) / (zb - za)
    return t > 1e-6 && t < 1 - 1e-6 && pointInPoly({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, p.polygon)
  })
}
export function targetingHeight(placement: OperativePlacement, board: Board): number {
  const height = placement.height ?? 0
  const platform = board.platforms?.find(p => Math.abs(p.height - height) < 1e-6 && pointInPoly(placement.pos, p.polygon))
  return platform?.targetingHeight ?? height
}
function distPointSeg(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
function nearestPoly(p: Point, poly: Polygon): number {
  let min = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    min = Math.min(min, distPointSeg(p, poly[j]!, poly[i]!))
  }
  return min
}

// 多边形顶点到线段(a-b)的最近距离（LOS 近miss clearance 近似）
function minVertexDistToSeg(poly: Polygon, a: Point, b: Point): number {
  let min = Infinity
  for (const v of poly) min = Math.min(min, distPointSeg(v, a, b))
  return min
}

// ===== 判定（各产出 GeometryFinding） =====

/** 单条视线段被 BLOCKING 阻断情况：{blocked, clearance}。 */
function losSegment(a: Point, b: Point, board: Board, za = 0, zb = 0): { blocked: boolean; clearance: number } {
  const blockers = board.terrain.filter((t) => (t.kind === 'BLOCKING' || t.isDoor) && !t.advisoryOnly)
  let blocked = false
  let clearance = Infinity
  for (const blk of blockers) {
    const poly = blk.polygon
    if (poly.length < 2) continue
    // P8：端点站于此地形内（部署于废墟常见）→ 不当它阻断自身视线
    if (pointInPoly(a, poly) || pointInPoly(b, poly)) continue
    if (crossesVolume(a, b, za, zb, blk)) blocked = true
    else clearance = Math.min(clearance, minVertexDistToSeg(poly, a, b))
  }
  return { blocked: blocked || crossesPlatform(a, b, za, zb, board), clearance }
}

/** 目标底座圆上的候选视点：朝攻击方最近点 + 两侧切点（DN4 头→底座保真）。 */
function sightPoints(a: Point, c: Point, r: number): Point[] {
  const dx = c.x - a.x
  const dy = c.y - a.y
  const d = Math.hypot(dx, dy)
  if (d <= r) return [] // 攻击方在底座内 → 由调用方短路判定
  const ux = dx / d
  const uy = dy / d
  const nearest: Point = { x: c.x - r * ux, y: c.y - r * uy }
  const dt = Math.sqrt(d * d - r * r)
  const sinA = r / d
  const cosA = dt / d
  // 将 AC 方向 u 旋转 ±α（sinα = r/d）→ 两切线方向；切点 = A + dt·方向
  const t1: Point = { x: a.x + dt * (ux * cosA - uy * sinA), y: a.y + dt * (uy * cosA + ux * sinA) }
  const t2: Point = { x: a.x + dt * (ux * cosA + uy * sinA), y: a.y + dt * (uy * cosA - ux * sinA) }
  return [nearest, t1, t2]
}

/** LOS 保真选项（DN4）：注入目标底座半径则按「头部→底座圆」求可视（任一切线/最近点清则可见）。 */
export interface LosOptions {
  targetBaseRadius?: number
  attackerHeight?: number
  targetHeight?: number
}

/**
 * LOS：线段被 BLOCKING 阻断 → 不可见。
 * DN4：注入 targetBaseRadius 则改为「攻击方头部 → 目标底座圆」保真——
 * 任一候选视点（朝攻击方最近点 + 两侧切点）线段不被阻断即可见（可见部分底座）。
 * margin=未挡候选线的最大 clearance（最佳视野余量），全挡则 -1。
 */
export function losFinding(attacker: Point, target: Point, board: Board, options?: LosOptions): GeometryFinding {
  const r = options?.targetBaseRadius ?? 0
  // 模型的真实头部/姿态未知；底座上方 1.25" 为辅助判定视点，玩家仍可翻转。
  const za = (options?.attackerHeight ?? 0) + 1.25
  const zb = (options?.targetHeight ?? 0) + 1.25
  if (r <= 0) {
    // 向后兼容：中心到中心
    const { blocked, clearance } = losSegment(attacker, target, board, za, zb)
    return finding('LOS', !blocked, blocked ? -1 : clearance)
  }
  const d = Math.hypot(target.x - attacker.x, target.y - attacker.y)
  if (d <= r) {
    // 攻击方贴/入目标底座 → 必可见
    return finding('LOS', true, d - r)
  }
  let anyClear = false
  let best = -1
  for (const p of sightPoints(attacker, target, r)) {
    const seg = losSegment(attacker, p, board, za, zb)
    if (!seg.blocked) {
      anyClear = true
      best = Math.max(best, seg.clearance)
    }
  }
  return finding('LOS', anyClear, anyClear ? best : -1)
}

function intervenesForCover(attacker: Point | undefined, target: Point, radius: number, terrain: TerrainFeature, attackerHeight = 0, targetHeight = 0): boolean {
  if (!attacker) return true
  return [target, ...sightPoints(attacker, target, radius)].some(point => crossesVolume(attacker, point, attackerHeight, targetHeight, terrain))
}

/** 掩护：目标底座 1" 内有介入地形；与攻击方底座相距 2" 内则失去掩护。 */
export function coverFinding(target: Point, board: Board, otherOperatives: Point[], targetRadius = 0, attackerRadius = 0, attackerHeight = 0, targetHeight = 0): GeometryFinding {
  const attacker = otherOperatives[0]
  const coverTerrain = board.terrain.filter((t) => (t.kind === 'COVER' || t.kind === 'BLOCKING') && !t.advisoryOnly && intervenesForCover(attacker, target, targetRadius, t, attackerHeight, targetHeight))
  let nearestCover = Infinity
  for (const c of coverTerrain) nearestCover = Math.min(nearestCover, nearestPoly(target, c.polygon))
  const inCover = nearestCover <= 1 + targetRadius
  const attackerGap = attacker ? Math.hypot(
    Math.max(0, Math.hypot(attacker.x - target.x, attacker.y - target.y) - targetRadius - attackerRadius),
    targetHeight - attackerHeight,
  ) : Infinity
  const tooCloseOther = attackerGap <= 2 || otherOperatives.slice(1).some(o => Math.hypot(o.x - target.x, o.y - target.y) - targetRadius <= 2)
  const hasCover = inCover && !tooCloseOther
  const margin = nearestCover - 1 - targetRadius // 负=在掩护内
  return finding('COVER', hasCover, hasCover ? margin : -margin)
}

/** 当前二维棋盘中，提供目标掩护的最近一块地形类型。 */
export function coverTerrainClass(target: Point, board: Board, attacker?: Point, targetRadius = 0, attackerHeight = 0, targetHeight = 0): 'LIGHT' | 'HEAVY' | 'NONE' {
  const candidates = board.terrain
    .filter(t => (t.kind === 'COVER' || t.kind === 'BLOCKING') && !t.advisoryOnly && intervenesForCover(attacker, target, targetRadius, t, attackerHeight, targetHeight))
    .map(t => ({ distance: nearestPoly(target, t.polygon), type: t.terrainClass ?? (t.kind === 'BLOCKING' ? 'HEAVY' : 'LIGHT') }))
    .filter(t => t.distance <= 1 + targetRadius)
    .sort((a, b) => a.distance - b.distance)
  return candidates[0]?.type ?? 'NONE'
}

/** 遮蔽：射线穿过距双方底座均超过 1" 的重型地形；特殊遮蔽区域单独处理。 */
export function obscuredFinding(attacker: Point, target: Point, board: Board, attackerRadius = 0, targetRadius = 0, attackerHeight = 0, targetHeight = 0): GeometryFinding {
  const distance = Math.hypot(target.x - attacker.x, target.y - attacker.y)
  const spatialDistance = Math.hypot(distance, targetHeight - attackerHeight)
  const from = 1 + attackerRadius
  const to = 1 + targetRadius
  const start = spatialDistance > from + to ? { x: attacker.x + (target.x - attacker.x) * from / spatialDistance, y: attacker.y + (target.y - attacker.y) * from / spatialDistance } : attacker
  const end = spatialDistance > from + to ? { x: target.x + (attacker.x - target.x) * to / spatialDistance, y: target.y + (attacker.y - target.y) * to / spatialDistance } : target
  const obscured = board.terrain.some(t => !t.advisoryOnly && (
    (t.kind === 'OBSCURING' && pointInPoly(target, t.polygon)) ||
    (spatialDistance > from + to && t.terrainClass === 'HEAVY' && crossesVolume(start, end, attackerHeight + (targetHeight - attackerHeight) * from / spatialDistance, targetHeight + (attackerHeight - targetHeight) * to / spatialDistance, t))
  ))
  return finding('OBSCURED', obscured, obscured ? -1 : 1)
}

/** 同一重型地形同时提供掩护和遮蔽，防守方须二选一。 */
export function sharedCoverObscuredTerrain(attacker: OperativePlacement, target: OperativePlacement, board: Board): boolean {
  const attackerHeight = targetingHeight(attacker, board), targetHeight = targetingHeight(target, board)
  const basesApart = Math.hypot(
    Math.max(0, Math.hypot(target.pos.x - attacker.pos.x, target.pos.y - attacker.pos.y) - attacker.baseRadius - target.baseRadius),
    targetHeight - attackerHeight,
  )
  return basesApart > 2 && board.terrain.some(t => t.terrainClass === 'HEAVY' && !t.advisoryOnly &&
    nearestPoly(target.pos, t.polygon) <= 1 + target.baseRadius &&
    intervenesForCover(attacker.pos, target.pos, target.baseRadius, t, attackerHeight, targetHeight) &&
    obscuredFinding(attacker.pos, target.pos, { terrain: [t], operatives: [] }, attacker.baseRadius, target.baseRadius, attackerHeight, targetHeight).finalValue)
}

/** 射程：双方底座最近点距离 ≤ range。 */
export function rangeFinding(attacker: OperativePlacement, target: OperativePlacement, range: number): GeometryFinding {
  const horizontal = Math.max(0, Math.hypot(target.pos.x - attacker.pos.x, target.pos.y - attacker.pos.y) - attacker.baseRadius - target.baseRadius)
  const nearest = Math.hypot(horizontal, (target.height ?? 0) - (attacker.height ?? 0))
  const inRange = nearest <= range
  return finding('RANGE', inRange, range - nearest)
}

/** 控制范围：双方底座最近点 ≤ 1" 且可见。 */
export function engagementFinding(attacker: OperativePlacement, target: OperativePlacement, los: boolean): GeometryFinding {
  const horizontal = Math.max(0, Math.hypot(target.pos.x - attacker.pos.x, target.pos.y - attacker.pos.y) - attacker.baseRadius - target.baseRadius)
  const nearest = Math.hypot(horizontal, (target.height ?? 0) - (attacker.height ?? 0))
  const engaged = nearest <= 1 && los
  return finding('ENGAGEMENT', engaged, 1 - nearest)
}

export interface EligibilityResult {
  ok: boolean
  missing: string[]
  findings: GeometryFinding[]
}

/** validateTarget 扩展参数（P13，FR-10）：目标命令 + 己方位置 + 咨询式翻转覆盖。均可选，向后兼容。 */
export interface ValidateTargetOptions {
  /** 目标命令：CONCEALED 目标不可射击 */
  targetOrder?: 'ENGAGED' | 'CONCEALED'
  /** 己方特工位置：目标控制范围内有己方（近战纠缠）则禁射击，避免误伤 */
  friendlyPositions?: Point[]
  /** 有底座尺寸时使用完整控制范围判定，避免只用圆心距离漏判。 */
  friendlyPlacements?: OperativePlacement[]
  /** 咨询式翻转覆盖（DN7/D-24）：玩家终裁覆盖引擎某项 finding 的 finalValue */
  findingOverrides?: FindingOverride[]
  /** 判定类型：射击或近战 */
  kind?: 'SHOOT' | 'MELEE'
  /** 高点至少高 2 英寸时，可射击轻掩护中的隐匿目标。 */
  vantage?: boolean
  coverType?: 'LIGHT' | 'HEAVY' | 'NONE'
  /** 同一块地形同时造成掩护和遮蔽时，防守方的选择。 */
  terrainChoice?: 'COVER' | 'OBSCURED'
}

/** 玩家终裁覆盖（DN7）：强制某项 finding 的最终值。 */
export interface FindingOverride {
  kind: GeometryFinding['kind']
  finalValue: boolean
}

/** 把覆盖应用到单条 finding（命中则覆盖 finalValue + 标 overridden）。 */
function applyOverride(f: GeometryFinding, overrides?: FindingOverride[]): GeometryFinding {
  const ov = overrides?.find((o) => o.kind === f.kind)
  return ov ? { ...f, finalValue: ov.finalValue, overridden: true } : f
}

/**
 * 有效目标资格判定（FR-10）。综合 LOS + 掩护 + 遮挡 + 射程 + 攻击方不在敌方控制范围
 * + 目标命令（P13）+ 目标控制范围内无己方（P13）。
 * 不合法 → 列出缺哪条（先验拦截，FR-14）。
 */
export function validateTarget(
  attacker: OperativePlacement,
  target: OperativePlacement,
  range: number,
  board: Board,
  otherOperatives: Point[],
  options?: ValidateTargetOptions,
): EligibilityResult {
  const overrides = options?.findingOverrides
  const attackerTargetingHeight = targetingHeight(attacker, board), targetTargetingHeight = targetingHeight(target, board)
  const los = applyOverride(losFinding(attacker.pos, target.pos, board, { targetBaseRadius: target.baseRadius, attackerHeight: attackerTargetingHeight, targetHeight: targetTargetingHeight }), overrides)
  let cover = applyOverride(coverFinding(target.pos, board, otherOperatives, target.baseRadius, attacker.baseRadius, attackerTargetingHeight, targetTargetingHeight), overrides)
  let obscured = applyOverride(obscuredFinding(attacker.pos, target.pos, board, attacker.baseRadius, target.baseRadius, attackerTargetingHeight, targetTargetingHeight), overrides)
  if (cover.finalValue && obscured.finalValue && sharedCoverObscuredTerrain(attacker, target, board)) {
    if (options?.terrainChoice === 'OBSCURED') cover = { ...cover, finalValue: false }
    else obscured = { ...obscured, finalValue: false }
  }
  const rangeF = applyOverride(rangeFinding(attacker, target, range), overrides)
  // 沃库斯门在控制范围判定中不阻断可见性，但仍阻断正常射击视线。
  const controlLos = board.terrain.some(t => t.isDoor)
    ? losFinding(attacker.pos, target.pos, { ...board, terrain: board.terrain.filter(t => !t.isDoor) }, { targetBaseRadius: target.baseRadius, attackerHeight: attackerTargetingHeight, targetHeight: targetTargetingHeight }).finalValue
    : los.finalValue
  const controlVisibility = overrides?.find(o => o.kind === 'LOS')?.finalValue ?? controlLos
  const engaged = applyOverride(engagementFinding(attacker, target, controlVisibility), overrides)

  const missing: string[] = []
  const kind = options?.kind ?? 'SHOOT'
  
  if (kind === 'SHOOT') {
    if (!los.finalValue) missing.push('LOS 不可见')
    if (!rangeF.finalValue) missing.push('超出射程')
    if (engaged.finalValue) missing.push('在敌方控制范围内（禁射击）')
    // P13：目标隐匿命令不可射击
    if (options?.targetOrder === 'CONCEALED' && cover.finalValue && !(options.vantage && options.coverType === 'LIGHT')) missing.push('目标隐匿且有掩护（不可射击）')
    // P13：目标控制范围内有己方（近战纠缠）→ 避免误伤
    const friendlyPlacements = options?.friendlyPlacements
    const friendlyEngaged = friendlyPlacements
      ? friendlyPlacements.some(fp => {
          const visible = losFinding(fp.pos, target.pos, { ...board, terrain: board.terrain.filter(t => !t.isDoor) }, { targetBaseRadius: target.baseRadius, attackerHeight: targetingHeight(fp, board), targetHeight: targetTargetingHeight }).finalValue
          return engagementFinding(fp, target, visible).finalValue
        })
      : (options?.friendlyPositions ?? []).some(fp => Math.max(0, Math.hypot(target.pos.x - fp.x, target.pos.y - fp.y) - target.baseRadius) <= 1)
    if (friendlyEngaged) missing.push('目标控制范围内有己方（近战纠缠，避免误伤）')
  } else {
    // MELEE
    if (!engaged.finalValue) missing.push('近战必须在目标控制范围内')
  }

  return {
    ok: missing.length === 0,
    missing,
    findings: [los, cover, obscured, rangeF, engaged],
  }
}

/** 玩家翻转某项 finding（咨询式，D-24）。返回新 finding，并标记 overridden。 */
export function flipFinding(f: GeometryFinding): GeometryFinding {
  const finalValue = !f.finalValue
  return { ...f, finalValue, overridden: true }
}

/**
 * FindingStore：跨多次 validateTarget 调用持久化几何判定 + 玩家终裁翻转（DN7）。
 * 典型回路：upsertAll(result.findings) → flip(kind) → validateTarget(..., { findingOverrides: store.overrides() })。
 * 玩家翻转过的项，其 finalValue 在后续 upsert（引擎值刷新）时保留。
 */
export class FindingStore {
  private map = new Map<GeometryFinding['kind'], GeometryFinding>()

  /** 用最新判定的 findings 刷新引擎值；玩家 overridden 的 finalValue 保留。 */
  upsertAll(findings: GeometryFinding[]): void {
    for (const f of findings) {
      const prev = this.map.get(f.kind)
      this.map.set(f.kind, prev?.overridden ? { ...f, finalValue: prev.finalValue, overridden: true } : f)
    }
  }

  /** 玩家翻转某项（D-24 终裁）。 */
  flip(kind: GeometryFinding['kind']): void {
    const f = this.map.get(kind)
    if (f) this.map.set(kind, flipFinding(f))
  }

  get(kind: GeometryFinding['kind']): GeometryFinding | undefined {
    return this.map.get(kind)
  }

  /** 导出覆盖列表：仅玩家翻转过的项，供 validateTarget.findingOverrides 使用。 */
  overrides(): FindingOverride[] {
    return [...this.map.values()]
      .filter((f) => f.overridden)
      .map((f) => ({ kind: f.kind, finalValue: f.finalValue }))
  }

  clear(): void {
    this.map.clear()
  }
}
