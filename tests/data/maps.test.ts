import { describe, it, expect } from 'vitest'
import { assignedDropZones, loadMapPack, mapWithDeploymentMode } from '../../src/data/maps'
import openMap from '../../src/data/packs/maps/open.v1.json'
import ruinMap from '../../src/data/packs/maps/ruin.v1.json'
import corridorMap from '../../src/data/packs/maps/corridor.v1.json'
import { VOLKUS_MAPS } from '../../src/data/packs/maps/volkus'
import { circleHitsBlockingTerrain, circleInsidePolygon } from '../../src/geometry'

describe('MapPack 加载（Story 1.12）', () => {
  it('三预设地图结构合法', () => {
    for (const raw of [openMap, ruinMap, corridorMap]) {
      const m = loadMapPack(raw)
      expect(m.mapId).toBeTruthy()
      expect(m.bounds.w).toBeGreaterThan(0)
      expect(m.bounds.h).toBeGreaterThan(0)
      expect(m.objectives.length).toBeGreaterThan(0)
      expect(m.dropZones.a.length).toBeGreaterThanOrEqual(3)
      expect(m.dropZones.b.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('降落区 A 左 / B 右不重叠（x 分离）', () => {
    const m = loadMapPack(openMap)
    const aMaxX = Math.max(...m.dropZones.a.map((p) => p.x))
    const bMinX = Math.min(...m.dropZones.b.map((p) => p.x))
    expect(aMaxX).toBeLessThanOrEqual(bMinX)
  })

  it('先手方无论是 A 或 B，都可选择任一地图降落区', () => {
    const m = loadMapPack(openMap)
    expect(assignedDropZones(m, 'a', 'b').a).toBe(m.dropZones.b)
    expect(assignedDropZones(m, 'a', 'b').b).toBe(m.dropZones.a)
    expect(assignedDropZones(m, 'b', 'a').b).toBe(m.dropZones.a)
    expect(assignedDropZones(m, 'b', 'b').b).toBe(m.dropZones.b)
  })

  it('corridor 含 BLOCKING + OBSCURING 多种地形', () => {
    const m = loadMapPack(corridorMap)
    const kinds = new Set(m.terrain.map((t) => t.kind))
    expect(kinds.has('BLOCKING')).toBe(true)
    expect(kinds.has('OBSCURING')).toBe(true)
  })

  it('沃库斯两种地形布局可加载，且不带任务目标', () => {
    expect(VOLKUS_MAPS).toHaveLength(2)
    for (const map of VOLKUS_MAPS) {
      expect(loadMapPack(map)).toBe(map)
      expect(map.scenery).toHaveLength(6)
      expect(map.objectives).toEqual([])
      expect(map.terrain.some((t) => t.kind === 'BLOCKING')).toBe(true)
      expect(map.terrain.some((t) => t.kind === 'COVER')).toBe(true)
      for (const id of ['A', 'B', 'C', 'D']) expect(map.terrain.some((t) => t.pieceId === id && t.accessible)).toBe(true)
      for (const id of ['G', 'H']) expect(map.terrain.find((t) => t.pieceId === id)?.terrainClass).toBe('HEAVY')
      for (const id of ['I', 'J', 'K']) expect(map.terrain.find((t) => t.pieceId === id)?.terrainClass).toBe('LIGHT')
      for (const id of ['L', 'M', 'N']) expect(map.terrain.find((t) => t.pieceId === id)?.advisoryOnly).toBe(true)
      for (const door of map.terrain.filter((t) => t.accessible)) {
        const center = { x: (door.polygon[0]!.x + door.polygon[2]!.x) / 2, y: (door.polygon[0]!.y + door.polygon[2]!.y) / 2 }
        expect(circleHitsBlockingTerrain(center, 0.5, map.terrain)).toBeNull()
      }
      for (const feature of [...map.terrain, ...(map.scenery ?? [])]) {
        expect(feature.polygon.every((p) => p.x >= 0 && p.x <= 30 && p.y >= 0 && p.y <= 22)).toBe(true)
      }
    }
  })

  it('布局 1 的两侧部署区各自容纳一座要塞内的常规底座', () => {
    const standard = VOLKUS_MAPS[0]!
    expect(Math.max(...standard.dropZones.a.map((point) => point.x))).toBe(3)
    const map = mapWithDeploymentMode(standard, 'expanded')
    for (const [side, center] of [
      ['a', { x: 5, y: 18 }],
      ['b', { x: 23, y: 6 }],
    ] as const) {
      expect(circleInsidePolygon(center, 0.5, map.dropZones[side])).toBe(true)
      expect(circleHitsBlockingTerrain(center, 0.5, map.terrain)).toBeNull()
    }
    expect(circleInsidePolygon({ x: 15, y: 11 }, 0.5, map.dropZones.a)).toBe(false)
    expect(circleInsidePolygon({ x: 15, y: 11 }, 0.5, map.dropZones.b)).toBe(false)
    // 常见的 40mm 底座在宽部署区的空地也能落下，不必贴着地形或区线。
    expect(circleInsidePolygon({ x: 6, y: 11 }, 0.79, map.dropZones.a)).toBe(true)
    expect(circleHitsBlockingTerrain({ x: 6, y: 11 }, 0.79, map.terrain)).toBeNull()
    expect(circleInsidePolygon({ x: 25, y: 11 }, 0.79, map.dropZones.b)).toBe(true)
    expect(circleHitsBlockingTerrain({ x: 25, y: 11 }, 0.79, map.terrain)).toBeNull()
    expect(circleInsidePolygon({ x: 6, y: 11 }, 0.79, standard.dropZones.a)).toBe(false)
  })

  it('缺字段 → 抛错（NFR-5 不静默降级）', () => {
    expect(() => loadMapPack({ mapId: 'x' })).toThrow(/missing/)
  })
})
