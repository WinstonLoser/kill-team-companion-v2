import { describe, it, expect } from 'vitest'
import rawPack from '../../src/data/packs/chaos_cult.v1.json'
import { loadPack, type FactionPack } from '../../src/rules'
import { evaluateLegality } from '../../src/rules/legality'
import { computeDefaultRoster } from '../../src/ui/roster/OperativePicker'

const pack = loadPack(rawPack) as FactionPack

const op = (id: string) => {
  const o = pack.operatives.find((x) => x.operativeId === id)
  if (!o) throw new Error(`operative not found: ${id}`)
  return o
}
const weapon = (id: string) => {
  const w = pack.weapons.find((x) => x.weaponId === id)
  if (!w) throw new Error(`weapon not found: ${id}`)
  return w
}
const stratagem = (id: string) => {
  const s = (pack.stratagems ?? []).find((x) => x.id === id)
  if (!s) throw new Error(`stratagem not found: ${id}`)
  return s
}
const ability = (id: string) => {
  const a = (pack.abilities ?? []).find((x) => x.abilityId === id)
  if (!a) throw new Error(`ability not found: ${id}`)
  return a
}

describe('混沌教派数据包（2025-07 勘误基线）', () => {
  it('包版本与结构计数', () => {
    expect(pack.packId).toBe('chaos_cult')
    expect(pack.version).toBe('1.1.0')
    expect(pack.rulesetVersion).toBe('kt-lite-1.0')
    expect(pack.operatives).toHaveLength(7)
    expect(pack.weapons).toHaveLength(11)
    expect(pack.abilities).toHaveLength(13)
    expect(pack.stratagems).toHaveLength(8)
    expect(pack.wargear).toHaveLength(4)
    expect(pack.factionRules).toHaveLength(2)
  })

  it('武器 ID 全部唯一（历史缺陷：3×autopistol、2×brutal_melee_weapon）', () => {
    const ids = pack.weapons.map((w) => w.weaponId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each([
    ['cult_demagogue', 2, 6, 5, 8, 32],
    ['blessed_blade', 2, 6, 5, 8, 32],
    ['iconarch', 2, 6, 5, 8, 32],
    ['mindwitch', 2, 6, 5, 8, 32],
    ['chaos_devotee', 2, 6, 5, 7, 25],
    ['chaos_mutant', 2, 6, 5, 7, 25],
    ['chaos_torment', 2, 6, 5, 13, 40],
  ])('数据卡：%s = APL%s M%s S%s+ W%s 底座%smm', (id, apl, move, save, wounds, base) => {
    const o = op(id)
    expect(o.stats).toEqual({ apl, move, save, wounds })
    expect(o.base.diameterMm).toBe(base)
  })

  it('渎神附肢/骇人变异 = Ceaseless + Rending（不是 Relentless）', () => {
    for (const id of ['cc_blasphemous_appendages', 'cc_hideous_mutations']) {
      const rules = weapon(id).profile.weaponRules
      expect(rules).toContain('Ceaseless')
      expect(rules).toContain('Rending')
      expect(rules).not.toContain('Relentless')
    }
  })

  it('燃烧香炉 = Saturate（勘误：原 Concentrate 错误）', () => {
    const rules = weapon('cc_blazing_censer').profile.weaponRules
    expect(rules).toContain('Saturate')
    expect(rules).not.toContain('Concentrate')
  })

  it('两把粗制近战武器面板不同且 ID 不同（徽记 3 攻 / 虔信者 4 攻）', () => {
    const iconarchW = weapon('cc_crude_melee_weapon_iconarch')
    const devoteeW = weapon('cc_crude_melee_weapon_devotee')
    expect(iconarchW.profile.attacks).toBe(3)
    expect(devoteeW.profile.attacks).toBe(4)
  })

  it('地狱凝视（Infernal gaze）面板：5 攻 3+ 0/0 灵能 毁灭2 致命3+', () => {
    const w = weapon('cc_infernal_gaze')
    expect(w.name).toContain('Infernal gaze')
    expect(w.profile.attacks).toBe(5)
    expect(w.profile.hit).toBe(3)
    expect(w.profile.normalDamage).toBe(0)
    expect(w.profile.criticalDamage).toBe(0)
    expect(w.profile.weaponRules).toEqual(expect.arrayContaining(['Psychic', 'Devastating 2', 'Lethal 3+']))
  })

  it('变异规则：转型与治疗互斥 + 每转折点每特工一次 + 上限 5/3', () => {
    const rule = pack.factionRules!.find((r) => r.ruleId === 'mutation')!
    expect(rule.description).toContain('选择一个')
    expect(rule.description).toContain('回复最多 D3+1')
    expect(rule.description).toContain('每个转折点中，每名特工最多进行一次变异')
    expect(rule.description).toContain('5 名变异者和 3 名受难者')
    expect(rule.description).toContain('每个转折点最多以此方式转变两次')
    // 互斥：不允许“自动转型并治疗”的合并描述
    expect(rule.description).not.toMatch(/转变为变异者[^。]*并[^。]*回复/)
  })

  it('强肌：仅忽略受创导致的修正；带刺：流程内首次出击', () => {
    const gifts = pack.factionRules!.find((r) => r.ruleId === 'gifts_of_mutation')!
    const sinew = gifts.options!.find((o) => o.id === 'gift_sinew')!
    expect(sinew.description).toContain('因受创')
    const barbed = gifts.options!.find((o) => o.id === 'gift_barbed')!
    expect(barbed.description).toContain('首次出击')
  })

  it('被诅咒的变异者/受难者：保留操作舱门例外', () => {
    expect(ability('cursed_mutant').description).toContain('操作舱门')
    expect(ability('cursed_torment').description).toContain('操作舱门')
  })

  it('笨重：仍保留掩护豁免（不是完全失去掩护）', () => {
    const c = ability('cumbersome').description
    expect(c).toContain('不能使用轻型地形')
    expect(c).toContain('仍保留掩护豁免')
  })

  it('忠诚追随者：任意黑暗秘社 + 射击/近战 + 掩护继承 + Blast/Torrent 排除', () => {
    const d = stratagem('devoted_followers').description
    expect(d).toContain('黑暗秘社')
    expect(d).toContain('近战')
    expect(d).toContain('掩护或被遮挡')
    expect(d).toContain('爆炸（Blast）')
    expect(d).toContain('洪流（Torrent）')
    expect(stratagem('devoted_followers').phase).toBe('ENGAGEMENT')
  })

  it('憎恶突变：排除所有黑暗秘社 + 每场每特工一次 + 变异后保留', () => {
    const d = stratagem('abominable_mutation').description
    expect(d).toContain('黑暗秘社除外')
    expect(d).toContain('每场战斗每名特工最多')
    expect(d).toContain('仍保留')
  })

  it('噩梦生物：降低所有争夺者 APL 总和；恶心气场：不与受创叠加', () => {
    expect(stratagem('nightmarish_entities').description).toContain('APL 总和')
    expect(stratagem('sickening_aura').description).toContain('不与受创')
  })

  it('4 项交战计谋 phase=ENGAGEMENT，4 项战略计谋 phase=STRATEGY', () => {
    const eng = ['devoted_followers', 'abominable_mutation', 'zealous_demise', 'unleash_the_daemon']
    const strat = ['joy_in_anguish', 'frenzied_onslaught', 'nightmarish_entities', 'sickening_aura']
    for (const id of eng) expect(stratagem(id).phase).toBe('ENGAGEMENT')
    for (const id of strat) expect(stratagem(id).phase).toBe('STRATEGY')
  })

  it('4 项阵营装备收录完整', () => {
    const ids = pack.wargear!.map((w) => w.id)
    expect(ids).toEqual(expect.arrayContaining(['cc_dark_grimoire', 'cc_sly_disguises', 'cc_unclean_talisman', 'cc_foul_blessings']))
    for (const wg of pack.wargear!) expect(wg.description!.length).toBeGreaterThan(10)
  })

  it('超自然再生 effect 可由引擎表达（DAMAGE_MITIGATION 5+）且 rulesRef 指向规则文档', () => {
    const eff = pack.effects.find((e) => e.effectId === 'cc_supernatural_regeneration')!
    expect(eff.modifier).toEqual({ kind: 'DAMAGE_MITIGATION', payload: { threshold: 3, roll: '5+' } })
    expect(eff.rulesRef?.doc).toBe('merged_kt_chaos_cult_zh.md')
  })

  it('建队约束：14 人固定组成 + 变异者/受难者初始不可选', () => {
    const bc = pack.buildConstraints!
    expect(bc.initialRosterIneligible).toEqual(['chaos_mutant', 'chaos_torment'])
    expect(bc.operativeTypeLimits).toEqual({
      cult_demagogue: { min: 1, max: 1 },
      blessed_blade: { min: 2, max: 2 },
      iconarch: { min: 1, max: 1 },
      mindwitch: { min: 1, max: 1 },
      chaos_devotee: { min: 9, max: 9 },
    })
  })

  it('默认阵容 = 恰好 14 人固定组成且合法', () => {
    const def = computeDefaultRoster(pack)
    const counts = new Map<string, number>()
    for (const id of def.operativeIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    expect(def.operativeIds).toHaveLength(14)
    expect(Object.fromEntries(counts)).toEqual({
      cult_demagogue: 1,
      blessed_blade: 2,
      iconarch: 1,
      mindwitch: 1,
      chaos_devotee: 9,
    })
    const r = evaluateLegality({ pack, operativeIds: def.operativeIds, loadout: def.loadout, subFactionSelection: [] })
    expect(r.legal).toBe(true)
  })

  it('合法性：增减任一固定角色或初始加入变异者/受难者 → 违规', () => {
    const base = computeDefaultRoster(pack)
    const minusDevotee = base.operativeIds.slice(0, 13)
    expect(evaluateLegality({ pack, operativeIds: minusDevotee, loadout: base.loadout, subFactionSelection: [] }).legal).toBe(false)

    const extraBlade = [...base.operativeIds, 'blessed_blade']
    expect(evaluateLegality({ pack, operativeIds: extraBlade, loadout: base.loadout, subFactionSelection: [] }).legal).toBe(false)

    const withMutant = [...base.operativeIds, 'chaos_mutant']
    const r = evaluateLegality({ pack, operativeIds: withMutant, loadout: base.loadout, subFactionSelection: [] })
    expect(r.legal).toBe(false)
    expect(r.checks.find((c) => c.key === 'initial-ineligible')?.status).toBe('warn')
  })
})
