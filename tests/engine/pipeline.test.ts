import { describe, it, expect } from 'vitest'
import { runShooting } from '../../src/engine'
import { ManualDiceSource } from '../../src/dice'
import type { Effect, Weapon } from '../../src/rules'
import type { ShootInput } from '../../src/engine'

const weapon: Weapon = {
  weaponId: 'w',
  name: 'test-gun',
  kind: 'RANGED',
  profile: { attacks: 4, hit: 3, normalDamage: 3, criticalDamage: 4, weaponRules: [] },
  keywords: [],
}

function mkInput(over: Partial<ShootInput> & { diceSeq: number[] }): ShootInput {
  const dice = new ManualDiceSource()
  dice.provide(over.diceSeq)
  return {
    attacker: { operativeId: 'a', weapon },
    defender: over.defender ?? { operativeId: 'd', save: 4, wounds: 5 },
    effects: over.effects ?? [],
    dice,
    hasCover: over.hasCover ?? false,
  }
}

const mitigationEffect: Effect = {
  effectId: 'mit',
  label: '恼人韧性',
  source: 'test',
  trigger: { point: 'ON_DAMAGE_TOTAL' },
  pipelineStep: 'DAMAGE_TOTAL_MITIGATE',
  modifier: { kind: 'DAMAGE_MITIGATION', payload: { threshold: 3, roll: '5+' } },
  stacking: { policy: 'STACKABLE' },
}

describe('runShooting 射击流水线', () => {
  it('基本：攻击4 hit3+ → 2普通+1关键，无防御成功，造10伤致残', () => {
    // attack [4,5,2,6] → 2N+1C ; defence [2,3,1] → 0
    const r = runShooting(mkInput({ diceSeq: [4, 5, 2, 6, 2, 3, 1] }))
    expect(r.remaining).toEqual({ normalSuccess: 2, criticalSuccess: 1 })
    expect(r.woundsDealt).toBe(10) // 2*3 + 1*4
    expect(r.defenderIncapacitated).toBe(true)
    expect(r.traces).toHaveLength(10)
  })

  it('掩护：+1 普通防御成功抵消 1 普通 → 少 3 伤', () => {
    const r = runShooting(mkInput({ diceSeq: [4, 5, 2, 6, 2, 3, 1], hasCover: true }))
    // defNormal 0 +1 cover → 1；挡 1 普通 → 剩 1N+1C = 3+4=7
    expect(r.woundsDealt).toBe(7)
  })

  it('减伤：DAMAGE_MITIGATION 减 1', () => {
    const r = runShooting(
      mkInput({ diceSeq: [4, 5, 2, 6, 2, 3, 1], effects: [mitigationEffect] }),
    )
    expect(r.woundsDealt).toBe(9) // 10 - 1
    expect(r.traces[8]?.stepId).toBe('DAMAGE_TOTAL_MITIGATE')
  })

  it('PIERCE 减防御骰', () => {
    const pierce: Effect = {
      effectId: 'p', label: 't', source: 'test',
      trigger: { point: 'BEFORE_DEFENCE_ROLL' }, pipelineStep: 'DEFENCE_ROLL',
      modifier: { kind: 'PIERCE', payload: { amount: 1 } }, stacking: { policy: 'STACKABLE' },
    }
    // attack [4,5,2,6]; defence 仅 2 颗 [2,3]（pierce-1）
    const r = runShooting(mkInput({ diceSeq: [4, 5, 2, 6, 2, 3], effects: [pierce] }))
    expect(r.traces[4]?.summary).toContain('防御骰2')
  })
})
