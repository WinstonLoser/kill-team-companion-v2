import { describe, expect, it } from 'vitest'
import type { MapPack } from '../../src/data/maps'
import { createPlanarReachability } from '../../src/geometry/planarMove'

const box = (x1: number, y1: number, x2: number, y2: number) => [
  { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 },
]
const map = (walls: Array<[number, number, number, number]>, doors: Array<[number, number, number, number]> = []): MapPack => ({
  mapId: 'planar-test', name: '平面测试', version: '1', bounds: { w: 12, h: 10 }, objectives: [],
  dropZones: { a: box(0, 0, 2, 10), b: box(10, 0, 12, 10) },
  terrain: [
    ...walls.map((wall, i) => ({ id: `wall-${i}`, kind: 'BLOCKING' as const, polygon: box(...wall) })),
    ...doors.map((door, i) => ({ id: `door-${i}`, kind: 'COVER' as const, accessible: true, polygon: box(...door) })),
  ],
})

describe('平面移动寻路', () => {
  it('圆形距离内的隔墙落点不可达；距离足够时会绕墙并计入转折增量', () => {
    const arena = map([[5, 2, 6, 8]])
    const short = createPlanarReachability({ map: arena, from: { x: 2, y: 5 }, radius: .45, allowance: 7, action: 'MOVE', side: 'a', obstacles: [] })
    expect(short.routeTo({ x: 8, y: 5 }).ok).toBe(false)
    const long = createPlanarReachability({ map: arena, from: { x: 2, y: 5 }, radius: .45, allowance: 14, action: 'MOVE', side: 'a', obstacles: [] })
    const route = long.routeTo({ x: 8, y: 5 })
    expect(route.ok).toBe(true)
    expect(route.path.length).toBeGreaterThan(2)
    expect(route.cost).toBeGreaterThan(6)
  })

  it('窄通道根据底座尺寸决定能否通过', () => {
    const arena = map([[4, 0, 6, 4.4], [4, 5.6, 6, 10]])
    const small = createPlanarReachability({ map: arena, from: { x: 2, y: 5 }, radius: .45, allowance: 8, action: 'MOVE', side: 'a', obstacles: [] })
    const large = createPlanarReachability({ map: arena, from: { x: 2, y: 5 }, radius: .65, allowance: 8, action: 'MOVE', side: 'a', obstacles: [] })
    expect(small.routeTo({ x: 8, y: 5 }).ok).toBe(true)
    expect(large.routeTo({ x: 8, y: 5 }).ok).toBe(false)
  })

  it('可通行门计 1″，敌方底座阻挡通过', () => {
    const arena = map([], [[5, 4, 6, 6]])
    const input = { map: arena, from: { x: 3, y: 5 }, radius: .45, allowance: 6, action: 'MOVE' as const, side: 'a' }
    expect(createPlanarReachability({ ...input, obstacles: [] }).routeTo({ x: 8, y: 5 }).cost).toBe(6)
    const blocked = createPlanarReachability({ ...input, obstacles: [{ pos: { x: 5.5, y: 5 }, radius: .5, side: 'b' }] })
    expect(blocked.routeTo({ x: 8, y: 5 }).path.some(p => p.y !== 5)).toBe(true)
  })
})
