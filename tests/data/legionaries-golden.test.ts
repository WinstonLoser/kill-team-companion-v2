import { describe, it, expect } from 'vitest'
import { loadPack, runShooting, runMelee } from '../../src'
import type { Effect, Weapon } from '../../src/rules'
import { ManualDiceSource } from '../../src/dice'
import legionaries from '../../src/data/packs/legionaries.v1.json'

const pack = loadPack(legionaries)

function effect(id: string): Effect {
  const e = pack.effects.find((x) => x.effectId === id)
  if (!e) throw new Error(`effect ${id} not found`)
  return e as Effect
}
function weapon(id: string): Weapon {
  const w = pack.weapons.find((x) => x.weaponId === id)
  if (!w) throw new Error(`weapon ${id} not found`)
  return w as Weapon
}

// 4 攻击骰（hit3+：4,5,3 普通×3，2 失败）+ 3 防御骰（全 1，无抵挡）→ 基线造伤 3×2=6
const SEQ = [4, 5, 2, 3, 1, 1, 1]
function shoot(effects: Effect[], seq = SEQ) {
  const dice = new ManualDiceSource()
  dice.provide(seq)
  return runShooting({
    attacker: { operativeId: 'a', weapon: weapon('leg_bolt_pistol') },
    defender: { operativeId: 'd', save: 6, wounds: 20 },
    effects,
    dice,
    hasCover: false,
  })
}

describe('军团兵数据包加载（AC1）', () => {
  it('pack 合法、阵营/印记/特工/武器齐', () => {
    expect(pack.packId).toBe('legionaries')
    expect(pack.rulesetVersion).toBe('kt-lite-1.0')
    expect(pack.faction.id).toBe('legionaries')
    expect(pack.faction.subFactionSelector?.id).toBe('markOfChaos')
    expect(pack.faction.subFactionSelector?.max).toBe(1)
    expect(pack.faction.subFactionSelector?.options).toHaveLength(5)
    expect(pack.operatives.length).toBeGreaterThanOrEqual(9)
    const marks = pack.effects.filter((e) => e.source.startsWith('markOfChaos:'))
    expect(marks.length).toBe(5)
  })
})

describe('golden：军团兵机制经引擎结算（AC4）', () => {
  it('基线：4 普通成功 × 2 = 造伤 6', () => {
    expect(shoot([]).woundsDealt).toBe(6)
  })

  it('2. 纳垢恼人生命力减伤（同源每枚上限 1 → 减 1）', () => {
    const base = shoot([])
    const withNurgle = shoot([effect('mark_nurgle')])
    expect(withNurgle.woundsDealt).toBe(base.woundsDealt - 1)
  })

  it('4. 奸奇远程严重（UPGRADE_SUCCESS：1 普通→关键，造伤 6→8）', () => {
    const base = shoot([])
    const withTzeentch = shoot([effect('mark_tzeentch')])
    // 3 普通成功 → 升级 1 关键：2×2 + 1×4 = 8
    expect(withTzeentch.woundsDealt).toBe(base.woundsDealt + 2)
    expect(withTzeentch.remaining.criticalSuccess).toBe(1)
  })

  it('6. 释放恶魔 + 纳垢互斥（同组 defensive-mitigation → 仅减 1，非 2）', () => {
    const base = shoot([])
    const both = shoot([effect('mark_nurgle'), effect('leg_rite_of_possession')])
    // UNIQUE_PER_GROUP [defensive-mitigation] → 二者只留一 → 减 1
    expect(both.woundsDealt).toBe(base.woundsDealt - 1)
    // 被拒一条（同组互斥）
    const mitStep = both.traces.find((t) => t.stepId === 'DAMAGE_TOTAL_MITIGATE')!
    expect(mitStep.appliedEffectIds.length).toBe(1)
    expect(mitStep.rejectedEffectIds.length).toBe(1)
  })

  it('8. 血祭血神出击额外伤害（EXTRA_DAMAGE_ON_HIT +1 → 造伤 7）', () => {
    const base = shoot([])
    const withStrat = shoot([effect('strat_blood_for_blood_god')])
    expect(withStrat.woundsDealt).toBe(base.woundsDealt + 1)
  })

  it('7. 灵魂盛宴近战后回复（HEAL_OPERATIVE 在 MELEE_AFTER 生效）', () => {
    const dice = new ManualDiceSource()
    // 5 攻击骰全关键（造伤方）+ 5 防御骰全失败
    dice.provide([6, 6, 6, 6, 6, 1, 1, 1, 1, 1])
    const r = runMelee({
      attacker: { operativeId: 'chosen', weapon: weapon('leg_daemon_blade'), save: 3, wounds: 14 },
      defender: { operativeId: 'd', weapon: weapon('leg_chainsword_axe'), save: 6, wounds: 20 },
      effects: [effect('leg_soulfeast')],
      dice,
    })
    const after = r.traces.find((t) => t.stepId === 'MELEE_AFTER')!
    expect(after.appliedEffectIds).toContain('leg_soulfeast')
  })
})

