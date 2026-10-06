// MapPack（架构 §4.7）：预设地图模板，静态数据随版本发布（不违 D-20）。
// 自定义手画板会话内有效，刷新即丢。

import type { Point, Polygon, TerrainFeature } from '../geometry'

export interface ObjectiveMarker {
  id: string
  pos: Point
  controlRange: number
}

export interface DropZones {
  a: Polygon
  b: Polygon
}

export interface MapPack {
  mapId: string
  name: string
  version: string
  bounds: { w: number; h: number }
  terrain: TerrainFeature[]
  objectives: ObjectiveMarker[]
  dropZones: DropZones
  /** 双方约定后可采用的非标准宽部署区；默认始终使用 dropZones。 */
  expandedDropZones?: DropZones
  /** 仅用于展示建筑占地；碰撞与视线由 terrain 中的墙体决定。 */
  scenery?: { id: string; label: string; kind: 'stronghold' | 'ruin'; polygon: Polygon }[]
}

export type DeploymentMode = 'rules' | 'expanded'

/** 只有显式提供宽部署区的地图才允许启用约定方案。 */
export function mapWithDeploymentMode(map: MapPack, mode: DeploymentMode): MapPack {
  return mode === 'expanded' && map.expandedDropZones
    ? { ...map, dropZones: map.expandedDropZones }
    : map
}

/** 将地图模板的两个降落区按先手玩家的选择分配给 A/B 队。 */
export function assignedDropZones(map: MapPack, initiative: 'a' | 'b', choice: 'a' | 'b'): DropZones {
  return choice === initiative ? map.dropZones : { a: map.dropZones.b, b: map.dropZones.a }
}

/** 结构校验：必填字段缺失 → 抛错，绝不静默降级（NFR-5）。 */
export function loadMapPack(raw: unknown): MapPack {
  const m = raw as MapPack
  if (!m || typeof m !== 'object') throw new Error('MapPack: not an object')
  const req = ['mapId', 'name', 'version', 'bounds', 'terrain', 'objectives', 'dropZones'] as const
  const rec = m as unknown as Record<string, unknown>
  for (const k of req) {
    if (rec[k] === undefined) throw new Error(`MapPack: missing '${k}'`)
  }
  if (!Array.isArray(m.terrain) || !Array.isArray(m.objectives)) throw new Error('MapPack: terrain/objectives must be arrays')
  if (!Array.isArray(m.dropZones.a) || !Array.isArray(m.dropZones.b)) throw new Error('MapPack: dropZones.a/b must be polygons')
  if (m.expandedDropZones && (!Array.isArray(m.expandedDropZones.a) || !Array.isArray(m.expandedDropZones.b) || m.expandedDropZones.a.length < 3 || m.expandedDropZones.b.length < 3)) throw new Error('MapPack: expandedDropZones.a/b must be polygons')
  // P9：bounds 正值 + 降落区多边形 ≥3 顶点（NFR-5 不静默降级）
  if (!(m.bounds.w > 0) || !(m.bounds.h > 0)) throw new Error('MapPack: bounds.w/h must be positive')
  if (m.dropZones.a.length < 3 || m.dropZones.b.length < 3) throw new Error('MapPack: dropZones must have ≥3 vertices')
  for (const t of m.terrain) {
    if (!Array.isArray(t.polygon) || t.polygon.length < 3) throw new Error(`MapPack: terrain '${t.id}' polygon must have ≥3 vertices`)
  }
  return m
}
