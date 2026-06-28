import { describe, it, expect } from 'vitest'
import { runMelee, type MeleeInput } from '../../src/engine'
import { ManualDiceSource } from '../../src/dice'
import type { Weapon } from '../../src/rules'

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
})
