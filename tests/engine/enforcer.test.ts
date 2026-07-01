import { describe, it, expect } from 'vitest'
import { enforcer, enforcerWithTrace, resolveStat } from '../../src/engine'
import type { AppliedModifier } from '../../src/engine'

const mk = (over: Partial<AppliedModifier>): AppliedModifier => ({
  id: over.id ?? 'm',
  source: over.source ?? 's',
  amount: over.amount ?? 1,
  policy: over.policy ?? 'STACKABLE',
  ...over,
})

describe('enforcer — 12 条叠加规则', () => {
  it('R10 STACKABLE：全部保留', () => {
    const out = enforcer([
      mk({ id: 'a', source: 'x', amount: 1, policy: 'STACKABLE' }),
      mk({ id: 'b', source: 'y', amount: 2, policy: 'STACKABLE' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('R6 UNIQUE_PER_SOURCE：同 source 只留一个', () => {
    const out = enforcer([
      mk({ id: 'a', source: 'tactic', amount: 1, policy: 'UNIQUE_PER_SOURCE' }),
      mk({ id: 'b', source: 'tactic', amount: 1, policy: 'UNIQUE_PER_SOURCE' }),
    ])
    expect(out).toHaveLength(1)
  })

  it('R1 UNIQUE_PER_GROUP：同类升级同组只留最高优先级', () => {
    const out = enforcer([
      mk({ id: 'a', source: 'rending', amount: 0, policy: 'UNIQUE_PER_GROUP', groupKeys: ['upgrade-critical'], priority: 10 }),
      mk({ id: 'b', source: 'severe', amount: 0, policy: 'UNIQUE_PER_GROUP', groupKeys: ['upgrade-critical'], priority: 5 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]?.id).toBe('a')
  })

  it('R4 MUTUALLY_EXCLUSIVE_WITH：命中-1 不与受创叠（同组互斥）', () => {
    const out = enforcer([
      mk({ id: 'contagion', source: 'contagion', amount: -1, policy: 'MUTUALLY_EXCLUSIVE_WITH', groupKeys: ['hit-minus-debuff'], priority: 10 }),
      mk({ id: 'injured', source: 'injured', amount: -1, policy: 'MUTUALLY_EXCLUSIVE_WITH', groupKeys: ['hit-minus-debuff'], priority: 5 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]?.id).toBe('contagion')
  })

  it('R3 CAP_PER_ATTACK_DIE：同源减伤每枚上限 1', () => {
    const out = enforcer([
      mk({ id: 'a', source: 'release-demon', amount: -1, policy: 'CAP_PER_ATTACK_DIE', cap: 1 }),
      mk({ id: 'b', source: 'release-demon', amount: -1, policy: 'CAP_PER_ATTACK_DIE', cap: 1 }),
    ])
    expect(out).toHaveLength(1) // 第二条被 cap 拦
  })

  it('CONDITIONAL 透传（条件求值在触发层）', () => {
    const out = enforcer([mk({ id: 'a', policy: 'CONDITIONAL', amount: 0 })])
    expect(out).toHaveLength(1)
  })

  it('R9 UNIQUE_PER_ACTION：同 actionId 每行动只留一个（过热每行动一次）', () => {
    const out = enforcer([
      mk({ id: 'a', source: 'overheat', policy: 'UNIQUE_PER_ACTION', actionId: 'act1' }),
      mk({ id: 'b', source: 'overheat', policy: 'UNIQUE_PER_ACTION', actionId: 'act1' }),
    ])
    expect(out).toHaveLength(1) // 第二条同 actionId 被去重
  })

  it('R9 不同 actionId 各留一个', () => {
    const out = enforcer([
      mk({ id: 'a', policy: 'UNIQUE_PER_ACTION', actionId: 'act1' }),
      mk({ id: 'b', policy: 'UNIQUE_PER_ACTION', actionId: 'act2' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('R9 无 actionId 退化为每源唯一（保持一次）', () => {
    const out = enforcer([
      mk({ id: 'a', source: 'oh', policy: 'UNIQUE_PER_ACTION' }),
      mk({ id: 'b', source: 'oh', policy: 'UNIQUE_PER_ACTION' }),
    ])
    expect(out).toHaveLength(1)
  })

  it('R7 CONDITIONAL：带 condition + evalCondition=false → 丢弃', () => {
    const out = enforcer(
      [mk({ id: 'a', policy: 'CONDITIONAL', condition: { op: 'attackerHasCritical' } })],
      { evalCondition: () => false },
    )
    expect(out).toHaveLength(0)
  })

  it('R7 CONDITIONAL：evalCondition=true → 保留', () => {
    const out = enforcer(
      [mk({ id: 'a', policy: 'CONDITIONAL', condition: { op: 'attackerHasCritical' } })],
      { evalCondition: () => true },
    )
    expect(out).toHaveLength(1)
  })

  it('CONDITIONAL 无 evalCondition → 透传（谓词库 1.6 接入前向后兼容）', () => {
    const out = enforcer([mk({ id: 'a', policy: 'CONDITIONAL', condition: { op: 'attackerHasCritical' } })])
    expect(out).toHaveLength(1)
  })
})

describe('resolveStat — 两层属性模型', () => {
  it('base + 过滤后 modifiers = effective；base 不变', () => {
    const r = resolveStat(3, [
      mk({ id: 'a', source: 'x', amount: 1, policy: 'STACKABLE', stat: 'hit' }),
      mk({ id: 'b', source: 'x', amount: 1, policy: 'UNIQUE_PER_SOURCE', stat: 'hit' }),
      mk({ id: 'c', source: 'x', amount: 1, policy: 'UNIQUE_PER_SOURCE', stat: 'hit' }),
    ])
    // UNIQUE_PER_SOURCE 同源只留一个 → 1 + 1(a stackable) + 1(one of b/c) = 3
    expect(r.base).toBe(3)
    expect(r.effective).toBe(5)
  })
})

describe('enforcerWithTrace — 被拒留痕（P2-trace / FR-17 可审计）', () => {
  it('R6 UNIQUE_PER_SOURCE：被拒方进 rejected 带 ruleId', () => {
    const out = enforcerWithTrace([
      mk({ id: 'a', source: 'tactic', policy: 'UNIQUE_PER_SOURCE', priority: 10 }),
      mk({ id: 'b', source: 'tactic', policy: 'UNIQUE_PER_SOURCE', priority: 5 }),
    ])
    expect(out.kept.map((m) => m.id)).toEqual(['a'])
    expect(out.rejected).toHaveLength(1)
    expect(out.rejected[0]?.id).toBe('b')
    expect(out.rejected[0]?.ruleId).toBe('R6')
    expect(out.rejected[0]?.reason).toBeTruthy()
  })

  it('R3 CAP_PER_ATTACK_DIE：超 cap 被拒带 ruleId', () => {
    const out = enforcerWithTrace([
      mk({ id: 'a', source: 'rd', policy: 'CAP_PER_ATTACK_DIE', cap: 1 }),
      mk({ id: 'b', source: 'rd', policy: 'CAP_PER_ATTACK_DIE', cap: 1 }),
    ])
    expect(out.kept).toHaveLength(1)
    expect(out.rejected[0]?.id).toBe('b')
    expect(out.rejected[0]?.ruleId).toBe('R3')
  })

  it('R7 CONDITIONAL：evalCondition=false 被拒', () => {
    const out = enforcerWithTrace(
      [mk({ id: 'a', policy: 'CONDITIONAL', condition: { op: 'attackerHasCritical' } })],
      { evalCondition: () => false },
    )
    expect(out.kept).toHaveLength(0)
    expect(out.rejected[0]?.id).toBe('a')
    expect(out.rejected[0]?.ruleId).toBe('R2/R7')
  })

  it('enforcer 与 enforcerWithTrace.kept 一致（向后兼容）', () => {
    const mods = [
      mk({ id: 'a', source: 's', policy: 'UNIQUE_PER_SOURCE' }),
      mk({ id: 'b', source: 's', policy: 'UNIQUE_PER_SOURCE' }),
    ]
    expect(enforcer(mods)).toEqual(enforcerWithTrace(mods).kept)
  })
})
