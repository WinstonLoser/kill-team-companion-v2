import { describe, it, expect } from 'vitest'
import { loadPack, runShooting, type Effect } from '../../src'
import { ManualDiceSource } from '../../src/dice'
import legionaries from '../../src/data/packs/legionaries.v1.json'

const pack = loadPack(legionaries)
const boltPistol = pack.weapons.find((w) => w.weaponId === 'leg_bolt_pistol')!
const swiftSpeed = pack.effects.find((e) => e.effectId === 'strat_swift_speed')! as Effect
const capriciousFate = pack.effects.find((e) => e.effectId === 'strat_capricious_fate')! as Effect

function shoot(defEffects: Effect[]) {
  const dice = new ManualDiceSource()
  dice.provide([4, 5, 2, 3, 4, 1, 1])
  return runShooting({
    attacker: { operativeId: 'a', weapon: boltPistol },
    defender: { operativeId: 'd', save: 4, wounds: 20 },
    effects: [], defenderEffects: defEffects, dice, hasCover: false,
  })
}

describe('5-3 stratagem tracking（defenderEffects real）', () => {
  it('swift_speed 已转 HIT_MINUS', () => {
    expect(swiftSpeed.modifier.kind).toBe('HIT_MINUS')
  })

  it('swift_speed 作 defenderEffect → HIT_ROLL trace applied 含该 effect', () => {
    const r = shoot([swiftSpeed])
    const hit = r.traces.find((t) => t.stepId === 'HIT_ROLL')!
    expect(hit.appliedEffectIds).toContain('strat_swift_speed')
  })

  it('capricious_fate 已转 UPGRADE_SUCCESS', () => {
    expect(capriciousFate.modifier.kind).toBe('UPGRADE_SUCCESS')
  })

  it('capricious_fate 作 defenderEffect → DEFENCE_UPGRADE trace applied 含该 effect', () => {
    const r = shoot([capriciousFate])
    const def = r.traces.find((t) => t.stepId === 'DEFENCE_UPGRADE')!
    expect(def.appliedEffectIds).toContain('strat_capricious_fate')
  })
})
