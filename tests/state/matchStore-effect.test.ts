import { describe, it, expect, beforeEach } from 'vitest'
import { useMatchStore } from '../../src/state/matchStore'

// D4：effect 追踪 + TP 结束到期结算（AC3/AC4）。
beforeEach(() => {
  useMatchStore.getState().reset()
  useMatchStore.setState({
    mapPack: {
      mapId: 't', name: 't', version: '1', bounds: { w: 30, h: 20 }, terrain: [],
      objectives: [{ id: 'o', pos: { x: 15, y: 10 }, controlRange: 3 }],
      dropZones: { a: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], b: [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 1 }] },
    },
    tokens: [{ uid: 'a1', side: 'a', opId: 'x', name: 'A1', pos: { x: 0, y: 0 }, facing: 0, baseRadius: 0.6, wounds: 10, maxWounds: 10, alive: true, placed: true }],
  })
})

describe('effect 追踪 + 到期（D4）', () => {
  it('addEffect 写入 + 同 id 刷新 duration', () => {
    const s = useMatchStore.getState()
    s.addEffect('a1', { id: 'poison', label: '毒', durationTP: 2 })
    const s1 = useMatchStore.getState()
    expect(s1.activeEffects.a1).toHaveLength(1)
    expect(s1.activeEffects.a1![0]!.remainingTP).toBe(2)
    s1.addEffect('a1', { id: 'poison', label: '毒', durationTP: 3 })
    const s2 = useMatchStore.getState()
    expect(s2.activeEffects.a1).toHaveLength(1)
    expect(s2.activeEffects.a1![0]!.remainingTP).toBe(3)
  })

  it('tickEffects 递减 remainingTP', () => {
    const s = useMatchStore.getState()
    s.addEffect('a1', { id: 'poison', label: '毒', durationTP: 2 })
    useMatchStore.getState().tickEffects()
    expect(useMatchStore.getState().activeEffects.a1![0]!.remainingTP).toBe(1)
  })

  it('tickEffects 到期移除 + 记日志 + 返回到期数', () => {
    const s = useMatchStore.getState()
    s.addEffect('a1', { id: 'poison', label: '毒', durationTP: 1 })
    const n = s.tickEffects()
    expect(n).toBe(1)
    const after = useMatchStore.getState()
    expect(after.activeEffects.a1).toBeUndefined()
    expect(after.log.some((l) => l.kind === 'system' && l.text.includes('effect 到期'))).toBe(true)
    expect(after.intercept?.title).toContain('effect 到期')
  })

  it('scoreAndEndTP 触发到期结算（D4 AC4 push）', () => {
    const s = useMatchStore.getState()
    s.addEffect('a1', { id: 'stun', label: '震荡', durationTP: 1 })
    s.scoreAndEndTP(() => null)
    const after = useMatchStore.getState()
    expect(after.activeEffects.a1).toBeUndefined()
    expect(after.log.some((l) => l.text.includes('到期'))).toBe(true)
  })
})
