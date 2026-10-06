import type { MapPack } from '../data/maps'
import type { Point, TerrainFeature } from './geometry'
import { circlesOverlap, pointInPolygon } from './geometry'

export type MoveAction = 'MOVE' | 'DASH' | 'FALL_BACK' | 'CHARGE'
export interface MoveObstacle { pos: Point; radius: number; side: string }
export interface PlanarMoveInput {
  map: MapPack
  from: Point
  radius: number
  allowance: number
  action: MoveAction
  side: string
  obstacles: MoveObstacle[]
}
export interface PlanarRoute { ok: boolean; path: Point[]; cost: number; reason?: string }

const STEP = 0.5
const EPS = 1e-7
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = dx * dx + dy * dy ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0
  return dist(p, { x: a.x + dx * t, y: a.y + dy * t })
}

function segmentSegmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  const cross = (u: Point, v: Point, w: Point) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x)
  const ab = cross(a, b, c), ac = cross(a, b, d), cd = cross(c, d, a), ce = cross(c, d, b)
  const opposite = (x: number, y: number) => (x > EPS && y < -EPS) || (x < -EPS && y > EPS)
  const onSegment = (p: Point, u: Point, v: Point) => p.x >= Math.min(u.x, v.x) - EPS && p.x <= Math.max(u.x, v.x) + EPS && p.y >= Math.min(u.y, v.y) - EPS && p.y <= Math.max(u.y, v.y) + EPS
  if ((opposite(ab, ac) && opposite(cd, ce)) ||
    (Math.abs(ab) <= EPS && onSegment(c, a, b)) || (Math.abs(ac) <= EPS && onSegment(d, a, b)) ||
    (Math.abs(cd) <= EPS && onSegment(a, c, d)) || (Math.abs(ce) <= EPS && onSegment(b, c, d))) return 0
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b))
}

function sweptCircleHitsPolygon(a: Point, b: Point, radius: number, poly: Point[]): boolean {
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return true
  for (let i = 0; i < poly.length; i++) {
    if (segmentSegmentDistance(a, b, poly[i]!, poly[(i + 1) % poly.length]!) < radius - EPS) return true
  }
  return false
}

function insideBoard(p: Point, input: PlanarMoveInput): boolean {
  return p.x >= input.radius - EPS && p.y >= input.radius - EPS && p.x <= input.map.bounds.w - input.radius + EPS && p.y <= input.map.bounds.h - input.radius + EPS
}

function solidFeatures(input: PlanarMoveInput): TerrainFeature[] {
  return input.map.terrain.filter(t => t.kind === 'BLOCKING' && !t.accessible && !t.advisoryOnly)
}

function segmentClear(a: Point, b: Point, input: PlanarMoveInput, solid: TerrainFeature[]): boolean {
  if (!insideBoard(a, input) || !insideBoard(b, input)) return false
  if (solid.some(t => sweptCircleHitsPolygon(a, b, input.radius, t.polygon))) return false
  for (const other of input.obstacles) {
    if (other.side === input.side) continue
    if (pointSegmentDistance(other.pos, a, b) < input.radius + other.radius - EPS) return false
    if (input.action !== 'FALL_BACK' && input.action !== 'CHARGE' && pointSegmentDistance(other.pos, a, b) <= input.radius + other.radius + 1 + EPS) return false
  }
  return true
}

function doorsCrossed(a: Point, b: Point, input: PlanarMoveInput): string[] {
  return input.map.terrain.filter(t => t.accessible && (pointInPolygon(a, t.polygon) || pointInPolygon(b, t.polygon) || sweptCircleHitsPolygon(a, b, 0.001, t.polygon))).map(t => t.id)
}

function doorsEntered(a: Point, b: Point, input: PlanarMoveInput): number {
  return input.map.terrain.filter(t => t.accessible && !pointInPolygon(a, t.polygon) && (pointInPolygon(b, t.polygon) || sweptCircleHitsPolygon(a, b, 0.001, t.polygon))).length
}

function routeCost(path: Point[], input: PlanarMoveInput): number {
  const doors = new Set<string>()
  let cost = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!
    if (dist(a, b) <= EPS) continue
    cost += Math.ceil(dist(a, b) - EPS)
    for (const id of doorsCrossed(a, b, input)) doors.add(id)
  }
  return cost + doors.size
}

interface Node { point: Point; distance: number; previous: number; done: boolean }
export interface PlanarReachability {
  cells: Point[]
  routeTo: (destination: Point) => PlanarRoute
}

