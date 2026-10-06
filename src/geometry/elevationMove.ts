import type { MapPack } from '../data/maps'
import type { Point } from './geometry'
import { circleInsidePolygon, circleHitsBlockingTerrain, distanceToPolygon, pointInPolygon } from './geometry'

export interface ElevationMove {
  ok: boolean
  cost: number
  reason?: string
}

/** 单段直线移动：每个水平和垂直增量分别向上取整。攀爬至少计 2"；每次行动首 2" 跳落免费。 */
export function evaluateElevationMove(input: {
  map: MapPack
  from: Point
  to: Point
  fromHeight: number
  toHeight: number
  radius: number
  allowance: number
  action: 'MOVE' | 'DASH' | 'FALL_BACK' | 'CHARGE'
}): ElevationMove {
  const { map, from, to, fromHeight, toHeight, radius, allowance, action } = input
  const horizontal = Math.hypot(to.x - from.x, to.y - from.y)
  const climbing = toHeight > fromHeight
  const dropping = toHeight < fromHeight
  const destinationPlatform = map.platforms?.find(p => p.height === toHeight && circleInsidePolygon(to, radius, p.polygon))
  const originPlatform = map.platforms?.find(p => p.height === fromHeight && circleInsidePolygon(from, radius, p.polygon))

  if (to.x < radius || to.y < radius || to.x > map.bounds.w - radius || to.y > map.bounds.h - radius) return { ok: false, cost: 0, reason: '底座必须完全位于战场内' }
  if (toHeight > 0 && !destinationPlatform) return { ok: false, cost: 0, reason: '落点须完整位于可站立的高台表面' }
  if (fromHeight > 0 && !originPlatform) return { ok: false, cost: 0, reason: '当前位置没有对应的高台表面' }
  if (climbing && action === 'DASH') return { ok: false, cost: 0, reason: '冲刺不能攀爬；请使用转移、冲锋或后撤' }
  if (climbing && !destinationPlatform) return { ok: false, cost: 0, reason: '未选择可攀爬高台' }
  if (dropping && !originPlatform) return { ok: false, cost: 0, reason: '当前位置不在高台上' }
  if (climbing && fromHeight !== 0) return { ok: false, cost: 0, reason: '跨层攀爬须逐层完成' }
  if (dropping && toHeight !== 0) return { ok: false, cost: 0, reason: '跨层跳落须逐层完成' }
  if (dropping && originPlatform && circleInsidePolygon(to, radius, originPlatform.polygon)) return { ok: false, cost: 0, reason: '请将跳落落点放在高台边缘之外' }

  if (climbing && destinationPlatform) {
    const nearbyWall = map.terrain.some(t => t.pieceId === destinationPlatform.pieceId && t.climbable &&
      Math.max(0, distanceToPolygon(from, t.polygon) - radius) <= 1 + 1e-6)
    if (!nearbyWall) return { ok: false, cost: 0, reason: '攀爬起点须在可见墙体水平 1″ 范围内' }
  }

  const verticalCost = climbing ? Math.max(2, Math.ceil(toHeight - fromHeight)) : dropping ? Math.max(0, Math.ceil(fromHeight - toHeight - 2)) : 0
  let cost = Math.ceil(horizontal - 1e-9) + verticalCost

  const steps = Math.max(1, Math.ceil(horizontal / 0.1))
  const crossedAccessible = new Set<string>()
  for (let i = 1; i <= steps; i++) {
    const p = { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }
    for (const feature of map.terrain) if (feature.accessible && pointInPolygon(p, feature.polygon)) crossedAccessible.add(feature.id)
    if (p.x < radius || p.y < radius || p.x > map.bounds.w - radius || p.y > map.bounds.h - radius) return { ok: false, cost, reason: '移动路径不能离开战场' }
    if (fromHeight > 0 && toHeight === fromHeight && !map.platforms?.some(platform => platform.height === fromHeight && circleInsidePolygon(p, radius, platform.polygon))) return { ok: false, cost, reason: '高台上的平移不能穿过没有平台支撑的空隙' }
    const terrain = climbing || dropping
      ? map.terrain.filter(t => t.pieceId !== (destinationPlatform ?? originPlatform)?.pieceId)
      : fromHeight > 0 ? map.terrain.filter(t => t.pieceId !== originPlatform?.pieceId) : map.terrain
    if (circleHitsBlockingTerrain(p, radius, terrain)) return { ok: false, cost, reason: '路径穿过阻拦地形；请分段绕行' }
  }
  cost += crossedAccessible.size
  if (cost > allowance) return { ok: false, cost, reason: `移动需 ${cost}″，本行动只有 ${allowance}″（水平、攀爬／跳落与可通行地形分别计费）` }
  return { ok: true, cost }
}
