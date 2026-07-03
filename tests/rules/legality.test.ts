import { describe, it, expect } from 'vitest'
import { evaluateLegality } from '../../src/rules/legality'
import type { FactionPack } from '../../src/rules'
import angels from '../../src/data/packs/angels_of_death.v1.json'
import { loadPack } from '../../src/rules'

const pack = loadPack(angels) as FactionPack

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
      operativeIds: ['angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical'],
      loadout: { angels_tactical: ['angels_bolt_rifle'] },
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
      operativeIds: ['angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical'],
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
      operativeIds: ['angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical'],
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
      operativeIds: ['angels_tactical', 'angels_sergeant'],
      loadout: {
        angels_tactical: ['angels_bolt_rifle', 'synth_heavy_a'],
        angels_sergeant: ['synth_heavy_b'],
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
      operativeIds: ['angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical'],
      loadout: { angels_tactical: ['synth_heavy_a'] },
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
      operativeIds: ['angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical'],
      loadout: {},
      subFactionSelection: [],
    })
    expect(r.checks.find((c) => c.key === 'sub-faction')).toBeUndefined()
    // 仍因 operatives/equipment ok 而合法
    expect(r.legal).toBe(true)
  })

  it('AC3 队长规则：leaderFrom 缺队长 → 违规', () => {
    const r = evaluateLegality({
      pack,
      operativeIds: ['angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical','angels_tactical'],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    // angels 无 leaderFrom → 跳过该项（无 leader check）
    expect(r.checks.find((c) => c.key === 'leader')).toBeUndefined()
  })

  it('AC3 队长 + 每类限 1：构造 buildConstraints 校验', () => {
    const cPack: FactionPack = {
      ...pack,
      buildConstraints: {
        operatives: { min: 1 },
        leaderFrom: ['angels_tactical'],
        maxPerTypeExcept: ['angels_sergeant'],
      },
    }
    // 缺队长 → leader warn
    const noLeader = evaluateLegality({
      pack: cPack,
      operativeIds: ['angels_sergeant'],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    expect(noLeader.checks.find((c) => c.key === 'leader')?.status).toBe('warn')
    expect(noLeader.legal).toBe(false)

    // 有队长 + 每类限 1 合规
    const ok = evaluateLegality({
      pack: cPack,
      operativeIds: ['angels_tactical', 'angels_sergeant', 'angels_sergeant'],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    expect(ok.checks.find((c) => c.key === 'leader')?.status).toBe('ok')
    // angels_sergeant 在例外 → 重复允许；per-type ok
    expect(ok.checks.find((c) => c.key === 'per-type')?.status).toBe('ok')

    // 非例外类重复 → per-type warn
    const dup = evaluateLegality({
      pack: cPack,
      operativeIds: ['angels_tactical', 'angels_tactical'],
      loadout: {},
      subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'],
    })
    expect(dup.checks.find((c) => c.key === 'per-type')?.status).toBe('warn')
    expect(dup.legal).toBe(false)
  })
})
