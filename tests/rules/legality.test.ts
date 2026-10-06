import { describe, it, expect } from 'vitest'
import { evaluateLegality } from '../../src/rules/legality'
import type { FactionPack } from '../../src/rules'
import angels from '../../src/data/packs/angels_of_death.v1.json'
import { loadPack } from '../../src/rules'

const pack = loadPack(angels) as FactionPack

// 合成 team-scope 选择器包（当前 canonical 死亡天使包未内嵌 selector，逻辑测试用合成数据）
function synthSelectorPack(): FactionPack {
  return {
    ...pack,
    faction: {
      ...pack.faction,
      subFactionSelector: {
        id: 'chapterTactic',
        label: '战团战术（8 选 2）',
        options: ['chapterTactic_relentless', 'chapterTactic_duelist', 'chapterTactic_resolute'],
        max: 2,
        scope: 'team',
      },
    },
    buildConstraints: { operatives: { min: 1 }, leaderFrom: ['intercessor_sergeant'] },
  }
}

const ROSTER6 = [
  'intercessor_sergeant',
  'intercessor_warrior', 'intercessor_warrior', 'intercessor_warrior',
  'intercessor_warrior', 'intercessor_warrior',
] as const
const roster6Loadout = Object.fromEntries(ROSTER6.map((id, index) => [
  `${id}#${ROSTER6.slice(0, index).filter(previous => previous === id).length}`,
  pack.operatives.find(op => op.operativeId === id)!.loadouts.flatMap(slot => slot.options[0] ?? []),
]))

