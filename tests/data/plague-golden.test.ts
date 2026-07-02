import { describe, it, expect } from 'vitest'
import { loadPack, runShooting, runMelee } from '../../src'
import type { Effect, Weapon } from '../../src/rules'
import { ManualDiceSource } from '../../src/dice'
import plague from '../../src/data/packs/plague_marines.v1.json'

const pack = loadPack(plague)

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

// 4 攻击骰 [4,5,2,3]：hit3+ → 命中 4/5/3（普通×3），2 失败；+ 3 防御骰 [1,1,1] 全失败 → 基线 3×2=6
const SEQ = [4, 5, 2, 3, 1, 1, 1]
function shoot(effects: Effect[], seq = SEQ) {
  const dice = new ManualDiceSource()
  dice.provide(seq)
  return runShooting({
    attacker: { operativeId: 'a', weapon: weapon('plg_boltgun') },
    defender: { operativeId: 'd', save: 6, wounds: 20 },
    effects, dice, hasCover: false,
  })
}

describe('瘟疫战士数据包加载（AC1）', () => {
  it('pack 合法、阵营/特工/武器/计谋齐；无 subFactionSelector', () => {
    expect(pack.packId).toBe('plague_marines')
    expect(pack.rulesetVersion).toBe('kt-lite-1.0')
    expect(pack.faction.id).toBe('plague_marines')
    expect(pack.faction.subFactionSelector).toBeUndefined() // 无印记
    expect(pack.operatives.length).toBe(7)
    expect(pack.stratagems?.length).toBe(8)
    expect(pack.wargear?.length).toBe(4)
    // 毒素/剧毒武器规则标签存在（描述性）
    expect(weapon('plg_plague_sword').profile.weaponRules).toContain('TOXIN')
    expect(weapon('plg_plague_sword').profile.weaponRules).toContain('VIRULENT')
  })
})

describe('golden：瘟疫机制经引擎结算（AC6）', () => {
  it('基线：4 普通成功 × 2 = 造伤 6', () => {
    expect(shoot([]).woundsDealt).toBe(6)
  })

  it('1. 毒素时序：GRANT_MARKER POISON 路由到流程结束（AT_PIPELINE_END，非当次攻击）', () => {
    const r = shoot([effect('plg_toxin_grant_marker')])
    // 指示物在 AT_PIPELINE_END / WOUNDS_APPLY_AND_AFTER 挂上（GRANT_MARKER 引擎消费，时序 real）
    const end = r.traces.find((t) => t.stepId === 'WOUNDS_APPLY_AND_AFTER')!
    expect(end.appliedEffectIds).toContain('plg_toxin_grant_marker')
    // 注：VIRULENT/TOXIN 是 weaponRule（描述性，引擎当前不消费）→「剧毒对已有指示物 +1」是
    // descriptor（需 VIRULENT 语义 + targetHasMarker 谓词接线，留引擎强化）；本断言只证 grant 时序。
    expect(r.woundsDealt).toBe(6)
  })

  it('2. 恼人韧性减伤（DAMAGE_MITIGATION 每枚上限 1 → 减 1）', () => {
    const base = shoot([])
    const withRes = shoot([effect('plg_devastating_resilience')])
    expect(withRes.woundsDealt).toBe(base.woundsDealt - 1)
  })

  it('3. 恶心韧性 vs 恼人韧性互斥（同组 defensive-mitigation → 仅减 1，非 2）', () => {
    const base = shoot([])
    const both = shoot([effect('plg_devastating_resilience'), effect('plg_disgusting_resilience')])
    expect(both.woundsDealt).toBe(base.woundsDealt - 1)
    const mit = both.traces.find((t) => t.stepId === 'DAMAGE_TOTAL_MITIGATE')!
    expect(mit.appliedEffectIds.length).toBe(1)
    expect(mit.rejectedEffectIds.length).toBe(1)
  })

  it('5. 飞蝇云：GRANT_MARKER FLY_CLOUD 路由到流程结束（遮挡几何留 3.2）', () => {
    const r = shoot([effect('plg_cloud_of_flies')])
    const end = r.traces.find((t) => t.stepId === 'WOUNDS_APPLY_AND_AFTER')!
    expect(end.appliedEffectIds).toContain('plg_cloud_of_flies')
  })

  it('8. 慈父的祝福：HEAL_OPERATIVE 路由到近战 MELEE_AFTER（数值回复条件留 3.2）', () => {
    const dice = new ManualDiceSource()
    dice.provide([3, 3, 3, 3, 3, 1, 1, 1, 1, 1]) // 攻方 5 普通，防方 0
    const r = runMelee({
      attacker: { operativeId: 'champion', weapon: weapon('plg_plague_sword'), save: 3, wounds: 15 },
      defender: { operativeId: 'd', weapon: weapon('plg_plague_sword'), save: 6, wounds: 20 },
      effects: [effect('plg_fathers_blessing')], dice,
    })
    const after = r.traces.find((t) => t.stepId === 'MELEE_AFTER')!
    expect(after.appliedEffectIds).toContain('plg_fathers_blessing')
  })
})

