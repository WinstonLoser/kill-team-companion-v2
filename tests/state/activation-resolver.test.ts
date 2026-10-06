import { describe, it, expect } from 'vitest'
import { resolveActivationEffects, type WargearHolder, type ActivationEffectContext } from '../../src/state/activationResolver'
import { ManualDiceSource } from '../../src/dice'
import type { Effect } from '../../src'

// 当前瘟疫包保留装备文字，激活层的条件路由用显式描述符做单元测试。
const grantEff: Effect = {
  effectId: 'test_mucus_grant', label: '排毒口：挂毒', source: 'test',
  trigger: { point: 'ON_ACTIVATION_START', condition: { op: 'all', all: [{ op: 'dieFaceEquals', args: [3] }, { op: 'targetHasNoMarker', args: ['POISON'] }] } },
  pipelineStep: 'ACTIVATION_PRE', modifier: { kind: 'GRANT_MARKER', payload: { marker: 'POISON', target: 'DEFENDER' } }, stacking: { policy: 'CONDITIONAL' },
}
const dmgEff: Effect = {
  effectId: 'test_mucus_damage', label: '排毒口：伤害', source: 'test',
  trigger: { point: 'ON_ACTIVATION_START', condition: { op: 'targetHasMarker', args: ['POISON'] } },
  pipelineStep: 'ACTIVATION_PRE', modifier: { kind: 'EXTRA_DAMAGE_ON_HIT', payload: { amount: 1 } }, stacking: { policy: 'CONDITIONAL' },
}

function makeCtx(activatorMarkers: string[], diceSeq: number[]): ActivationEffectContext {
  const holders: WargearHolder[] = [{
    uid: 'enemy1', pos: { x: 5, y: 5 }, side: 'b',
    effects: [grantEff, dmgEff],
  }]
  const dice = new ManualDiceSource()
  dice.provide(diceSeq)
  return {
    activatorUid: 'a1',
    activatorPos: { x: 6, y: 5 }, // 1" 内
    activatorMarkers,
    holders,
    dice,
    turningPoint: 1,
  }
}

describe('5-6 激活层 effect resolver（mucus_exit）', () => {
  it('D3=3 且目标无 POISON → 挂 POISON', () => {
    // grant rolls D3=nat3→3 (triggered, GRANT_MARKER), damage rolls D3=nat3→3 (not triggered, has no POISON)
    const r = resolveActivationEffects(makeCtx([], [3, 3]))
    expect(r.markersGranted).toEqual([{ targetUid: 'a1', marker: 'POISON' }])
    expect(r.damageDealt).toEqual([])
    expect(r.trace.some((t) => t.triggered)).toBe(true)
  })

  it('D3=1 且目标无 POISON → 未触发', () => {
    const r = resolveActivationEffects(makeCtx([], [1, 1]))
    expect(r.markersGranted).toEqual([])
    expect(r.damageDealt).toEqual([])
  })

  it('D3=3 且目标已有 POISON → D3 伤', () => {
    // grant: D3=3, but targetHasNoMarker false → not triggered (consumes 1 die)
    // damage: D3=3, targetHasMarker true → triggered, rolls D3 for dmg: nat=5→D3=2
    const r = resolveActivationEffects(makeCtx(['POISON'], [3, 3, 5]))
    expect(r.markersGranted).toEqual([])
    expect(r.damageDealt.length).toBe(1)
    expect(r.damageDealt[0]!.amount).toBe(2)
  })

  it('距离 > 3" → 不触发', () => {
    const ctx = makeCtx([], [3])
    ctx.holders[0]!.pos = { x: 20, y: 20 } // 远
    const r = resolveActivationEffects(ctx)
    expect(r.markersGranted).toEqual([])
    expect(r.damageDealt).toEqual([])
    expect(r.trace).toEqual([])
  })
})
