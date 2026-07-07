import { describe, it, expect } from 'vitest'
import { loadPack, runShooting } from '../../src'
import type { Effect, Weapon } from '../../src/rules'
import { ManualDiceSource } from '../../src/dice'
import angels from '../../src/data/packs/angels_of_death.v1.json'

const pack = loadPack(angels)

function effect(id: string): Effect {
  const e = pack.effects.find((x) => x.effectId === id)
  if (!e) throw new Error(`effect ${id} not found`)
  return e as Effect
}

function boltRifle(): Weapon {
  const w = pack.weapons.find((x) => x.weaponId === 'angels_bolt_rifle')
  if (!w) throw new Error('weapon not found')
  return w as Weapon
}

function shoot(effects: Effect[], diceSeq: number[], hasCover = false) {
  const dice = new ManualDiceSource()
  dice.provide(diceSeq)
  return runShooting({
    attacker: { operativeId: 'a', weapon: boltRifle() },
    defender: { operativeId: 'd', save: 6, wounds: 13 },
    effects,
    dice,
    hasCover,
  })
}

describe('死亡天使数据包加载', () => {
  it('pack 合法、规则集匹配、含 8 战团战术', () => {
    expect(pack.packId).toBe('angels_of_death')
    expect(pack.rulesetVersion).toBe('kt-lite-1.0')
    const tactics = pack.effects.filter((e) => e.source.startsWith('chapterTactic:'))
    expect(tactics.length).toBe(8)
    expect(pack.operatives.length).toBeGreaterThanOrEqual(2)
  })
})

describe('golden：死亡天使机制经引擎结算', () => {
  it('神⊥手 AUTO_SUCCESS：基线 2 成功 → 加成后 3 成功，伤害 +3', () => {
    const baseline = shoot([], [4, 5, 2, 3, 1, 1, 1])
    const withSharp = shoot([effect('chapterTactic_sharpshooter')], [4, 5, 2, 3, 1, 1, 1])
    expect(baseline.woundsDealt).toBe(9) // 4 普通 × 3 = 12 = 9
    expect(withSharp.woundsDealt).toBe(12) // 4 普通 × 3 = 12
  })

  it('钢铁光环近似的减伤（DAMAGE_MITIGATION -1）', () => {
    // 构造一个代表「钢铁光环」的 mitigation effect（连长每场1次忽略一普通伤害≈减1）
    const ironHalo: Effect = {
      effectId: 'ironHalo',
      label: '钢铁光环',
      source: 'stratagem:ironHalo',
      trigger: { point: 'ON_DAMAGE_TOTAL' },
      pipelineStep: 'DAMAGE_TOTAL_MITIGATE',
      modifier: { kind: 'DAMAGE_MITIGATION', payload: { threshold: 3, roll: 'ignore-once' } },
      stacking: { policy: 'CAP_PER_ATTACK_DIE' },
    }
    const withIron = shoot([ironHalo], [4, 5, 2, 3, 1, 1, 1])
    expect(withIron.woundsDealt).toBe(8)
  })

  it('rulesRef 指向本地文档（FR-23，不渲染原文）', () => {
    const e = effect('chapterTactic_relentless')
    expect(e.rulesRef?.doc).toBe('merged_kt_angels_of_death_zh.md')
  })
})