// 1/3/5/9：引擎当前不消费这些 modifier（近战 UPGRADE / 移动属性 / 重掷 / 吸魂代伤），
// 按 Story 2.1「不新增引擎谓词、缺口留 2.2」约定，作数据层 golden（effect 四问字段齐全）。
describe('golden（数据层，引擎谓词留 Story 2.2 AQ-3）', () => {
  it('1. 恐虐印记：UPGRADE_SUCCESS 挂近战 step + UNIQUE_PER_GROUP', () => {
    const e = effect('mark_khrone')
    expect(e.modifier.kind).toBe('UPGRADE_SUCCESS')
    expect(e.trigger.point).toBe('AFTER_HIT_ROLL')
    expect(e.pipelineStep).toBe('MELEE_ALTERNATING_RESOLVE')
    expect(e.stacking.policy).toBe('UNIQUE_PER_GROUP')
    expect(e.rulesRef?.doc).toBe('merged_kt_legionaries_zh.md')
  })

  it('3. 色孽印记：移动 +1 descriptor（CUSTOM_HOOK @ 激活期）', () => {
    const e = effect('mark_slaanesh')
    expect(e.modifier.kind).toBe('CUSTOM_HOOK')
    expect(e.trigger.point).toBe('ON_ACTIVATION_START')
    expect((e.modifier.payload as { hookId: string }).hookId).toBe('mark-slaanesh-move')
  })

  it('5. 无分印记：无休 descriptor（CONDITIONAL @ hit）', () => {
    const e = effect('mark_unaligned')
    expect(e.modifier.kind).toBe('CUSTOM_HOOK')
    expect(e.stacking.policy).toBe('CONDITIONAL')
    expect(e.trigger.point).toBe('BEFORE_HIT_ROLL')
  })

  it('9. 混沌护身符：吸魂代伤 descriptor（CUSTOM_HOOK @ 防御升级）', () => {
    const e = effect('wargear_chaos_talisman')
    expect(e.modifier.kind).toBe('CUSTOM_HOOK')
    expect(e.trigger.point).toBe('AFTER_DEFENCE_ROLL')
    expect((e.modifier.payload as { hookId: string }).hookId).toBe('soul-damage-substitute')
  })
})

describe('AC3 buildConstraints（结构性）', () => {
  it('特工 min/max=6 + 重型/特殊武器限 1', () => {
    const c = pack.buildConstraints!
    expect(c.operatives?.min).toBe(6)
    expect(c.equipmentLimits?.leg_reaper_cannon).toBe(1)
    expect(c.equipmentLimits?.leg_heavy_bolter).toBe(1)
    expect(c.equipmentLimits?.leg_daemon_blade).toBe(1)
  })
})
