import { describe, it, expect } from 'vitest'
import {
  losFinding,
  coverFinding,
  rangeFinding,
  engagementFinding,
  validateTarget,
  flipFinding,
  type Board,
  type OperativePlacement,
  type Point,
} from '../../src/geometry'

const noTerrain: Board = { terrain: [], operatives: [] }
const op = (id: string, x: number, y: number, r = 0.5): OperativePlacement => ({
  operativeId: id,
  pos: { x, y },
  baseRadius: r,
})

describe('LOS', () => {
  it('无地形阻挡 → 可见', () => {
    expect(losFinding({ x: 0, y: 0 }, { x: 10, y: 0 }, noTerrain).finalValue).toBe(true)
  })
  it('BLOCKING 地形挡线 → 不可见', () => {
    const board: Board = {
      terrain: [{ id: 'wall', kind: 'BLOCKING', polygon: [{ x: 4, y: -2 }, { x: 6, y: -2 }, { x: 6, y: 2 }, { x: 4, y: 2 }] }],
      operatives: [],
    }
    expect(losFinding({ x: 0, y: 0 }, { x: 10, y: 0 }, board).finalValue).toBe(false)
  })
})

describe('掩护', () => {
  it('1" 内有 COVER 地形 → 有掩护', () => {
    const board: Board = {
      terrain: [{ id: 'crate', kind: 'COVER', polygon: [{ x: 10, y: 0 }, { x: 10.5, y: 0 }, { x: 10.5, y: 0.5 }, { x: 10, y: 0.5 }] }],
      operatives: [],
    }
    expect(coverFinding({ x: 10.2, y: 0.2 }, board, []).finalValue).toBe(true)
  })
  it('2" 内有他特工 → 无掩护', () => {
    const board: Board = {
      terrain: [{ id: 'crate', kind: 'COVER', polygon: [{ x: 10, y: 0 }, { x: 10.5, y: 0 }, { x: 10.5, y: 0.5 }, { x: 10, y: 0.5 }] }],
      operatives: [],
    }
    const other: Point = { x: 11, y: 0 } // 距 10.2 约 0.8" < 2"
    expect(coverFinding({ x: 10.2, y: 0.2 }, board, [other]).finalValue).toBe(false)
  })
})

describe('射程/控制范围', () => {
  it('射程内', () => {
    expect(rangeFinding(op('a', 0, 0), op('d', 8, 0), 12).finalValue).toBe(true)
  })
  it('超射程', () => {
    expect(rangeFinding(op('a', 0, 0), op('d', 20, 0), 12).finalValue).toBe(false)
  })
  it('控制范围内（≤1"）+ 可见', () => {
    expect(engagementFinding(op('a', 0, 0), op('d', 0.8, 0), true).finalValue).toBe(true)
  })
  it('控制范围外', () => {
    expect(engagementFinding(op('a', 0, 0), op('d', 3, 0), true).finalValue).toBe(false)
  })
})

describe('资格判定 + 咨询式翻转', () => {
  it('合法目标', () => {
    const r = validateTarget(op('a', 0, 0), op('d', 8, 0), 12, noTerrain, [])
    expect(r.ok).toBe(true)
    expect(r.missing).toHaveLength(0)
  })
  it('超射程 → 列出缺失', () => {
    const r = validateTarget(op('a', 0, 0), op('d', 20, 0), 12, noTerrain, [])
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('超出射程')
  })
  it('flipFinding 翻转并标 overridden', () => {
    const f = losFinding({ x: 0, y: 0 }, { x: 10, y: 0 }, noTerrain)
    const flipped = flipFinding(f)
    expect(flipped.finalValue).toBe(!f.finalValue)
    expect(flipped.overridden).toBe(true)
  })

  it('P13：目标隐匿命令 → 不可射击', () => {
    const r = validateTarget(op('a', 0, 0), op('d', 8, 0), 12, noTerrain, [], {
      targetOrder: 'CONCEALED',
    })
    expect(r.ok).toBe(false)
    expect(r.missing.some((m) => m.includes('隐匿'))).toBe(true)
  })

  it('P13：目标与己方近战纠缠（控制范围内有己方）→ 不可射击', () => {
    // 目标 (8,0) r0.5；己方 (8.5,0) → 中心距 0.5 - 0.5 = 0 ≤ 1，纠缠
    const r = validateTarget(op('a', 0, 0), op('d', 8, 0), 12, noTerrain, [], {
      friendlyPositions: [{ x: 8.5, y: 0 }],
    })
    expect(r.ok).toBe(false)
    expect(r.missing.some((m) => m.includes('己方'))).toBe(true)
  })

  it('P13：目标就绪命令、控制范围内无己方 → 合法', () => {
    const r = validateTarget(op('a', 0, 0), op('d', 8, 0), 12, noTerrain, [], {
      targetOrder: 'ENGAGED',
      friendlyPositions: [{ x: 20, y: 0 }],
    })
    expect(r.ok).toBe(true)
  })

  it('P13：无 options 向后兼容（5 参调用）', () => {
    const r = validateTarget(op('a', 0, 0), op('d', 8, 0), 12, noTerrain, [])
    expect(r.ok).toBe(true)
  })
})