// 4/6/7/9：需谓词（operativeHasMarker/targetHasMarker/dieFaceEquals）或激活/移动层，
// 按 Story 3.1「不新增引擎谓词、缺口留 3.2」约定，作数据层 golden（四问字段齐全）。
describe('golden（数据层，引擎谓词留 Story 3.2 AQ-3）', () => {
  it('4. 毒素激活伤 descriptor（ON_ACTIVATION_START + operativeHasMarker(POISON)）', () => {
    const e = effect('plg_toxin_activation_damage')
    expect(e.trigger.point).toBe('ON_ACTIVATION_START')
    expect(e.modifier.kind).toBe('DAMAGE_MINUS')
    expect(e.pipelineStep).toBe('ACTIVATION_PRE')
  })

  it('6. 传染 descriptor（MUTUALLY_EXCLUSIVE_WITH injured，命中-1+移动-2 需谓词）', () => {
    const e = effect('plg_contagion')
    expect(e.stacking.policy).toBe('MUTUALLY_EXCLUSIVE_WITH')
    expect(e.stacking.groupKeys).toContain('injured')
  })

  it('7. 腐烂诅咒 descriptor（掷出 3 即伤，需 dieFaceEquals 谓词 + DAMAGE_PER_DIE_FACE）', () => {
    const e = effect('plg_rot_curse')
    expect(e.modifier.kind).toBe('CUSTOM_HOOK')
    expect((e.modifier.payload as { hookId: string }).hookId).toBe('rot-curse-die-face-3')
  })

  it('9. 剧毒武器 vs 有 POISON 目标 +1（VIRULENT weaponRule + targetHasMarker 谓词）', () => {
    const sword = weapon('plg_plague_sword')
    expect(sword.profile.weaponRules).toContain('VIRULENT')
    // VIRULENT 语义：对已有 POISON 目标该武器两伤害属性 +1（条件 targetHasMarker(POISON)，谓词留 3.2）
  })

  it('10. 剧毒破灭（被残废时范围挂 POISON + 已有指示物受 1 伤；范围多目标 descriptor）', () => {
    const e = effect('plg_virulent_blight')
    expect(e.trigger.point).toBe('ON_INCAPACITATED')
    expect(e.modifier.kind).toBe('CUSTOM_HOOK')
    expect((e.modifier.payload as { hookId: string }).hookId).toBe('virulent-blight-aoe')
    // 范围多目标 + ON_INCAPACITATED 需流水线支持，留引擎架构故事
  })
})

describe('AC3 buildConstraints（结构性）', () => {
  it('队长=勇士 + 每类限 1（除士兵）+ 无 subFactionSelector', () => {
    const c = pack.buildConstraints!
    expect(c.leaderFrom).toEqual(['plg_champion'])
    expect(c.maxPerTypeExcept).toEqual(['plg_troop'])
    expect(c.operatives?.min).toBe(6)
    expect(c.equipmentLimits?.plg_plague_spewer).toBe(1)
  })
})