describe('建队合法性判定（纯逻辑，数据驱动）', () => {
  it('突击仲裁者军士的等离子手枪只能搭配链锯剑', () => {
    const operative = pack.operatives.find(op => op.operativeId === 'assault_intercessor_sergeant')!
    const plasmaBundle = operative.loadouts[0]!.options.find(option => option.some(id => id.includes('plasma_pistol')))!
    const powerFist = operative.loadouts[0]!.options.flat().find(id => id.includes('power_fist'))!
    const legal = evaluateLegality({ pack, operativeIds: [operative.operativeId], loadout: { 'assault_intercessor_sergeant#0': plasmaBundle }, subFactionSelection: [] })
    const illegal = evaluateLegality({ pack, operativeIds: [operative.operativeId], loadout: { 'assault_intercessor_sergeant#0': [...plasmaBundle.filter(id => !id.includes('chainsword')), powerFist] }, subFactionSelection: [] })
    expect(legal.checks.find(check => check.key === 'loadout')?.status).toBe('ok')
    expect(illegal.checks.find(check => check.key === 'loadout')?.status).toBe('warn')
  })

  it('全绿：6 特工 + 队长 + 战团战术满 2 选', () => {
    const r = evaluateLegality({
      pack: synthSelectorPack(),
      operativeIds: [...ROSTER6],
      loadout: roster6Loadout,
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
      teamRulesEnabled: true,
    })
    expect(r.legal).toBe(true)
    expect(r.checks.every((c) => c.status === 'ok')).toBe(true)
  })

  it('特工来源违规：operativeId 不在阵营列表', () => {
    const r = evaluateLegality({
      pack,
      operativeIds: ['nonexistent_op'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(r.legal).toBe(false)
    const src = r.checks.find((c) => c.key === 'operatives-source')
    expect(src?.status).toBe('warn')
    expect(src?.detail).toContain('nonexistent_op')
  })

  it('特工数量违规：低于 min', () => {
    const r = evaluateLegality({
      pack,
      operativeIds: [],
      loadout: {},
      subFactionSelection: [],
    })
    expect(r.legal).toBe(false)
    const src = r.checks.find((c) => c.key === 'operatives-source')
    expect(src?.status).toBe('warn')
    expect(src?.detail).toContain('至少')
  })

  it('子阵营未选满：战团战术只选 1（应 2）', () => {
    const r = evaluateLegality({
      pack: synthSelectorPack(),
      operativeIds: [...ROSTER6],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless'],
      teamRulesEnabled: true,
    })
    expect(r.legal).toBe(false)
    expect(r.checks.find((c) => c.key === 'sub-faction')?.status).toBe('warn')
  })

  it('子阵营超选：战团战术选 3（应 2）', () => {
    const r = evaluateLegality({
      pack: synthSelectorPack(),
      operativeIds: [...ROSTER6],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist', 'chapterTactic_resolute'],
      teamRulesEnabled: true,
    })
    expect(r.legal).toBe(false)
    expect(r.checks.find((c) => c.key === 'sub-faction')?.status).toBe('warn')
  })

  it('装备超限：HEAVY 上限 1，选了 2 → 违规', () => {
    const sp: FactionPack = {
      ...pack,
      buildConstraints: {
        operatives: { min: 1 },
        equipmentLimitScope: 'keyword',
        equipmentLimits: { HEAVY: 1 },
      },
    }
    const r = evaluateLegality({
      pack: sp,
      operativeIds: ['intercessor_sergeant', 'heavy_intercessor_gunner'],
      loadout: {
        intercessor_sergeant: ['synth_heavy_a'],
        heavy_intercessor_gunner: ['synth_heavy_b'],
      },
      syntheticWeaponKeywords: { synth_heavy_a: ['HEAVY'], synth_heavy_b: ['HEAVY'] },
      subFactionSelection: [],
    })
    expect(r.legal).toBe(false)
    const eq = r.checks.find((c) => c.key === 'equipment')
    expect(eq?.status).toBe('warn')
    expect(eq?.detail).toContain('HEAVY')
  })

  it('AC3 队长 + 每类限 1：leaderFrom / maxPerTypeExcept 生效', () => {
    const cPack: FactionPack = {
      ...pack,
      buildConstraints: {
        operatives: { min: 1 },
        leaderFrom: ['intercessor_warrior'],
        maxPerTypeExcept: ['intercessor_sergeant'],
      },
    }
    const noLeader = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_sergeant'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(noLeader.checks.find((c) => c.key === 'leader')?.status).toBe('warn')

    const ok = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_warrior', 'intercessor_sergeant', 'intercessor_sergeant'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(ok.checks.find((c) => c.key === 'leader')?.status).toBe('ok')
    expect(ok.checks.find((c) => c.key === 'per-type')?.status).toBe('ok')

    const dup = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_warrior', 'intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(dup.checks.find((c) => c.key === 'per-type')?.status).toBe('warn')
  })

  it('固定组成：operativeTypeLimits 精确数量不符 → 违规', () => {
    const cPack: FactionPack = {
      ...pack,
      buildConstraints: {
        operatives: { min: 1 },
        operativeTypeLimits: { intercessor_sergeant: { min: 1, max: 1 }, intercessor_warrior: { min: 2, max: 4 } },
      },
    }
    const ok = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_sergeant', 'intercessor_warrior', 'intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(ok.checks.find((c) => c.key === 'type-limits')?.status).toBe('ok')

    const tooFew = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_sergeant', 'intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(tooFew.checks.find((c) => c.key === 'type-limits')?.status).toBe('warn')
    expect(tooFew.checks.find((c) => c.key === 'type-limits')?.detail).toContain('intercessor_warrior')
  })

  it('初始不可选：initialRosterIneligible 入队 → 违规', () => {
    const cPack: FactionPack = {
      ...pack,
      buildConstraints: { operatives: { min: 1 }, initialRosterIneligible: ['intercessor_gunner'] },
    }
    const bad = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_sergeant', 'intercessor_gunner'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(bad.checks.find((c) => c.key === 'initial-ineligible')?.status).toBe('warn')

    const ok = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_sergeant', 'intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(ok.checks.find((c) => c.key === 'initial-ineligible')?.status).toBe('ok')
  })

  it('点数制：selectionPoints 恰好 5 + 奸角兽 0.5 点', () => {
    const cPack: FactionPack = {
      ...pack,
      buildConstraints: {
        operatives: { min: 1 },
        selectionPoints: { exact: 5 },
        operativeCosts: { intercessor_warrior: 0.5 },
      },
    }
    // 4×1 点 + 2×0.5 点 = 5 → ok
    const ok = evaluateLegality({
      pack: cPack,
      operativeIds: [
        'intercessor_sergeant', 'intercessor_gunner', 'heavy_intercessor_gunner', 'eliminator_sniper',
        'intercessor_warrior', 'intercessor_warrior',
      ],
      loadout: {},
      subFactionSelection: [],
    })
    expect(ok.checks.find((c) => c.key === 'selection-points')?.status).toBe('ok')

    // 5 点基础上再加一个 0.5 → 5.5 → warn
    const over = evaluateLegality({
      pack: cPack,
      operativeIds: [
        'intercessor_sergeant', 'intercessor_gunner', 'heavy_intercessor_gunner', 'eliminator_sniper',
        'intercessor_warrior', 'intercessor_warrior', 'intercessor_warrior',
      ],
      loadout: {},
      subFactionSelection: [],
    })
    expect(over.checks.find((c) => c.key === 'selection-points')?.status).toBe('warn')
    expect(over.checks.find((c) => c.key === 'selection-points')?.detail).toContain('5.5')
  })

  it('关键词下限：minimumByKeyword 至少 1 名 SERGEANT', () => {
    const cPack: FactionPack = {
      ...pack,
      buildConstraints: { operatives: { min: 1 }, minimumByKeyword: { SERGEANT: 1 } },
    }
    const ok = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_sergeant', 'intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(ok.checks.find((c) => c.key === 'keyword-min')?.status).toBe('ok')

    const missing = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_warrior', 'intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(missing.checks.find((c) => c.key === 'keyword-min')?.status).toBe('warn')
    expect(missing.checks.find((c) => c.key === 'keyword-min')?.detail).toContain('SERGEANT')
  })

  it('perOperative 选择器：可留空，但仍校验资格与整队唯一', () => {
    const cPack: FactionPack = {
      ...pack,
      faction: {
        ...pack.faction,
        subFactionSelector: {
          id: 'genericGift',
          label: '恩惠（9 选 1，整队不重复）',
          options: ['gift_a', 'gift_b', 'gift_c'],
          max: 1,
          scope: 'perOperative',
          eligibleKeywords: ['SERGEANT'],
          requiredPerEligible: 1,
          uniqueAcrossTeam: true,
        },
      },
      buildConstraints: { operatives: { min: 1 } },
    }
    // 玩家未启用该项个性化能力，可留空
    const missing = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_sergeant', 'intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
      perOperativeMarks: { 'intercessor_sergeant#0': '' },
    })
    expect(missing.checks.find((c) => c.key === 'sub-faction')?.status).toBe('ok')

    // 合格选了、非合格也选了 → warn（战士不符合资格）
    const notEligible = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_sergeant', 'intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
      perOperativeMarks: { 'intercessor_sergeant#0': 'gift_a', 'intercessor_warrior#0': 'gift_b' },
    })
    expect(notEligible.checks.find((c) => c.key === 'sub-faction')?.status).toBe('warn')
    expect(notEligible.checks.find((c) => c.key === 'sub-faction')?.detail).toContain('资格')

    // 两名军士选同一恩惠 → 整队重复 warn
    const dup = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_sergeant', 'intercessor_sergeant', 'intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
      perOperativeMarks: { 'intercessor_sergeant#0': 'gift_a', 'intercessor_sergeant#1': 'gift_a' },
    })
    expect(dup.checks.find((c) => c.key === 'sub-faction')?.status).toBe('warn')

    // 全部正确 → ok
    const ok = evaluateLegality({
      pack: cPack,
      operativeIds: ['intercessor_sergeant', 'intercessor_sergeant', 'intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
      perOperativeMarks: { 'intercessor_sergeant#0': 'gift_a', 'intercessor_sergeant#1': 'gift_b' },
    })
    expect(ok.checks.find((c) => c.key === 'sub-faction')?.status).toBe('ok')
  })

  it('无子阵营选择器的阵营：跳过子阵营检查', () => {
    const noSelector: FactionPack = { ...pack, faction: { ...pack.faction } }
    delete (noSelector.faction as { subFactionSelector?: unknown }).subFactionSelector
    const ids = ['space_marine_captain', ...ROSTER6.slice(1)]
    const r = evaluateLegality({
      pack: noSelector,
      operativeIds: ids,
      loadout: Object.fromEntries(ids.map((id, index) => [`${id}#${ids.slice(0, index).filter(x => x === id).length}`, pack.operatives.find(op => op.operativeId === id)!.loadouts.flatMap(slot => slot.options[0] ?? [])])),
      subFactionSelection: [],
    })
    expect(r.checks.find((c) => c.key === 'sub-faction')).toBeUndefined()
    expect(r.legal).toBe(true)
  })
})
