import { describe, it, expect } from 'vitest'
import { withAttachedRules, attachedRules, createShootingResolution, type Weapon } from '../../src/engine'
import type { Effect } from '../../src/rules'
import { ManualDiceSource } from '../../src/dice'

const weapon = (rules: string[] = []): Weapon => ({
  weaponId: 'w',
  name: 'bolter',
  kind: 'RANGED',
  profile: { attacks: 2, hit: 3, normalDamage: 2, criticalDamage: 4, weaponRules: rules },
  keywords: [],
})

const attach = (rule: string): Effect => ({
  effectId: `a-${rule}`,
  label: '附加',
  source: 'wargear',
  trigger: { point: 'BEFORE_HIT_ROLL' },
  pipelineStep: 'HIT_ROLL',
  modifier: { kind: 'ATTACH_WEAPON_RULE', payload: { rule } },
  stacking: { policy: 'UNIQUE_PER_SOURCE' },
})

describe('withAttachedRules — ATTACH_WEAPON_RULE 消费（W3b）', () => {
  it('附加规则并入 profile.weaponRules（去重，附加在后）', () => {
    const w = withAttachedRules(weapon(['PISTOL']), [attach('RAPID_FIRE')])
    expect(w.profile.weaponRules).toEqual(['PISTOL', 'RAPID_FIRE'])
  })

  it('多条附加（不同源）合并', () => {
    const w = withAttachedRules(weapon([]), [attach('RAPID_FIRE'), attach('PIERCING1')])
    expect(w.profile.weaponRules).toEqual(['RAPID_FIRE', 'PIERCING1'])
  })

  it('附加与原规则重复 → 去重', () => {
    const w = withAttachedRules(weapon(['RAPID_FIRE']), [attach('RAPID_FIRE')])
    expect(w.profile.weaponRules).toEqual(['RAPID_FIRE'])
  })

  it('无附加 → 原样返回（引用不变）', () => {
    const base = weapon(['PISTOL'])
    expect(withAttachedRules(base, [])).toBe(base)
  })

  it('attachedRules 仅返回本结算新附加的', () => {
    expect(attachedRules(weapon(['PISTOL']), [attach('RAPID_FIRE')])).toEqual(['RAPID_FIRE'])
    expect(attachedRules(weapon(['RAPID_FIRE']), [attach('RAPID_FIRE')])).toEqual([])
  })
})

describe('WEAPON_SELECT 接线（W3b）', () => {
  it('ATTACH_WEAPON_RULE effect → WEAPON_SELECT 写入 effectiveWeaponRules', () => {
    const dice = new ManualDiceSource()
    dice.provide([4, 5, 2, 3, 1])
    const r = createShootingResolution({
      attacker: { operativeId: 'a', weapon: weapon(['PISTOL']) },
      defender: { operativeId: 'd', save: 4, wounds: 5 },
      effects: [attach('RAPID_FIRE')],
      dice,
      hasCover: false,
      pipelineId: 'shooting',
      attempt: 1,
    })
    r.advance() // WEAPON_SELECT
    expect(r.state.effectiveWeaponRules).toEqual(['PISTOL', 'RAPID_FIRE'])
    expect(r.current()?.summary).toContain('RAPID_FIRE')
  })

  it('无附加 → effectiveWeaponRules = 武器原规则', () => {
    const dice = new ManualDiceSource()
    dice.provide([4, 5, 2, 3, 1])
    const r = createShootingResolution({
      attacker: { operativeId: 'a', weapon: weapon(['PISTOL']) },
      defender: { operativeId: 'd', save: 4, wounds: 5 },
      effects: [],
      dice,
      hasCover: false,
      pipelineId: 'shooting',
      attempt: 1,
    })
    r.advance()
    expect(r.state.effectiveWeaponRules).toEqual(['PISTOL'])
  })
})
