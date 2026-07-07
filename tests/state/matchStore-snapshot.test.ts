import { describe, it, expect, beforeEach } from 'vitest'
import { useMatchStore } from '../../src/state/matchStore'

// D3：会话内全局回退（确认伤亡/计分前快照；回滚到此恢复棋盘+VP+回合）+ ▶回放。
beforeEach(() => {
  useMatchStore.getState().reset()
  useMatchStore.setState({
    mapPack: {
      mapId: 't', name: 't', version: '1', bounds: { w: 30, h: 20 }, terrain: [],
      objectives: [{ id: 'o', pos: { x: 15, y: 10 }, controlRange: 3 }],
      dropZones: { a: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], b: [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 1 }] },
    },
    tokens: [
      { uid: 'a1', side: 'a', opId: 'x', name: 'A1', pos: { x: 0, y: 0 }, facing: 0, baseRadius: 0.6, wounds: 10, maxWounds: 10, markers: [], alive: true, placed: true, order: 'CONCEAL' },
      { uid: 'b1', side: 'b', opId: 'x', name: 'B1', pos: { x: 5, y: 0 }, facing: 0, baseRadius: 0.6, wounds: 10, maxWounds: 10, markers: [], alive: true, placed: true, order: 'CONCEAL' },
    ],
  })
})

describe('快照回退 + 回放（D3）', () => {
  it('pushSnapshot 存档；rewindToSnapshot 恢复 tokens/vp/turn', () => {
    const s = useMatchStore.getState()
    s.pushSnapshot('前')
    // 改一些状态
    useMatchStore.setState({ vp: { a: 5, b: 3 } })
    useMatchStore.getState().applyDamage('a1', 4)
    expect(useMatchStore.getState().tokens.find((t) => t.uid === 'a1')!.wounds).toBe(6)
    // 回退
    const snap = useMatchStore.getState().snapshots[0]!
    useMatchStore.getState().rewindToSnapshot(snap.id)
    const after = useMatchStore.getState()
    expect(after.tokens.find((t) => t.uid === 'a1')!.wounds).toBe(10)
    expect(after.vp).toEqual({ a: 0, b: 0 })
  })

  it('rewind 后丢弃其后快照 + 记回退日志', () => {
    const s = useMatchStore.getState()
    s.pushSnapshot('第一')
    s.pushSnapshot('第二')
    const first = useMatchStore.getState().snapshots[0]!
    useMatchStore.getState().rewindToSnapshot(first.id)
    const after = useMatchStore.getState()
    expect(after.snapshots).toHaveLength(0) // 第一之后的（含第二）都丢
    expect(after.log.some((l) => l.text.includes('回退'))).toBe(true)
  })

  it('confirmCasualties 存快照 + 设 replayLog；replayLast 重展', () => {
    const s = useMatchStore.getState()
    // 模拟一次待确认结算
    useMatchStore.setState({
      lastShot: { targetUid: 'b1', targetName: 'B1', woundsDealt: 3, prevWounds: 10, attackerUid: 'a1', kind: 'shoot' },
      currentLog: { resolutionId: 'r1', pipelineKind: 'SHOOTING', records: [{ stepId: 'HIT_ROLL', summary: 'x', appliedEffectIds: [], rejectedEffectIds: [] }], cursor: 1, inputSnapshot: {} as never, result: {} as never },
    })
    s.confirmCasualties()
    const after = useMatchStore.getState()
    expect(after.snapshots.length).toBeGreaterThanOrEqual(1)
    expect(after.replayLog).not.toBeNull()
    expect(after.lastShot).toBeNull()
    // 伤害已应用
    expect(after.tokens.find((t) => t.uid === 'b1')!.wounds).toBe(7)
    // 回放：重展 replayLog 到 currentLog
    after.replayLast()
    expect(useMatchStore.getState().currentLog).not.toBeNull()
  })
})
