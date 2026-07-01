import { describe, it, expect } from 'vitest'
import {
  losFinding,
  coverFinding,
  rangeFinding,
  engagementFinding,
  validateTarget,
  flipFinding,
  FindingStore,
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

describe('LOS 头部→底座圆保真（DN4）', () => {
  // 矮墙：中心线穿过，但目标底座切线从墙上方绕过
  const lowWall: Board = {
    terrain: [{ id: 'w', kind: 'BLOCKING', polygon: [{ x: 4, y: -0.5 }, { x: 5, y: -0.5 }, { x: 5, y: 0.5 }, { x: 4, y: 0.5 }] }],
    operatives: [],
  }
  // 高墙：连切线也挡
  const tallWall: Board = {
    terrain: [{ id: 'w', kind: 'BLOCKING', polygon: [{ x: 4, y: -3 }, { x: 5, y: -3 }, { x: 5, y: 3 }, { x: 4, y: 3 }] }],
    operatives: [],
  }

  it('无 radius → 中心线（向后兼容），矮墙挡中心 → 不可见', () => {
    expect(losFinding({ x: 0, y: 0 }, { x: 10, y: 0 }, lowWall).finalValue).toBe(false)
  })

  it('大底座（r=2）：中心被矮墙挡，但切线绕过 → 可见（保真收益）', () => {
    const f = losFinding({ x: 0, y: 0 }, { x: 10, y: 0 }, lowWall, { targetBaseRadius: 2 })
    expect(f.finalValue).toBe(true)
  })

  it('大底座：高墙连切线全挡 → 不可见', () => {
    const f = losFinding({ x: 0, y: 0 }, { x: 10, y: 0 }, tallWall, { targetBaseRadius: 2 })
    expect(f.finalValue).toBe(false)
  })

  it('攻击方在目标底座内（d≤r）→ 必可见', () => {
    const f = losFinding({ x: 9, y: 0 }, { x: 10, y: 0 }, tallWall, { targetBaseRadius: 2 })
    expect(f.finalValue).toBe(true)
  })

  it('无阻挡 + 大底座 → 可见', () => {
    expect(losFinding({ x: 0, y: 0 }, { x: 10, y: 0 }, noTerrain, { targetBaseRadius: 2 }).finalValue).toBe(true)
  })

  it('validateTarget 注入底座半径走保真 LOS（矮墙 + 大底座 → 合法）', () => {
    const target = op('d', 10, 0, 2) // baseRadius 2
    const r = validateTarget(op('a', 0, 0), target, 20, lowWall, [])
    expect(r.ok).toBe(true) // 保真 LOS 可见 → 不进 missing
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

describe('咨询式翻转接线 + finding store（DN7/D-24）', () => {
  // 高墙挡 LOS：(0,0)→(10,0) 不可见；其余（射程/掩护/遮挡/控制）均过
  const blockedLos: Board = {
    terrain: [{ id: 'w', kind: 'BLOCKING', polygon: [{ x: 4, y: -3 }, { x: 5, y: -3 }, { x: 5, y: 3 }, { x: 4, y: 3 }] }],
    operatives: [],
  }
  const atk = op('a', 0, 0)
  const tgt = op('d', 10, 0)

  it('LOS 被挡 → 不合法；翻转覆盖 LOS→可见 → 合法', () => {
    expect(validateTarget(atk, tgt, 20, blockedLos, []).ok).toBe(false)
    const r = validateTarget(atk, tgt, 20, blockedLos, [], {
      findingOverrides: [{ kind: 'LOS', finalValue: true }],
    })
    expect(r.ok).toBe(true)
    expect(r.missing.some((m) => m.includes('LOS'))).toBe(false)
  })

  it('翻转覆盖反映进 findings（overridden=true）', () => {
    const r = validateTarget(atk, tgt, 20, blockedLos, [], {
      findingOverrides: [{ kind: 'LOS', finalValue: true }],
    })
    const los = r.findings.find((f) => f.kind === 'LOS')!
    expect(los.finalValue).toBe(true)
    expect(los.overridden).toBe(true)
  })

  it('FindingStore：flip 翻转 + overridden 持久 + overrides() 导出', () => {
    const store = new FindingStore()
    store.upsertAll(validateTarget(atk, tgt, 20, blockedLos, []).findings)
    expect(store.get('LOS')?.finalValue).toBe(false)
    store.flip('LOS')
    expect(store.get('LOS')?.finalValue).toBe(true)
    expect(store.get('LOS')?.overridden).toBe(true)
    const ov = store.overrides()
    expect(ov).toEqual([{ kind: 'LOS', finalValue: true }])
  })

  it('端到端：store 翻转 → 重算 validateTarget(store.overrides()) → 合法；玩家终裁跨重算保留', () => {
    const store = new FindingStore()
    store.upsertAll(validateTarget(atk, tgt, 20, blockedLos, []).findings)
    expect(validateTarget(atk, tgt, 20, blockedLos, []).ok).toBe(false)
    store.flip('LOS')
    const r = validateTarget(atk, tgt, 20, blockedLos, [], { findingOverrides: store.overrides() })
    expect(r.ok).toBe(true)
    // 再 upsert：引擎值刷新但玩家翻转的 finalValue 保留
    store.upsertAll(r.findings)
    expect(store.get('LOS')?.finalValue).toBe(true)
    expect(store.get('LOS')?.overridden).toBe(true)
  })
})