/** Uniform-height movement. The grid finds routes; swept-base checks and rounded straight increments validate them. */
export function createPlanarReachability(input: PlanarMoveInput): PlanarReachability {
  const solid = solidFeatures(input)
  const nodes: Node[] = []
  const indexes = new Map<string, number>()
  const minX = input.radius, minY = input.radius
  const nx = Math.floor((input.map.bounds.w - 2 * input.radius) / STEP) + 1
  const ny = Math.floor((input.map.bounds.h - 2 * input.radius) / STEP) + 1
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const point = { x: minX + ix * STEP, y: minY + iy * STEP }
    if (dist(point, input.from) > input.allowance + STEP + 1) continue
    if (!segmentClear(point, point, input, solid)) continue
    indexes.set(`${ix},${iy}`, nodes.length)
    nodes.push({ point, distance: Infinity, previous: -1, done: false })
  }
  for (const node of nodes) if (dist(node.point, input.from) <= STEP * 1.5 && segmentClear(input.from, node.point, input, solid)) {
    node.distance = dist(node.point, input.from) + doorsEntered(input.from, node.point, input)
  }

  // Dijkstra is bounded to the current action's small movement radius.
  for (;;) {
    let current = -1, best = input.allowance + STEP + 1
    for (let i = 0; i < nodes.length; i++) if (!nodes[i]!.done && nodes[i]!.distance < best) { best = nodes[i]!.distance; current = i }
    if (current < 0) break
    const node = nodes[current]!
    node.done = true
    const ix = Math.round((node.point.x - minX) / STEP), iy = Math.round((node.point.y - minY) / STEP)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const nextIndex = indexes.get(`${ix + dx},${iy + dy}`)
      if (nextIndex === undefined) continue
      const next = nodes[nextIndex]!
      if (next.done || !segmentClear(node.point, next.point, input, solid)) continue
      const value = node.distance + dist(node.point, next.point) + doorsEntered(node.point, next.point, input)
      if (value < next.distance) { next.distance = value; next.previous = current }
    }
  }

  function trace(index: number, destination: Point): Point[] {
    const reversed = [destination]
    for (let i = index; i >= 0; i = nodes[i]!.previous) reversed.push(nodes[i]!.point)
    reversed.push(input.from)
    const coarse = reversed.reverse()
    const smooth = [coarse[0]!]
    for (let i = 0; i < coarse.length - 1;) {
      let j = coarse.length - 1
      while (j > i + 1 && !segmentClear(coarse[i]!, coarse[j]!, input, solid)) j--
      smooth.push(coarse[j]!)
      i = j
    }
    return smooth.filter((p, i) => i === 0 || dist(p, smooth[i - 1]!) > EPS)
  }

  function validEnd(destination: Point): boolean {
    return insideBoard(destination, input) && !solid.some(t => sweptCircleHitsPolygon(destination, destination, input.radius, t.polygon)) &&
      !input.obstacles.some(o => circlesOverlap(destination, input.radius, o.pos, o.radius)) &&
      (input.action !== 'FALL_BACK' || !input.obstacles.some(o => o.side !== input.side && dist(destination, o.pos) <= input.radius + o.radius + 1 + EPS)) &&
      (input.action !== 'CHARGE' || input.obstacles.some(o => o.side !== input.side && dist(destination, o.pos) <= input.radius + o.radius + 1 + EPS))
  }

  function routeTo(destination: Point): PlanarRoute {
    if (!validEnd(destination)) return { ok: false, path: [input.from, destination], cost: 0, reason: '落点与墙体、底座或行动要求冲突' }
    if (segmentClear(input.from, destination, input, solid)) {
      const path = [input.from, destination], cost = routeCost(path, input)
      if (cost <= input.allowance) return { ok: true, path, cost }
    }
    let best: PlanarRoute | null = null
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!
      if (!node.done || dist(node.point, destination) > STEP * 1.5 || !segmentClear(node.point, destination, input, solid)) continue
      const path = trace(i, destination), cost = routeCost(path, input)
      if (!best || cost < best.cost || (cost === best.cost && path.length < best.path.length)) best = { ok: cost <= input.allowance, path, cost }
    }
    if (best) return best.ok ? best : { ...best, reason: `绕行需 ${best.cost}″，当前行动只有 ${input.allowance}″` }
    return { ok: false, path: [input.from, destination], cost: Math.ceil(dist(input.from, destination)), reason: '底座无法沿平面路径绕过障碍' }
  }

  const cells = nodes.flatMap((node, index) => node.done && node.distance <= input.allowance + EPS && validEnd(node.point) && routeCost(trace(index, node.point), input) <= input.allowance ? [node.point] : [])
  return { cells, routeTo }
}
