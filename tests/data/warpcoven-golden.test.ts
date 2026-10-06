import { describe, it, expect } from 'vitest'
import rawPack from '../../src/data/packs/warpcoven.v1.json'
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

const SORCERERS = ['wc_sorcerer_destiny', 'wc_sorcerer_time', 'wc_sorcerer_warpfire']
const TZAANGORS = ['wc_tzaangor_champion', 'wc_tzaangor_horn_bearer', 'wc_tzaangor_icon_bearer', 'wc_tzaangor_warrior']
const RUBRICS = ['wc_rubric_gunner', 'wc_rubric_icon_bearer', 'wc_rubric_warrior']

describe('次元密会数据包（2026-04 勘误基线）', () => {
  it('包结构与数量：10 特工 / 9 恩惠 / 8 计谋 / 4 装备 / 20 武器', () => {
    expect(pack.packId).toBe('warpcoven')
    expect(pack.version).toBe('1.0.0')
    expect(pack.rulesetVersion).toBe('kt-lite-1.0')
    expect(pack.operatives).toHaveLength(10)
    expect(pack.effects.filter((e) => e.effectId.startsWith('boon_'))).toHaveLength(9)
    expect(pack.stratagems).toHaveLength(8)
    expect(pack.wargear).toHaveLength(4)
    expect(pack.weapons).toHaveLength(20)
  })

  it('2026-04 勘误数值：巫师 15 耐伤、红字 2+ 豁免、弯刀 5 攻无 Balanced、裁决闪电 4/2', () => {
    for (const id of SORCERERS) {
      expect(op(id).stats, id).toMatchObject({ apl: 3, move: 6, save: 3, wounds: 15 })
      expect(op(id).base.diameterMm).toBe(32)
    }
    for (const id of RUBRICS) {
      expect(op(id).stats, id).toMatchObject({ apl: 3, move: 5, save: 2, wounds: 14 })
    }
    const khopesh = weapon('wc_prosperine_khopesh')
    expect(khopesh.profile.attacks).toBe(5)
    expect(khopesh.profile.weaponRules).not.toContain('Balanced')
    const doombolt = weapon('wc_doombolt')
    expect(doombolt.profile.normalDamage).toBe(4)
    expect(doombolt.profile.criticalDamage).toBe(2)
  })

  it.each([
    ['wc_tzaangor_champion', 2, 6, 5, 10],
    ['wc_tzaangor_horn_bearer', 2, 6, 5, 9],
    ['wc_tzaangor_icon_bearer', 2, 6, 5, 9],
    ['wc_tzaangor_warrior', 2, 6, 5, 9],
  ])('奸角兽数据卡：%s = APL%s M%s S%s+ W%s', (id, apl, move, save, wounds) => {
    expect(op(id).stats).toEqual({ apl, move, save, wounds })
  })

  it('三类巫师共享通用武器选项，但专属灵能武器正确', () => {
    for (const id of SORCERERS) {
      const wizardSlot = op(id).loadouts.find((l) => l.description.includes('三选一'))!
      expect(wizardSlot.options.map((o) => o[0])).toEqual(['wc_inferno_bolt_pistol', 'wc_prosperine_khopesh', 'wc_warpfire_pistol'])
    }
    const sig = (id: string) => op(id).loadouts[0]!.options[0]!
    expect(sig('wc_sorcerer_destiny')).toContain('wc_doombolt')
    expect(sig('wc_sorcerer_time')).toContain('wc_warp_torrent')
    expect(sig('wc_sorcerer_warpfire')).toEqual(expect.arrayContaining(['wc_flamestorm', 'wc_immolate_sanity']))
    // 每名巫师均装备灵能杖
    for (const id of SORCERERS) expect(sig(id)).toContain('wc_force_stave')
  })

  it('关键武器面板：灵魂收割者炮双档案 / 亚空间火焰喷射器 / 焚却理智（Seek Light）', () => {
    expect(weapon('wc_soulreaper_focused').profile.attacks).toBe(5)
    expect(weapon('wc_soulreaper_sweeping').profile.weaponRules).toEqual(expect.arrayContaining(['Piercing 1', 'Torrent 1"']))
    const flamer = weapon('wc_warpflamer')
    expect(flamer.profile.hit).toBe(2)
    expect(flamer.profile.weaponRules).toEqual(expect.arrayContaining(['Saturate', 'Piercing 1', 'Torrent 2"']))
    expect(weapon('wc_immolate_sanity').profile.weaponRules).toContain('Seek Light')
    expect(weapon('wc_flamestorm').profile.weaponRules).toContain('Seek Light')
    expect(weapon('wc_autopistol').profile.range).toBe(8)
  })

  it('炮手装备二选一：火焰喷射器+双拳 或 灵魂收割者炮（双档案）+双拳', () => {
    const slot = op('wc_rubric_gunner').loadouts[0]!
    expect(slot.options).toEqual([
      ['wc_soulreaper_focused', 'wc_soulreaper_sweeping', 'wc_fists'],
      ['wc_warpflamer', 'wc_fists'],
    ])
  })

  it('奸角兽战士装备三选一：双刃 / 之刃和盾牌 / 自动手枪+链锯剑', () => {
    const slot = op('wc_tzaangor_warrior').loadouts[0]!
    expect(slot.options).toEqual([
      ['wc_tzaangor_twinstrike'],
      ['wc_tzaangor_blade_and_shield'],
      ['wc_autopistol', 'wc_chainsword'],
    ])
  })

  it('中英差异修正已入数据：无常计划（并且/或者）、蹂躏命运（所有 APL 变化叠加）、巫术卷轴（亚空间残响即时处理）', () => {
    const fickle = (pack.stratagems ?? []).find((s) => s.id === 'fickle_plans')!
    expect(fickle.description).toContain('并且/或者')
    const trample = (pack.abilities ?? []).find((a) => a.abilityId === 'trample_fate')!
    expect(trample.description).toContain('所有其他 APL 变化均与本效果叠加')
    const scroll = pack.wargear!.find((w) => w.id === 'wc_witchscroll')!
    expect(scroll.description).toContain('亚空间残响')
    const mutatedLimb = pack.effects.find((e) => e.effectId === 'boon_mutated_limb')!
    expect(mutatedLimb.modifier).toMatchObject({ kind: 'CUSTOM_HOOK', payload: { hookId: 'boon_mutated_limb' } })
    expect((mutatedLimb.modifier as { payload: { prompt: string } }).payload.prompt).toContain('放置标识')
    const ammo = pack.wargear!.find((w) => w.id === 'wc_enchanted_ammunition')!
    expect(ammo.description).toContain('次元密会')
  })

  it('恩惠选择器：perOperative + 仅巫师 + 必选 1 + 整队不重复', () => {
    const sel = pack.faction.subFactionSelector!
    expect(sel.scope).toBe('perOperative')
    expect(sel.eligibleKeywords).toEqual(['SORCERER'])
    expect(sel.requiredPerEligible).toBe(1)
    expect(sel.uniqueAcrossTeam).toBe(true)
    expect(sel.options).toHaveLength(9)
  })

  it('恩惠 effect 全部带 rulesRef 且四问完整（loader 已保证四问）', () => {
    for (const e of pack.effects) {
      expect(e.rulesRef?.doc).toBe('merged_kt_warpcoven_zh.md')
    }
  })

  it('4 战略 + 4 交战计谋 phase 正确', () => {
    const byPhase = (p: string) => (pack.stratagems ?? []).filter((s) => s.phase === p).map((s) => s.id)
    expect(byPhase('STRATEGY').sort()).toEqual(['aetheric_ward', 'brotherhood_of_sorcerers', 'savage_herd', 'your_fate_my_weapon'].sort())
    expect(byPhase('ENGAGEMENT').sort()).toEqual(['all_is_dust', 'fickle_plans', 'mutated_herd', 'psychic_cabal'].sort())
  })

  it('建队约束：恰好 5 点、奸角兽 0.5、至少 1 巫师、装备上限', () => {
    const bc = pack.buildConstraints!
    expect(bc.selectionPoints).toEqual({ exact: 5 })
    for (const id of TZAANGORS) expect(bc.operativeCosts![id]).toBe(0.5)
    expect(bc.minimumByKeyword).toEqual({ SORCERER: 1 })
    expect(bc.equipmentLimits).toEqual({ wc_warpfire_pistol: 1, wc_soulreaper_focused: 1, wc_soulreaper_sweeping: 1 })
  })

  it('默认阵容合法：恰好 5 点、含巫师、恩惠已分配且不重复', () => {
    const def = computeDefaultRoster(pack)
    const r = evaluateLegality({
      pack,
      operativeIds: def.operativeIds,
      loadout: def.loadout,
      subFactionSelection: [],
      perOperativeMarks: def.perOperativeMarks,
    })
    expect(r.legal).toBe(true)
    const cost = def.operativeIds.reduce((s, id) => s + (pack.buildConstraints!.operativeCosts?.[id] ?? 1), 0)
    expect(cost).toBe(5)
    expect(def.operativeIds.some((id) => op(id).keywords.includes('SORCERER'))).toBe(true)
    const markValues = Object.values(def.perOperativeMarks)
    expect(new Set(markValues).size).toBe(markValues.length)
  })

  it('合法性：4.5 点 → 违规；无巫师 → 违规；非战士重复 → 违规', () => {
    const mk = (ids: string[]) => evaluateLegality({ pack, operativeIds: ids, loadout: {}, subFactionSelection: [] })
    // 4.5 点
    let r = mk(['wc_sorcerer_destiny', 'wc_sorcerer_time', 'wc_rubric_gunner', 'wc_rubric_icon_bearer', 'wc_tzaangor_champion'])
    expect(r.checks.find((c) => c.key === 'selection-points')?.status).toBe('warn')
    // 5 点但无巫师
    r = mk(['wc_rubric_gunner', 'wc_rubric_icon_bearer', 'wc_rubric_warrior', 'wc_rubric_warrior', 'wc_tzaangor_champion'])
    expect(r.checks.find((c) => c.key === 'keyword-min')?.status).toBe('warn')
    // 非战士重复
    r = mk(['wc_sorcerer_destiny', 'wc_rubric_gunner', 'wc_rubric_gunner', 'wc_tzaangor_champion', 'wc_tzaangor_warrior'])
    expect(r.checks.find((c) => c.key === 'per-type')?.status).toBe('warn')
  })

  it('合法性：两把亚空间炽焰手枪 → 装备超限', () => {
    const r = evaluateLegality({
      pack,
      operativeIds: ['wc_sorcerer_destiny', 'wc_sorcerer_time', 'wc_rubric_gunner', 'wc_rubric_warrior', 'wc_tzaangor_champion'],
      loadout: {
        'wc_sorcerer_destiny#0': ['wc_warpfire_pistol'],
        'wc_sorcerer_time#0': ['wc_warpfire_pistol'],
      },
      subFactionSelection: [],
    })
    expect(r.checks.find((c) => c.key === 'equipment')?.status).toBe('warn')
  })

  it('可选恩惠可留空；非巫师选恩惠或重复恩惠仍违规', () => {
    const ids = ['wc_sorcerer_destiny', 'wc_sorcerer_time', 'wc_rubric_gunner', 'wc_rubric_warrior', 'wc_tzaangor_champion']
    // 未选
    let r = evaluateLegality({
      pack, operativeIds: ids, loadout: {}, subFactionSelection: [],
      perOperativeMarks: { 'wc_sorcerer_destiny#0': 'boon_time_walker', 'wc_sorcerer_time#0': '' },
    })
    expect(r.checks.find((c) => c.key === 'sub-faction')?.status).toBe('ok')
    // 非巫师选恩惠
    r = evaluateLegality({
      pack, operativeIds: ids, loadout: {}, subFactionSelection: [],
      perOperativeMarks: {
        'wc_sorcerer_destiny#0': 'boon_time_walker',
        'wc_sorcerer_time#0': 'boon_warp_echo',
        'wc_rubric_gunner#0': 'boon_twist_fate',
      },
    })
    expect(r.checks.find((c) => c.key === 'sub-faction')?.status).toBe('warn')
    // 恩惠重复
    r = evaluateLegality({
      pack, operativeIds: ids, loadout: {}, subFactionSelection: [],
      perOperativeMarks: {
        'wc_sorcerer_destiny#0': 'boon_time_walker',
        'wc_sorcerer_time#0': 'boon_time_walker',
      },
    })
    expect(r.checks.find((c) => c.key === 'sub-faction')?.status).toBe('warn')
  })
})
