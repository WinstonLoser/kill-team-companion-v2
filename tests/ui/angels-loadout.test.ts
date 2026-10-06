import { describe, expect, it } from 'vitest'
import angels from '../../src/data/packs/angels_of_death.v1.json'
import { loadPack } from '../../src/rules'
import { chooseLoadoutByKind, legalLoadoutBundles } from '../../src/ui/roster/OperativePicker'

const pack = loadPack(angels)
const operative = (id: string) => pack.operatives.find(item => item.operativeId === id)!

describe('死亡天使分步选武器', () => {
  it('选择等离子手枪时自动匹配链锯剑，不能带动力拳套', () => {
    const op = operative('assault_intercessor_sergeant')
    const plasma = ['capt_plasma_pistol_std', 'capt_plasma_pistol_sup']
    const chosen = chooseLoadoutByKind(pack, op, op.loadouts[0]!.options[1]!, 'RANGED', plasma)
    expect(chosen).toEqual([...plasma, 'assault_sgt_chainsword'])
    expect(legalLoadoutBundles(op)).toContainEqual(chosen)
  })

  it('远程切换时保留仍然兼容的近战武器', () => {
    const op = operative('intercessor_sergeant')
    const current = ['auto_bolt_rifle', 'sgt_power_fist']
    const chosen = chooseLoadoutByKind(pack, op, current, 'RANGED', ['stalker_bolt_rifle_heavy', 'stalker_bolt_rifle_mobile'])
    expect(chosen).toContain('sgt_power_fist')
    expect(legalLoadoutBundles(op)).toContainEqual(chosen)
  })

  it('重装枪手固定携带重型爆矢枪的两种模式和另一把爆矢手枪', () => {
    const bundles = legalLoadoutBundles(operative('heavy_intercessor_gunner'))
    expect(bundles).toEqual([['heavy_bolter_focused', 'heavy_bolter_sweeping', 'bolt_pistol', 'sgt_fists']])
  })
})
