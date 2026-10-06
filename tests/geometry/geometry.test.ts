import { describe, it, expect } from 'vitest'
import {
  losFinding,
  coverFinding,
  obscuredFinding,
  sharedCoverObscuredTerrain,
  targetingHeight,
  rangeFinding,
  engagementFinding,
  validateTarget,
  flipFinding,
  FindingStore,
  pointInPolygon,
  circleInsidePolygon,
  circlesOverlap,
  circleHitsBlockingTerrain,
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

describe('立体地形射线', () => {
  const wall = { id: 'wall', kind: 'BLOCKING' as const, terrainClass: 'HEAVY' as const, polygon: [{ x: 4, y: -1 }, { x: 4.2, y: -1 }, { x: 4.2, y: 1 }, { x: 4, y: 1 }], bottom: 0, top: 2 }
  const board: Board = { terrain: [wall], operatives: [] }

  it('高处视线越过矮墙，地面视线受阻', () => {
    expect(losFinding({ x: 0, y: 0 }, { x: 8, y: 0 }, board).finalValue).toBe(false)
    expect(losFinding({ x: 0, y: 0 }, { x: 8, y: 0 }, board, { targetHeight: 3 }).finalValue).toBe(true)
  })

  it('高台底座线越过地面墙体，不误算掩护或遮蔽', () => {
    expect(coverFinding({ x: 4.6, y: 0 }, board, [{ x: 0, y: 0 }], 0.3, 0.3).finalValue).toBe(true)
    expect(coverFinding({ x: 4.6, y: 0 }, board, [{ x: 0, y: 0 }], 0.3, 0.3, 3, 3).finalValue).toBe(false)
    expect(obscuredFinding({ x: 0, y: 0 }, { x: 8, y: 0 }, board).finalValue).toBe(true)
    expect(obscuredFinding({ x: 0, y: 0 }, { x: 8, y: 0 }, board, 0, 0, 3, 3).finalValue).toBe(false)
  })

  it('顶盖挡住从下层直穿上层的视线', () => {
    const roof: Board = { terrain: [], operatives: [], platforms: [{ id: 'roof', height: 3, polygon: [{ x: 4, y: -1 }, { x: 6, y: -1 }, { x: 6, y: 1 }, { x: 4, y: 1 }] }] }
    expect(losFinding({ x: 5, y: 0 }, { x: 5.8, y: 0 }, roof, { targetBaseRadius: 0.2, targetHeight: 3 }).finalValue).toBe(false)
  })

  it('相隔楼层时按立体距离判断 2 英寸贴近掩护例外', () => {
    const tall: Board = { terrain: [{ ...wall, polygon: [{ x: 1.2, y: -1 }, { x: 1.4, y: -1 }, { x: 1.4, y: 1 }, { x: 1.2, y: 1 }], top: 5 }], operatives: [] }
    expect(coverFinding({ x: 2.5, y: 0 }, tall, [{ x: 0, y: 0 }], 0.5, 0.5, 0, 0).finalValue).toBe(false)
    expect(coverFinding({ x: 2.5, y: 0 }, tall, [{ x: 0, y: 0 }], 0.5, 0.5, 3, 0).finalValue).toBe(true)
  })

  it('大型废墟与要塞首层按同一裁定高度绘制目标线', () => {
    const ruin: Board = { terrain: [], operatives: [], platforms: [{ id: 'C', height: 3.5, targetingHeight: 3, polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }] }] }
    expect(targetingHeight({ ...op('ruin', 2, 2), height: 3.5 }, ruin)).toBe(3)
    expect(targetingHeight({ ...op('ground', 2, 2), height: 0 }, ruin)).toBe(0)
  })

  it('同一地形造成掩护及遮蔽时，只使用防守方所选效果', () => {
    const heavy: Board = { terrain: [{ id: 'heavy', kind: 'COVER', terrainClass: 'HEAVY', bottom: 0, top: 3, polygon: [{ x: 8, y: -1 }, { x: 9, y: -1 }, { x: 9, y: 1 }, { x: 8, y: 1 }] }], operatives: [] }
    const a = op('a', 0, 0), t = op('t', 10, 0)
    expect(sharedCoverObscuredTerrain(a, t, heavy)).toBe(true)
    const cover = validateTarget(a, t, 20, heavy, [a.pos], { terrainChoice: 'COVER' }).findings
    const obscured = validateTarget(a, t, 20, heavy, [a.pos], { terrainChoice: 'OBSCURED' }).findings
    expect(cover.find(f => f.kind === 'COVER')?.finalValue).toBe(true)
    expect(cover.find(f => f.kind === 'OBSCURED')?.finalValue).toBe(false)
    expect(obscured.find(f => f.kind === 'COVER')?.finalValue).toBe(false)
    expect(obscured.find(f => f.kind === 'OBSCURED')?.finalValue).toBe(true)
  })
})

describe('LOS', () => {
  it('仅标位置的沃库斯附件不参与自动视线、掩护与碰撞', () => {
    const polygon = [{ x: 4, y: -2 }, { x: 6, y: -2 }, { x: 6, y: 2 }, { x: 4, y: 2 }]
    const board: Board = { terrain: [
      { id: 'accessory-wall', kind: 'BLOCKING', polygon, advisoryOnly: true },
      { id: 'accessory-cover', kind: 'COVER', polygon, advisoryOnly: true },
    ], operatives: [] }
    expect(losFinding({ x: 0, y: 0 }, { x: 10, y: 0 }, board).finalValue).toBe(true)
    expect(coverFinding({ x: 5, y: 0 }, board, []).finalValue).toBe(false)
    expect(circleHitsBlockingTerrain({ x: 5, y: 0 }, 0.5, board.terrain)).toBeNull()
  })
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

  it('隐匿目标在开阔地仍可射击', () => {
    const r = validateTarget(op('a', 0, 0), op('d', 8, 0), 12, noTerrain, [], {
      targetOrder: 'CONCEALED',
    })
    expect(r.ok).toBe(true)
    expect(r.missing.some((m) => m.includes('隐匿'))).toBe(false)
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

describe('部署/控制几何（Story 1.12/1.16 导出）', () => {
  const square = (x: number, y: number, w: number, h: number) => [
    { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
  ]
  const zone = square(0, 0, 10, 20)

  it('pointInPolygon：内/外/边界', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, zone)).toBe(true)
    expect(pointInPolygon({ x: 15, y: 5 }, zone)).toBe(false)
    expect(pointInPolygon({ x: 0, y: 0 }, zone)).toBe(true) // 顶点算内（奇偶规则）
  })

  it('circleInsidePolygon：圆完全在内 / 贴边外', () => {
    expect(circleInsidePolygon({ x: 5, y: 10 }, 0.6, zone)).toBe(true)
    // 圆心在内但半径触边 → 不完全在内
    expect(circleInsidePolygon({ x: 9.7, y: 10 }, 0.6, zone)).toBe(false)
    // 圆心在外
    expect(circleInsidePolygon({ x: 11, y: 10 }, 0.6, zone)).toBe(false)
  })

  it('circlesOverlap：重叠 / 分离', () => {
    expect(circlesOverlap({ x: 5, y: 5 }, 0.6, { x: 6, y: 5 }, 0.6)).toBe(true)
    expect(circlesOverlap({ x: 5, y: 5 }, 0.6, { x: 9, y: 5 }, 0.6)).toBe(false)
  })
})
