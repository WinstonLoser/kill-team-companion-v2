import { describe, it, expect } from 'vitest'
import { resolveStat, resolveEffects } from '../../src/engine/statResolver'
import type { Effect } from '../../src/rules'
import type { AppliedModifier } from '../../src/engine'

const mk = (over: Partial<AppliedModifier>): AppliedModifier => ({
  id: over.id ?? 'm',
  source: over.source ?? 's',
  amount: over.amount ?? 1,
  policy: over.policy ?? 'STACKABLE',
  ...over,
})

describe('resolveEffects — effect→enforcer 过滤的共享核心（P22 去重）', () => {
  it('按 trigger.point + modifier.kind 过滤并经 enforcer', () => {
    const effects: Effect[] = [
      {
        effectId: 'a', label: 'hm', source: 'src',
        trigger: { point: 'BEFORE_HIT_ROLL' }, pipelineStep: 'HIT_ROLL',
        modifier: { kind: 'HIT_MINUS', payload: { amount: 1 } }, stacking: { policy: 'STACKABLE' },
      },
      {
        effectId: 'b', label: 'hp', source: 'src',
        trigger: { point: 'BEFORE_HIT_ROLL' }, pipelineStep: 'HIT_ROLL',
        modifier: { kind: 'HIT_PLUS', payload: { amount: 1 } }, stacking: { policy: 'STACKABLE' },
      },
      {
        effectId: 'c', label: 'other', source: 'src',
        trigger: { point: 'ON_DAMAGE_TOTAL' }, pipelineStep: 'DAMAGE_TOTAL_MITIGATE',
        modifier: { kind: 'DAMAGE_MITIGATION', payload: { threshold: 3, roll: '5+' } }, stacking: { policy: 'STACKABLE' },
      },
    ]
    const out = resolveEffects(effects, 'BEFORE_HIT_ROLL', ['HIT_MINUS'])
    expect(out).toHaveLength(1)
    expect(out[0]?.id).toBe('a')
    expect(out[0]?.amount).toBe(1)
  })

  it('UNIQUE_PER_SOURCE 经 enforcer 去重', () => {
    const effects: Effect[] = [
      {
        effectId: 'a', label: 'x', source: 'tactic',
        trigger: { point: 'BEFORE_HIT_ROLL' }, pipelineStep: 'HIT_ROLL',
        modifier: { kind: 'HIT_MINUS', payload: { amount: 1 } }, stacking: { policy: 'UNIQUE_PER_SOURCE' },
      },
      {
        effectId: 'b', label: 'x', source: 'tactic',
        trigger: { point: 'BEFORE_HIT_ROLL' }, pipelineStep: 'HIT_ROLL',
        modifier: { kind: 'HIT_MINUS', payload: { amount: 1 } }, stacking: { policy: 'UNIQUE_PER_SOURCE' },
      },
    ]
    expect(resolveEffects(effects, 'BEFORE_HIT_ROLL', ['HIT_MINUS'])).toHaveLength(1)
  })
})

describe('resolveStat — 两层属性模型（P22 生产路由）', () => {
  it('base + 符号化 modifiers = effective（HIT_MINUS 升阈 / HIT_PLUS 降阈）', () => {
    // 模拟射击 HIT_ROLL：base=3，HIT_MINUS(+1) 升阈，HIT_PLUS 取负(-1) 降阈
    const r = resolveStat(3, [
      mk({ id: 'hm', amount: 1 }),
      mk({ id: 'hp', amount: -1 }),
    ])
    expect(r.base).toBe(3)
    expect(r.effective).toBe(3)
    expect(r.modifiers).toHaveLength(2)
  })
})
