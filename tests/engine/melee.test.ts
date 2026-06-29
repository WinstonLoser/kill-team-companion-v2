import { describe, it, expect } from 'vitest'
import { runMelee, type MeleeInput } from '../../src/engine'
import { ManualDiceSource } from '../../src/dice'
import type { Weapon, Effect } from '../../src/rules'

const meleeWeapon = (over: Partial<Weapon['profile']> = {}): Weapon => ({
  weaponId: 'mw',
  name: 'chainsword',
  kind: 'MELEE',
  profile: { attacks: 3, hit: 3, normalDamage: 3, criticalDamage: 4, weaponRules: [], ...over },
  keywords: [],
})

function mkInput(diceSeq: number[], over: Partial<MeleeInput> = {}): MeleeInput {
  const dice = new ManualDiceSource()
  dice.provide(diceSeq)
  return {
    attacker: { operativeId: 'a', weapon: meleeWeapon(), save: 4, wounds: 5 },
    defender: { operativeId: 'd', weapon: meleeWeapon(), save: 4, wounds: 5 },
    effects: [],
    dice,
    ...over,
  }
}

describe('runMelee 近战流水线', () => {
  it('7 step trace', () => {
    const r = runMelee(mkInput([4, 5, 2, 1, 2, 3]))
    expect(r.traces).toHaveLength(7)
  })

  it('攻击方命中、防御方全失败 → 防御方承伤', () => {
    // attacker [4,5,6] → 2N+1C；defender [1,2,2] → 0
    const r = runMelee(mkInput([4, 5, 6, 1, 2, 2]))
    expect(r.woundsToDefender).toBe(2 * 3 + 1 * 4) // 10
    expect(r.woundsToAttacker).toBe(0)
    expect(r.defenderIncapacitated).toBe(true)
  })

  it('双方互格挡抵消', () => {
    // attacker [4,5,6]→2N+1C；defender [4,5,6]→2N+1C；互格挡后双方 0 剩余
    const r = runMelee(mkInput([4, 5, 6, 4, 5, 6]))
    expect(r.woundsToDefender).toBe(0)
    expect(r.woundsToAttacker).toBe(0)
  })

  it('互斥减伤被拒进 rejectedEffectIds（P2-trace）', () => {
    const m1: Effect = {
      effectId: 'm1', label: '减伤甲', source: 'src',
      trigger: { point: 'ON_DAMAGE_TOTAL' }, pipelineStep: 'MELEE_DAMAGE_AND_MITIGATE',
      modifier: { kind: 'DAMAGE_MITIGATION', payload: { threshold: 3, roll: '5+' } },
      stacking: { policy: 'MUTUALLY_EXCLUSIVE_WITH', groupKeys: ['mit'] }, priority: 10,
    }
    const m2: Effect = {
      effectId: 'm2', label: '减伤乙', source: 'src',
      trigger: { point: 'ON_DAMAGE_TOTAL' }, pipelineStep: 'MELEE_DAMAGE_AND_MITIGATE',
      modifier: { kind: 'DAMAGE_MITIGATION', payload: { threshold: 3, roll: '5+' } },
      stacking: { policy: 'MUTUALLY_EXCLUSIVE_WITH', groupKeys: ['mit'] }, priority: 5,
    }
    const r = runMelee(mkInput([4, 5, 6, 1, 2, 2], { effects: [m1, m2] }))
    const dmgStep = r.traces.find((t) => t.stepId === 'MELEE_DAMAGE_AND_MITIGATE')!
    expect(dmgStep.appliedEffectIds).toEqual(['m1'])
    expect(dmgStep.rejectedEffectIds).toHaveLength(1)
    expect(dmgStep.rejectedEffectIds[0]?.id).toBe('m2')
  })
})
