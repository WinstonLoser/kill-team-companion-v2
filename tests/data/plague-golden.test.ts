import { describe, expect, it } from 'vitest'
import { loadPack, runShooting } from '../../src'
import { ManualDiceSource } from '../../src/dice'
import plague from '../../src/data/packs/plague_marines.v1.json'

const pack = loadPack(plague)

describe('瘟疫战士当前数据包', () => {
  it('包含六人编制、七种特工和四项整队装备', () => {
    expect(pack.faction.id).toBe('plague_marines')
    expect(pack.faction.subFactionSelector).toBeUndefined()
    expect(pack.buildConstraints?.operatives).toEqual({ min: 6, max: 6 })
    expect(pack.buildConstraints?.leaderFrom).toEqual(['champion'])
    expect(pack.operatives).toHaveLength(7)
    expect(pack.wargear).toHaveLength(4)
    expect(pack.stratagems).toHaveLength(8)
  })

  it('卡面武器引用全部存在，瘟疫剑保留当前武器规则', () => {
    for (const op of pack.operatives) {
      for (const id of op.loadouts.flatMap(slot => slot.options.flat())) {
        expect(pack.weapons.some(weapon => weapon.weaponId === id), `${op.operativeId}: ${id}`).toBe(true)
      }
    }
    expect(pack.weapons.find(weapon => weapon.weaponId === 'plague_sword')?.profile.weaponRules).toEqual(expect.arrayContaining(['Severe', 'Poison', 'Toxic']))
  })

  it('当前爆矢枪可按卡面伤害完成基础射击结算', () => {
    const boltgun = pack.weapons.find(weapon => weapon.weaponId === 'boltgun')!
    const dice = new ManualDiceSource()
    dice.provide([4, 5, 2, 3, 1, 1, 1])
    const result = runShooting({ attacker: { operativeId: 'a', weapon: boltgun }, defender: { operativeId: 'd', save: 6, wounds: 20 }, effects: [], dice, hasCover: false })
    expect(result.woundsDealt).toBe(9)
  })

  it('未在数据包实现的毒素效果不被错误视为自动结算', () => {
    expect(pack.effects).toHaveLength(0)
    expect(pack.wargear?.find(item => item.id === 'mucus_exit')?.description).toContain('D3')
  })

  it.each(['plague_bell', 'blight_grenade', 'plague_ammo', 'mucus_exit'])('%s 的整队装备规则可供玩家裁定', id => {
    expect(pack.wargear?.find(item => item.id === id)?.description?.length).toBeGreaterThan(20)
  })

  it.each(['cloud_of_flies', 'nurglings', 'contagion', 'lumbering_death', 'sickening_resilience', 'curse_of_rot', 'virulent_poison', 'poisonous_demise'])('%s 计谋保留时点与费用', id => {
    const stratagem = pack.stratagems?.find(item => item.id === id)
    expect(stratagem?.cp).toBe(1)
    expect(['STRATEGY', 'FIREFIGHT']).toContain(stratagem?.phase)
    expect(stratagem?.description?.length).toBeGreaterThan(20)
  })
})
