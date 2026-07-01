import { describe, it, expect } from 'vitest'
import { loadMapPack } from '../../src/data/maps'
import openMap from '../../src/data/packs/maps/open.v1.json'
import ruinMap from '../../src/data/packs/maps/ruin.v1.json'
import corridorMap from '../../src/data/packs/maps/corridor.v1.json'

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

  it('corridor 含 BLOCKING + OBSCURING 多种地形', () => {
    const m = loadMapPack(corridorMap)
    const kinds = new Set(m.terrain.map((t) => t.kind))
    expect(kinds.has('BLOCKING')).toBe(true)
    expect(kinds.has('OBSCURING')).toBe(true)
  })

  it('缺字段 → 抛错（NFR-5 不静默降级）', () => {
    expect(() => loadMapPack({ mapId: 'x' })).toThrow(/missing/)
  })
})
