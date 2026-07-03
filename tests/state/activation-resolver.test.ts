import { describe, it, expect } from 'vitest'
import { resolveActivationEffects, type WargearHolder, type ActivationEffectContext } from '../../src/state/activationResolver'
import { ManualDiceSource } from '../../src/dice'
import { loadPack, type Effect } from '../../src'
import plague from '../../src/data/packs/plague_marines.v1.json'

const pack = loadPack(plague)
const grantEff = pack.effects.find((e) => e.effectId === 'wargear_mucus_exit_grant')! as Effect
const dmgEff = pack.effects.find((e) => e.effectId === 'wargear_mucus_exit_damage')! as Effect

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
