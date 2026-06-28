import { describe, it, expect } from 'vitest'
import {
  loadPack,
  PackValidationError,
  RulesetVersionMismatchError,
} from '../../src/rules'
import corePack from '../../src/data/packs/core.kt-lite.v1.json'

const validEffect = {
  effectId: 'e1',
  label: 't',
  source: 'test',
  trigger: { point: 'BEFORE_HIT_ROLL' },
  pipelineStep: 'HIT_ROLL',
  modifier: { kind: 'HIT_PLUS', payload: { amount: 1 } },
  stacking: { policy: 'STACKABLE' },
}

describe('packLoader', () => {
  it('加载合法 core.kt-lite 骨架', () => {
    const pack = loadPack(corePack)
    expect(pack.packId).toBe('core.kt-lite')
    expect(pack.rulesetVersion).toBe('kt-lite-1.0')
  })

  it('缺 trigger.point 拒绝（非静默）', () => {
    const bad = { ...corePack, effects: [{ ...validEffect, trigger: {} }] }
    expect(() => loadPack(bad)).toThrow(PackValidationError)
  })

  it('modifier.kind 越界拒绝', () => {
    const bad = {
      ...corePack,
      effects: [{ ...validEffect, modifier: { kind: 'NOPE', payload: {} } }],
    }
    expect(() => loadPack(bad)).toThrow(PackValidationError)
  })

  it('stacking.policy 非 6 之一拒绝', () => {
    const bad = {
      ...corePack,
      effects: [{ ...validEffect, stacking: { policy: 'WHATEVER' } }],
    }
    expect(() => loadPack(bad)).toThrow(PackValidationError)
  })

  it('rulesetVersion 不符拒绝', () => {
    const bad = { ...corePack, rulesetVersion: 'kt-full-9.9' }
    expect(() => loadPack(bad)).toThrow(RulesetVersionMismatchError)
  })

  it('payload 缺失拒绝（effect 四问兜底）', () => {
    const bad = {
      ...corePack,
      effects: [{ ...validEffect, modifier: { kind: 'HIT_PLUS' } }],
    }
    expect(() => loadPack(bad)).toThrow(PackValidationError)
  })
})
