import { describe, it, expect } from 'vitest'
import { evaluateLegality } from '../../src/rules/legality'
import type { FactionPack } from '../../src/rules'
import angels from '../../src/data/packs/angels_of_death.v1.json'
import legionaries from '../../src/data/packs/legionaries.v1.json'
import { loadPack } from '../../src/rules'

const pack = loadPack(angels) as FactionPack
const legPack = loadPack(legionaries) as FactionPack

// 仅用于装备超限分支测试的合成约束包（不动 canonical 死亡天使包）
function synthPackWithEquipmentLimit(): FactionPack {
  return {
    ...pack,
    buildConstraints: {
      ...(pack.buildConstraints ?? {}),
      operatives: { min: 1 },
      equipmentLimitScope: 'keyword',
      equipmentLimits: { HEAVY: 1 },
    },
  }
}

describe('建队合法性判定（纯逻辑，数据驱动）', () => {
  it('全绿：1 特工 + 战团战术满 2 选', () => {
    const r = evaluateLegality({
      pack,
      operativeIds: ['angels_intercessor_sergeant','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior'],
      loadout: { angels_intercessor_warrior: ['angels_bolt_rifle'] },
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    expect(r.legal).toBe(true)
    expect(r.checks.every((c) => c.status === 'ok')).toBe(true)
  })

  it('特工来源违规：operativeId 不在阵营列表', () => {
    const r = evaluateLegality({
      pack,
      operativeIds: ['legionary_chosen'],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    expect(r.legal).toBe(false)
    const src = r.checks.find((c) => c.key === 'operatives-source')
    expect(src?.status).toBe('warn')
    expect(src?.detail).toContain('legionary_chosen')
  })

  it('特工数量违规：低于 min', () => {
    const r = evaluateLegality({
      pack,
      operativeIds: [],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    expect(r.legal).toBe(false)
    const src = r.checks.find((c) => c.key === 'operatives-source')
    expect(src?.status).toBe('warn')
    expect(src?.detail).toContain('至少')
  })

  it('子阵营未选满：战团战术只选 1（应 2）', () => {
    const r = evaluateLegality({
      pack,
      operativeIds: ['angels_intercessor_sergeant','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior'],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless'],
    })
    expect(r.legal).toBe(false)
    const sf = r.checks.find((c) => c.key === 'sub-faction')
    expect(sf?.status).toBe('warn')
  })

  it('子阵营超选：战团战术选 3（应 2）', () => {
    const r = evaluateLegality({
      pack,
      operativeIds: ['angels_intercessor_sergeant','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior'],
      loadout: {},
      subFactionSelection: [
        'chapterTactic_relentless',
        'chapterTactic_duelist',
        'chapterTactic_resolute',
      ],
    })
    expect(r.legal).toBe(false)
    const sf = r.checks.find((c) => c.key === 'sub-faction')
    expect(sf?.status).toBe('warn')
  })

  it('装备超限：HEAVY 上限 1，选了 2 → 违规并定位武器', () => {
    const sp = synthPackWithEquipmentLimit()
    // 构造两把 HEAVY 武器挂载（合成 loadout，不依赖真实包有无 HEAVY）
    const r = evaluateLegality({
      pack: sp,
      operativeIds: ['angels_intercessor_warrior', 'angels_intercessor_sergeant'],
      loadout: {
        angels_intercessor_warrior: ['angels_bolt_rifle', 'synth_heavy_a'],
        angels_intercessor_sergeant: ['synth_heavy_b'],
      },
      syntheticWeaponKeywords: {
        synth_heavy_a: ['HEAVY'],
        synth_heavy_b: ['HEAVY'],
        angels_bolt_rifle: ['BOLT'],
      },
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    expect(r.legal).toBe(false)
    const eq = r.checks.find((c) => c.key === 'equipment')
    expect(eq?.status).toBe('warn')
    expect(eq?.detail).toContain('HEAVY')
  })

  it('装备未超限：HEAVY 上限 1，选了 1 → ok', () => {
    const sp = synthPackWithEquipmentLimit()
    const r = evaluateLegality({
      pack: sp,
      operativeIds: ['angels_intercessor_sergeant','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior'],
      loadout: { angels_intercessor_warrior: ['synth_heavy_a'] },
      syntheticWeaponKeywords: { synth_heavy_a: ['HEAVY'] },
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    const eq = r.checks.find((c) => c.key === 'equipment')
    expect(eq?.status).toBe('ok')
  })

  it('无子阵营选择器的阵营：跳过子阵营检查', () => {
    const noSelector: FactionPack = { ...pack, faction: { ...pack.faction } }
    delete (noSelector.faction as { subFactionSelector?: unknown }).subFactionSelector
    const r = evaluateLegality({
      pack: noSelector,
      operativeIds: ['angels_intercessor_sergeant','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(r.checks.find((c) => c.key === 'sub-faction')).toBeUndefined()
    // 仍因 operatives/equipment ok 而合法
    expect(r.legal).toBe(true)
  })

  it('perOperative 选择器（军团兵混沌印记）：不校验整队 subFactionSelection → ok', () => {
    // 军团兵印记是每特工各选（存 perOperativeMarks），整队 subFactionSelection 为空也不应违规
    expect(legPack.faction.subFactionSelector?.scope).toBe('perOperative')
    const r = evaluateLegality({
      pack: legPack,
      operativeIds: ['leg_champion'],
      loadout: {},
      subFactionSelection: [],
    })
    const sf = r.checks.find((c) => c.key === 'sub-faction')
    expect(sf?.status).toBe('ok')
    expect(sf?.detail).toContain('每特工')
  })

  it('AC3 队长规则：angels leaderFrom=[sergeant]，有队长 → ok', () => {
    const r = evaluateLegality({
      pack,
      operativeIds: ['angels_intercessor_sergeant','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior','angels_intercessor_warrior'],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    const leader = r.checks.find((c) => c.key === 'leader')
    expect(leader?.status).toBe('ok')
  })

  it('AC3 队长 + 每类限 1：构造 buildConstraints 校验', () => {
    const cPack: FactionPack = {
      ...pack,
      buildConstraints: {
        operatives: { min: 1 },
        leaderFrom: ['angels_intercessor_warrior'],
        maxPerTypeExcept: ['angels_intercessor_sergeant'],
      },
    }
    // 缺队长 → leader warn
    const noLeader = evaluateLegality({
      pack: cPack,
      operativeIds: ['angels_intercessor_sergeant'],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    expect(noLeader.checks.find((c) => c.key === 'leader')?.status).toBe('warn')
    expect(noLeader.legal).toBe(false)

    // 有队长 + 每类限 1 合规
    const ok = evaluateLegality({
      pack: cPack,
      operativeIds: ['angels_intercessor_warrior', 'angels_intercessor_sergeant', 'angels_intercessor_sergeant'],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    expect(ok.checks.find((c) => c.key === 'leader')?.status).toBe('ok')
    // angels_intercessor_sergeant 在例外 → 重复允许；per-type ok
    expect(ok.checks.find((c) => c.key === 'per-type')?.status).toBe('ok')

    // 非例外类重复 → per-type warn
    const dup = evaluateLegality({
      pack: cPack,
      operativeIds: ['angels_intercessor_warrior', 'angels_intercessor_warrior'],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    expect(dup.checks.find((c) => c.key === 'per-type')?.status).toBe('warn')
    expect(dup.legal).toBe(false)
  })
})
