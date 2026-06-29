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
  vantage?: boolean
  climbable?: boolean
}

export interface OperativePlacement {
  operativeId: string
  pos: Point
  baseRadius: number // = base.diameterMm/2 (D-27)
  facing?: number
}

export interface Board {
  terrain: TerrainFeature[]
  operatives: OperativePlacement[]
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
function segIntersectsPoly(a: Point, b: Point, poly: Polygon): boolean {
  if (poly.length < 2) return false // P9：不足 2 顶点无法成边
  if (pointInPoly(a, poly) || pointInPoly(b, poly)) return true
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segSeg(a, b, poly[i]!, poly[j]!)) return true
  }
  return false
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

/** LOS：攻击方→目标线段被 BLOCKING 地形阻断 → 不可见。margin=未挡时最近 blocker 到视线的距离（P5）。 */
export function losFinding(attacker: Point, target: Point, board: Board): GeometryFinding {
  const blockers = board.terrain.filter((t) => t.kind === 'BLOCKING')
  let blocked = false
  let clearance = Infinity
  for (const b of blockers) {
    const poly = b.polygon
    if (poly.length < 2) continue
    // P8：攻击方/目标站于此地形内（部署于废墟常见）→ 不当它阻断自身视线
    if (pointInPoly(attacker, poly) || pointInPoly(target, poly)) continue
    if (segIntersectsPoly(attacker, target, poly)) blocked = true
    else clearance = Math.min(clearance, minVertexDistToSeg(poly, attacker, target))
  }
  const margin = blocked ? -1 : clearance
  return finding('LOS', !blocked, margin)
}

/** 掩护：目标 1" 内有 COVER 地形 → 有掩护；2" 内有他特工 → 无掩护。 */
export function coverFinding(target: Point, board: Board, otherOperatives: Point[]): GeometryFinding {
  const coverTerrain = board.terrain.filter((t) => t.kind === 'COVER')
  let nearestCover = Infinity
  for (const c of coverTerrain) nearestCover = Math.min(nearestCover, nearestPoly(target, c.polygon))
  let nearestOther = Infinity
  for (const o of otherOperatives) nearestOther = Math.min(nearestOther, Math.hypot(o.x - target.x, o.y - target.y))

  const inCover = nearestCover <= 1
  const tooCloseOther = nearestOther <= 2
  const hasCover = inCover && !tooCloseOther
  const margin = nearestCover - 1 // 负=在掩护内
  return finding('COVER', hasCover, hasCover ? margin : -margin)
}

/** 遮挡：目标在 OBSCURING 地形内 → 被遮挡。 */
export function obscuredFinding(target: Point, board: Board): GeometryFinding {
  const obscured = board.terrain.some((t) => t.kind === 'OBSCURING' && pointInPoly(target, t.polygon))
  return finding('OBSCURED', obscured, obscured ? -1 : 1)
}

/** 射程：双方底座最近点距离 ≤ range。 */
export function rangeFinding(attacker: OperativePlacement, target: OperativePlacement, range: number): GeometryFinding {
  const center = Math.hypot(target.pos.x - attacker.pos.x, target.pos.y - attacker.pos.y)
  const nearest = Math.max(0, center - attacker.baseRadius - target.baseRadius)
  const inRange = nearest <= range
  return finding('RANGE', inRange, range - nearest)
}

/** 控制范围：双方底座最近点 ≤ 1" 且可见。 */
export function engagementFinding(attacker: OperativePlacement, target: OperativePlacement, los: boolean): GeometryFinding {
  const center = Math.hypot(target.pos.x - attacker.pos.x, target.pos.y - attacker.pos.y)
  const nearest = Math.max(0, center - attacker.baseRadius - target.baseRadius)
  const engaged = nearest <= 1 && los
  return finding('ENGAGEMENT', engaged, 1 - nearest)
}

export interface EligibilityResult {
  ok: boolean
  missing: string[]
  findings: GeometryFinding[]
}

/** validateTarget 扩展参数（P13，FR-10）：目标命令 + 己方位置。均可选，向后兼容。 */
export interface ValidateTargetOptions {
  /** 目标命令：CONCEALED 目标不可射击 */
  targetOrder?: 'ENGAGED' | 'CONCEALED'
  /** 己方特工位置：目标控制范围内有己方（近战纠缠）则禁射击，避免误伤 */
  friendlyPositions?: Point[]
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
  const los = losFinding(attacker.pos, target.pos, board)
  const cover = coverFinding(target.pos, board, otherOperatives)
  const obscured = obscuredFinding(target.pos, board)
  const rangeF = rangeFinding(attacker, target, range)
  const engaged = engagementFinding(attacker, target, los.finalValue)

  const missing: string[] = []
  if (!los.finalValue) missing.push('LOS 不可见')
  if (obscured.finalValue) missing.push('目标被遮挡')
  if (!rangeF.finalValue) missing.push('超出射程')
  if (engaged.finalValue) missing.push('在敌方控制范围内（禁射击）')
  // P13：目标隐匿命令不可射击
  if (options?.targetOrder === 'CONCEALED') missing.push('目标隐匿命令（不可射击）')
  // P13：目标控制范围内有己方（近战纠缠）→ 避免误伤
  const friendlies = options?.friendlyPositions ?? []
  const friendlyEngaged = friendlies.some((fp) => {
    const center = Math.hypot(target.pos.x - fp.x, target.pos.y - fp.y)
    return Math.max(0, center - target.baseRadius) <= 1
  })
  if (friendlyEngaged) missing.push('目标控制范围内有己方（近战纠缠，避免误伤）')

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
