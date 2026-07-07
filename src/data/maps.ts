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
  // P9：bounds 正值 + 降落区多边形 ≥3 顶点（NFR-5 不静默降级）
  if (!(m.bounds.w > 0) || !(m.bounds.h > 0)) throw new Error('MapPack: bounds.w/h must be positive')
  if (m.dropZones.a.length < 3 || m.dropZones.b.length < 3) throw new Error('MapPack: dropZones must have ≥3 vertices')
  for (const t of m.terrain) {
    if (!Array.isArray(t.polygon) || t.polygon.length < 3) throw new Error(`MapPack: terrain '${t.id}' polygon must have ≥3 vertices`)
  }
  return m
}
