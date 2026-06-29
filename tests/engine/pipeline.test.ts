import { describe, it, expect } from 'vitest'
import { runShooting } from '../../src/engine'
import { ManualDiceSource } from '../../src/dice'
import type { Effect, Weapon } from '../../src/rules'
import type { ShootInput } from '../../src/engine'

const weapon: Weapon = {
  weaponId: 'w',
  name: 'test-gun',
  kind: 'RANGED',
  profile: { attacks: 4, hit: 3, normalDamage: 3, criticalDamage: 4, weaponRules: [] },
  keywords: [],
}

function mkInput(over: Partial<ShootInput> & { diceSeq: number[] }): ShootInput {
  const dice = new ManualDiceSource()
  dice.provide(over.diceSeq)
  return {
    attacker: { operativeId: 'a', weapon },
    defender: over.defender ?? { operativeId: 'd', save: 4, wounds: 5 },
    effects: over.effects ?? [],
    dice,
    hasCover: over.hasCover ?? false,
    geometry: over.geometry,
  }
}

const mitigationEffect: Effect = {
  effectId: 'mit',
  label: '恼人韧性',
  source: 'test',
  trigger: { point: 'ON_DAMAGE_TOTAL' },
  pipelineStep: 'DAMAGE_TOTAL_MITIGATE',
  modifier: { kind: 'DAMAGE_MITIGATION', payload: { threshold: 3, roll: '5+' } },
  stacking: { policy: 'STACKABLE' },
}

