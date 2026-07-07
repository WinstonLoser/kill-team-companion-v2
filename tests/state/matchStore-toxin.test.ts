import { describe, it, expect, beforeEach } from 'vitest'
import { useMatchStore } from '../../src/state/matchStore'

// 端到端：瘟疫攻击方命中 → confirm 后目标挂 POISON 指示物（matchStore marker 追踪 + grant 应用 + 多阵营 effect 栈）。
beforeEach(() => {
  useMatchStore.getState().reset()
  useMatchStore.setState({
    mapPack: {
      mapId: 't', name: 't', version: '1', bounds: { w: 30, h: 20 }, terrain: [],
      objectives: [{ id: 'o', pos: { x: 15, y: 10 }, controlRange: 3 }],
      dropZones: {
        a: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 20 }, { x: 0, y: 20 }],
        b: [{ x: 24, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 24, y: 20 }],
      },
    },
    tokens: [
      { uid: 'a1', side: 'a', opId: 'plg_champion', name: '瘟疫勇士', pos: { x: 2, y: 5 }, facing: 0, baseRadius: 0.63, wounds: 15, maxWounds: 15, markers: [], alive: true, placed: true, order: 'CONCEAL' },
      { uid: 'b1', side: 'b', opId: 'angels_intercessor_warrior', name: '战术兵', pos: { x: 6, y: 5 }, facing: 0, baseRadius: 0.63, wounds: 13, maxWounds: 13, markers: [], alive: true, placed: true, order: 'CONCEAL' },
    ],
  })
})

describe('瘟疫毒素指示物端到端（matchStore marker 追踪）', () => {
  it('攻击命中 → confirm 后目标挂 POISON', () => {
    const s = useMatchStore.getState()
    const r = s.resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' })
    expect(r.ok).toBe(true)
    // confirm 前目标无 POISON
    expect(useMatchStore.getState().tokens.find((t) => t.uid === 'b1')!.markers).not.toContain('POISON')
    useMatchStore.getState().confirmCasualties()
    // confirm 后目标挂 POISON（GRANT_MARKER 经 confirm 应用）
    const b1 = useMatchStore.getState().tokens.find((t) => t.uid === 'b1')!
    expect(b1.markers).toContain('POISON')
    // 日志记挂指示物
    expect(useMatchStore.getState().log.some((l) => l.text.includes('POISON'))).toBe(true)
  })

  it('首次攻击剧毒不生效（目标无 POISON）→ confirm 挂 POISON → 二次攻击剧毒 +1', () => {
    const s = useMatchStore.getState()
    // 第一次攻击：b1 无 POISON → virulent CONDITIONAL 被拒
    const r1 = s.resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' })
    expect(r1.ok).toBe(true)
    const log1 = useMatchStore.getState().currentLog!
    const dmg1 = log1.records.find((rec) => rec.stepId === 'DAMAGE_PER_DIE')!
    expect(dmg1.appliedEffectIds).not.toContain('plg_virulent')
    s.confirmCasualties()
    expect(useMatchStore.getState().tokens.find((t) => t.uid === 'b1')!.markers).toContain('POISON')

    // 第二次攻击：b1 有 POISON → virulent 生效（+1）
    const r2 = useMatchStore.getState().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' })
    expect(r2.ok).toBe(true)
    const dmg2 = useMatchStore.getState().currentLog!.records.find((rec) => rec.stepId === 'DAMAGE_PER_DIE')!
    expect(dmg2.appliedEffectIds).toContain('plg_virulent')
  })
})
