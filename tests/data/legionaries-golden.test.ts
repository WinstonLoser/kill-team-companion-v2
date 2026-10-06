import { describe, expect, it } from 'vitest'
import { loadPack, runShooting } from '../../src'
import { ManualDiceSource } from '../../src/dice'
import legionaries from '../../src/data/packs/legionaries.v1.json'

const pack = loadPack(legionaries)

describe('军团兵当前数据包', () => {
  it('包含合法编制、五种逐人印记和可用武器', () => {
    expect(pack.faction.id).toBe('legionaries')
    expect(pack.buildConstraints?.operatives).toEqual({ min: 6, max: 6 })
    expect(pack.buildConstraints?.leaderFrom).toEqual(['aspiring_champion', 'chosen'])
    expect(pack.faction.subFactionSelector?.scope).toBe('perOperative')
    expect(pack.faction.subFactionSelector?.options).toHaveLength(5)
    expect(pack.effects.filter(effect => effect.source.startsWith('markOfChaos:'))).toHaveLength(5)
    for (const op of pack.operatives) {
      for (const id of op.loadouts.flatMap(slot => slot.options.flat())) {
        expect(pack.weapons.some(weapon => weapon.weaponId === id), `${op.operativeId}: ${id}`).toBe(true)
      }
    }
  })

  it('默认爆矢手枪可用当前武器数据完成射击结算', () => {
    const pistol = pack.weapons.find(weapon => weapon.weaponId === 'bolt_pistol')!
    const dice = new ManualDiceSource()
    dice.provide([4, 5, 2, 3, 1, 1, 1])
    const result = runShooting({ attacker: { operativeId: 'a', weapon: pistol }, defender: { operativeId: 'd', save: 6, wounds: 20 }, effects: [], dice, hasCover: false })
    expect(result.woundsDealt).toBe(9)
  })

  it('当前印记为待玩家裁定的效果，不伪称已接入自动结算', () => {
    for (const effect of pack.effects.filter(effect => effect.source.startsWith('markOfChaos:'))) {
      expect(effect.modifier.kind).toBe('CUSTOM_HOOK')
      expect(effect.pipelineStep).toBeTruthy()
    }
    expect(pack.wargear).toHaveLength(4)
  })

  it.each(['mark_khorne', 'mark_nurgle', 'mark_slaanesh', 'mark_tzeentch', 'mark_undivided'])('%s 与逐人选择器、裁定提示一致', id => {
    expect(pack.faction.subFactionSelector?.options).toContain(id)
    const effect = pack.effects.find(item => item.effectId === id)
    expect(effect?.source).toBe(`markOfChaos:${id}`)
    expect(effect?.modifier.kind).toBe('CUSTOM_HOOK')
    if (effect?.modifier.kind === 'CUSTOM_HOOK') expect(effect.modifier.payload.prompt.length).toBeGreaterThan(10)
  })

  it.each(['warding_armour', 'corrupted_ammo', 'chaos_talisman', 'malefic_blade'])('%s 的玩家裁定规则有完整说明', id => {
    expect(pack.wargear?.find(item => item.id === id)?.description?.length).toBeGreaterThan(20)
  })
})
