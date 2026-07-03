import { describe, it, expect } from 'vitest'
import { loadPack, runShooting, type Effect } from '../../src'
import { ManualDiceSource } from '../../src/dice'
import { effectiveActionAp } from '../../src/state/turnStateMachine'
import angels from '../../src/data/packs/angels_of_death.v1.json'

const pack = loadPack(angels)
const boltRifle = pack.weapons.find((w) => w.weaponId === 'angels_bolt_rifle')!

const saveOverride: Effect = {
  effectId: 'test_warding',
  label: '守护护甲（save 2+）',
  source: 'wargear:wardingArmour',
  trigger: { point: 'ON_ACTIVATION_START' },
  pipelineStep: 'ACTIVATION_PRE',
  modifier: { kind: 'STAT_OVERRIDE', payload: { stat: 'save', value: 2 } },
  stacking: { policy: 'UNIQUE_PER_SOURCE' },
}

const mobileEffect: Effect = {
  effectId: 'chapterTactic_mobile',
  label: '机动（后撤少1AP）',
  source: 'chapterTactic:mobile',
  trigger: { point: 'ON_ACTIVATION_START' },
  pipelineStep: 'ACTIVATION_PRE',
  modifier: { kind: 'ACTION_AP_MOD', payload: { action: 'FALL_BACK', delta: -1 } },
  stacking: { policy: 'UNIQUE_PER_SOURCE' },
}

function shoot(defenderEffects: Effect[]) {
  const dice = new ManualDiceSource()
  dice.provide([4, 5, 2, 3, 1, 1]) // atk 3: 2 hit; def 3: [3,1,1]
  return runShooting({
    attacker: { operativeId: 'a', weapon: boltRifle },
    defender: { operativeId: 'd', save: 6, wounds: 20 },
    effects: [], defenderEffects, dice, hasCover: false,
  })
}

describe('5-1 STAT_OVERRIDE（save 覆写）', () => {
  it('基线：save 6+ → 防御 [3,1,1] 无成功 → 造伤 6', () => {
    expect(shoot([]).woundsDealt).toBe(6)
  })

  it('守护护甲 save 2+ → 防御 [3,1,1] 中 3 成功 → 挡 1 → 造伤 3', () => {
    const r = shoot([saveOverride])
    expect(r.woundsDealt).toBe(3)
  })
})

describe('5-1 ACTION_AP_MOD（activation AP）', () => {
  it('后撤 base AP=2', () => {
    expect(effectiveActionAp('FALL_BACK', 2, [])).toBe(2)
  })

  it('chapterTactic_mobile → 后撤 AP 2-1=1', () => {
    expect(effectiveActionAp('FALL_BACK', 2, [mobileEffect])).toBe(1)
  })

  it('其他行动不受影响', () => {
    expect(effectiveActionAp('SHOOT', 1, [mobileEffect])).toBe(1) // 不匹配 FALL_BACK
  })
})