describe('runShooting 射击流水线', () => {
  it('基本：攻击4 hit3+ → 2普通+1关键，无防御成功，造10伤致残', () => {
    // attack [4,5,2,6] → 2N+1C ; defence [2,3,1] → 0
    const r = runShooting(mkInput({ diceSeq: [4, 5, 2, 6, 2, 3, 1] }))
    expect(r.remaining).toEqual({ normalSuccess: 2, criticalSuccess: 1 })
    expect(r.woundsDealt).toBe(10) // 2*3 + 1*4
    expect(r.defenderIncapacitated).toBe(true)
    expect(r.traces).toHaveLength(10)
  })

  it('掩护：+1 普通防御成功抵消 1 普通 → 少 3 伤', () => {
    const r = runShooting(mkInput({ diceSeq: [4, 5, 2, 6, 2, 3, 1], hasCover: true }))
    // defNormal 0 +1 cover → 1；挡 1 普通 → 剩 1N+1C = 3+4=7
    expect(r.woundsDealt).toBe(7)
  })

  it('减伤：DAMAGE_MITIGATION 减 1', () => {
    const r = runShooting(
      mkInput({ diceSeq: [4, 5, 2, 6, 2, 3, 1], effects: [mitigationEffect] }),
    )
    expect(r.woundsDealt).toBe(9) // 10 - 1
    expect(r.traces[8]?.stepId).toBe('DAMAGE_TOTAL_MITIGATE')
  })

  it('PIERCE 减防御骰', () => {
    const pierce: Effect = {
      effectId: 'p', label: 't', source: 'test',
      trigger: { point: 'BEFORE_DEFENCE_ROLL' }, pipelineStep: 'DEFENCE_ROLL',
      modifier: { kind: 'PIERCE', payload: { amount: 1 } }, stacking: { policy: 'STACKABLE' },
    }
    // attack [4,5,2,6]; defence 仅 2 颗 [2,3]（pierce-1）
    const r = runShooting(mkInput({ diceSeq: [4, 5, 2, 6, 2, 3], effects: [pierce] }))
    expect(r.traces[4]?.summary).toContain('防御骰2')
  })

  it('互斥 effect 被拒进 rejectedEffectIds（P2-trace 可审计）', () => {
    // 两条 HIT_MINUS 同组互斥，priority 高者胜，低者进 rejectedEffectIds
    const hm1: Effect = {
      effectId: 'hm1', label: '高优先', source: 'src',
      trigger: { point: 'BEFORE_HIT_ROLL' }, pipelineStep: 'HIT_ROLL',
      modifier: { kind: 'HIT_MINUS', payload: { amount: 1 } },
      stacking: { policy: 'MUTUALLY_EXCLUSIVE_WITH', groupKeys: ['hit-debuff'] }, priority: 10,
    }
    const hm2: Effect = {
      effectId: 'hm2', label: '低优先', source: 'src',
      trigger: { point: 'BEFORE_HIT_ROLL' }, pipelineStep: 'HIT_ROLL',
      modifier: { kind: 'HIT_MINUS', payload: { amount: 1 } },
      stacking: { policy: 'MUTUALLY_EXCLUSIVE_WITH', groupKeys: ['hit-debuff'] }, priority: 5,
    }
    const r = runShooting(mkInput({ diceSeq: [4, 5, 3, 2, 2, 3, 1], effects: [hm1, hm2] }))
    expect(r.traces[2]?.appliedEffectIds).toEqual(['hm1'])
    expect(r.traces[2]?.rejectedEffectIds).toHaveLength(1)
    expect(r.traces[2]?.rejectedEffectIds[0]?.id).toBe('hm2')
    expect(r.traces[2]?.rejectedEffectIds[0]?.reason).toContain('R4')
  })

  it('HIT_MINUS 经 resolveStat 两层模型升阈 → 命中数减少（P22）', () => {
    // attack [4,5,3,2]：无 debuff hit3+ → 4,5,3 三普通；HIT_MINUS +1 → hit4+ 仅 4,5 两普通
    const hitMinus: Effect = {
      effectId: 'hm', label: 't', source: 'test',
      trigger: { point: 'BEFORE_HIT_ROLL' }, pipelineStep: 'HIT_ROLL',
      modifier: { kind: 'HIT_MINUS', payload: { amount: 1 } }, stacking: { policy: 'STACKABLE' },
    }
    const baseline = runShooting(mkInput({ diceSeq: [4, 5, 3, 2, 2, 3, 1] }))
    const debuffed = runShooting(mkInput({ diceSeq: [4, 5, 3, 2, 2, 3, 1], effects: [hitMinus] }))
    expect(baseline.traces[2]?.summary).toContain('命中3+')
    expect(debuffed.traces[2]?.summary).toContain('命中4+') // resolveStat(base=3, +1) = 4
    expect(debuffed.remaining.normalSuccess).toBeLessThan(baseline.remaining.normalSuccess)
  })

  it('P12：几何资格接线 — 超射程目标 → woundsDealt 0、TARGET_VALIDATE 标无效', () => {
    const r = runShooting(
      mkInput({
        diceSeq: [4, 5, 2, 6, 2, 3, 1],
        geometry: {
          board: { terrain: [], operatives: [] },
          attackerPlacement: { operativeId: 'a', pos: { x: 0, y: 0 }, baseRadius: 0.5 },
          targetPlacement: { operativeId: 'd', pos: { x: 50, y: 0 }, baseRadius: 0.5 },
          range: 12,
        },
      }),
    )
    expect(r.woundsDealt).toBe(0)
    expect(r.traces[1]?.summary).toContain('无效')
    expect(r.traces[1]?.rulings?.some((x) => x.includes('射程'))).toBe(true)
  })

  it('P12：几何合法目标 → 正常造伤（与无几何一致）', () => {
    const r = runShooting(
      mkInput({
        diceSeq: [4, 5, 2, 6, 2, 3, 1],
        geometry: {
          board: { terrain: [], operatives: [] },
          attackerPlacement: { operativeId: 'a', pos: { x: 0, y: 0 }, baseRadius: 0.5 },
          targetPlacement: { operativeId: 'd', pos: { x: 8, y: 0 }, baseRadius: 0.5 },
          range: 12,
        },
      }),
    )
    expect(r.woundsDealt).toBe(10)
    expect(r.traces[1]?.summary).toContain('有效')
  })
})
