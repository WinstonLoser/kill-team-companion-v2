import { describe, it, expect } from 'vitest'
import { loadPack, runShooting, type Effect } from '../../src'
import { ManualDiceSource } from '../../src/dice'
import legionaries from '../../src/data/packs/legionaries.v1.json'

const pack = loadPack(legionaries)
const boltPistol = pack.weapons.find((w) => w.weaponId === 'bolt_pistol')!
const swiftSpeed: Effect = { effectId: 'test_swift_speed', label: '速度测试', source: 'test', trigger: { point: 'BEFORE_HIT_ROLL' }, pipelineStep: 'HIT_ROLL', modifier: { kind: 'HIT_MINUS', payload: { amount: 1 } }, stacking: { policy: 'UNIQUE_PER_SOURCE' } }
const capriciousFate: Effect = { effectId: 'test_capricious_fate', label: '命运测试', source: 'test', trigger: { point: 'AFTER_DEFENCE_ROLL' }, pipelineStep: 'DEFENCE_UPGRADE', modifier: { kind: 'UPGRADE_SUCCESS', payload: {} }, stacking: { policy: 'UNIQUE_PER_SOURCE' } }

function shoot(defEffects: Effect[]) {
  const dice = new ManualDiceSource()
  dice.provide([4, 5, 2, 3, 4, 1, 1])
  return runShooting({
    attacker: { operativeId: 'a', weapon: boltPistol },
    defender: { operativeId: 'd', save: 4, wounds: 20 },
    effects: [], defenderEffects: defEffects, dice, hasCover: false,
  })
}

describe('5-3 defenderEffects tracking', () => {
  it('当前计谋清单保留，但未误生成旧版 effect', () => {
    expect(pack.stratagems?.some(s => s.id === 'quicksilver_speed')).toBe(true)
    expect(pack.effects.some(e => e.effectId === 'strat_swift_speed')).toBe(false)
  })

  it('显式 HIT_MINUS effect 描述符有效', () => {
    expect(swiftSpeed.modifier.kind).toBe('HIT_MINUS')
  })

  it('HIT_MINUS 作 defenderEffect → HIT_ROLL trace applied', () => {
    const r = shoot([swiftSpeed])
    const hit = r.traces.find((t) => t.stepId === 'HIT_ROLL')!
    expect(hit.appliedEffectIds).toContain('test_swift_speed')
  })

  it('显式 UPGRADE_SUCCESS effect 描述符有效', () => {
    expect(capriciousFate.modifier.kind).toBe('UPGRADE_SUCCESS')
  })

  it('UPGRADE_SUCCESS 作 defenderEffect → DEFENCE_UPGRADE trace applied', () => {
    const r = shoot([capriciousFate])
    const def = r.traces.find((t) => t.stepId === 'DEFENCE_UPGRADE')!
    expect(def.appliedEffectIds).toContain('test_capricious_fate')
  })
})
