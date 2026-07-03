import { describe, it, expect } from 'vitest'
import { loadPack, runShooting, type Effect } from '../../src'
import { ManualDiceSource } from '../../src/dice'
import type { PredicateContext } from '../../src/rules/predicates'
import angels from '../../src/data/packs/angels_of_death.v1.json'

const pack = loadPack(angels)
const boltgun = pack.weapons.find((w) => w.weaponId === 'angels_bolt_rifle')!

// 基线：4 攻击骰 [4,5,2,3]=3 命中，3 防御骰 [1,1,1] → 2×3=6
function shoot(effects: Effect[], predicate?: PredicateContext) {
  const dice = new ManualDiceSource()
  dice.provide([4, 5, 2, 3, 1, 1, 1])
  return runShooting({
    attacker: { operativeId: 'a', weapon: boltgun },
    defender: { operativeId: 'd', save: 6, wounds: 20 },
    effects,
    dice,
    hasCover: false,
    predicate,
  })
}

// W3 谓词接线验证：CONDITIONAL effect 的 condition 经 evalPredicate 求值——
// 条件真→生效（减伤），条件假→enforcer 拒绝（不减伤）。
const mitig: Effect = {
  effectId: 'cond_mitig',
  label: '条件减伤（目标有 POISON 才生效）',
  source: 'test:condMitig',
  trigger: { point: 'ON_DAMAGE_TOTAL', condition: { op: 'targetHasMarker', args: ['POISON'] } },
  pipelineStep: 'DAMAGE_TOTAL_MITIGATE',
  modifier: { kind: 'DAMAGE_MITIGATION', payload: { threshold: 3, roll: '4+' } },
  stacking: { policy: 'CONDITIONAL' },
}

describe('W3 谓词接线（enforcer CONDITIONAL × evalPredicate）', () => {
  it('基线造伤 9（bolt_rifle 4 攻击骰 [4,5,2,3]=3 命中 ×3）', () => {
    expect(shoot([]).woundsDealt).toBe(9)
  })

  it('condition 真（target 有 POISON）→ 减伤生效', () => {
    const r = shoot([mitig], { targetMarkers: ['POISON'] })
    expect(r.woundsDealt).toBe(8) // 9 − 1
    const mit = r.traces.find((t) => t.stepId === 'DAMAGE_TOTAL_MITIGATE')!
    expect(mit.appliedEffectIds).toContain('cond_mitig')
    expect(mit.rejectedEffectIds).toHaveLength(0)
  })

  it('condition 假（target 无 POISON）→ enforcer 拒绝，不减伤', () => {
    const r = shoot([mitig], { targetMarkers: [] })
    expect(r.woundsDealt).toBe(9) // 被拒，不减
    const mit = r.traces.find((t) => t.stepId === 'DAMAGE_TOTAL_MITIGATE')!
    expect(mit.appliedEffectIds).not.toContain('cond_mitig')
    expect(mit.rejectedEffectIds.some((x) => x.id === 'cond_mitig')).toBe(true)
  })

  it('未注入 predicate（向后兼容）→ CONDITIONAL 透传生效', () => {
    // 无 predicate：enforcer CONDITIONAL 走透传（m.condition 存在但 evalCondition 缺）→ 保留
    const r = shoot([mitig])
    expect(r.woundsDealt).toBe(8) // 透传生效，减 1（9→8）
  })

  it('复合条件 all（target 有 POISON 且 notSameFaction）', () => {
    const eff: Effect = {
      ...mitig,
      effectId: 'cond_complex',
      trigger: {
        point: 'ON_DAMAGE_TOTAL',
        condition: { op: 'all', all: [{ op: 'targetHasMarker', args: ['POISON'] }, { op: 'notSameFaction' }] },
      },
    }
    // 同阵营 → notSameFaction 假 → 拒（不减，6）
    expect(shoot([eff], { targetMarkers: ['POISON'], attackerFaction: 'x', targetFaction: 'x' }).woundsDealt).toBe(9)
    // 异阵营 + 有 POISON → 真 → 减（5）
    expect(shoot([eff], { targetMarkers: ['POISON'], attackerFaction: 'x', targetFaction: 'y' }).woundsDealt).toBe(8)
  })
})
