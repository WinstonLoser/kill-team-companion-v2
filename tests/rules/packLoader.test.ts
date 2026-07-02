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

  it('W2：DAMAGE_MITIGATION roll 形状不合法拒绝（非 "\d+" / "ignore-once"）', () => {
    const bad = {
      ...corePack,
      effects: [
        {
          effectId: 'mit-bad',
          label: '坏减伤',
          source: 'test',
          trigger: { point: 'ON_DAMAGE_TOTAL' },
          pipelineStep: 'DAMAGE_TOTAL_MITIGATE',
          modifier: { kind: 'DAMAGE_MITIGATION', payload: { threshold: 3, roll: '随便写' } },
          stacking: { policy: 'STACKABLE' },
        },
      ],
    }
    expect(() => loadPack(bad)).toThrow(PackValidationError)
  })

  it('W2：DAMAGE_MITIGATION 合法 roll 形状通过（"5+" / "ignore-once" / "fixed-N"）', () => {
    const mk = (roll: string, threshold = 3) => ({
      ...corePack,
      effects: [
        {
          effectId: 'mit-ok',
          label: '减伤',
          source: 'test',
          trigger: { point: 'ON_DAMAGE_TOTAL' },
          pipelineStep: 'DAMAGE_TOTAL_MITIGATE',
          modifier: { kind: 'DAMAGE_MITIGATION', payload: { threshold, roll } },
          stacking: { policy: 'STACKABLE' },
        },
      ],
    })
    expect(() => loadPack(mk('5+'))).not.toThrow()
    expect(() => loadPack(mk('ignore-once'))).not.toThrow()
    expect(() => loadPack(mk('fixed-1', 0))).not.toThrow() // 瘟疫包恶心韧性：固定减 1，threshold 0=恒定
  })

  it('W2：AUTO_SUCCESS payload 缺 grade 拒绝（per-kind payload-shape 校验）', () => {
    const bad = {
      ...corePack,
      effects: [
        {
          effectId: 'auto-bad',
          label: '自动成功',
          source: 'test',
          trigger: { point: 'AFTER_HIT_ROLL' },
          pipelineStep: 'ATTACK_UPGRADE',
          modifier: { kind: 'AUTO_SUCCESS', payload: { count: 1 } },
          stacking: { policy: 'STACKABLE' },
        },
      ],
    }
    expect(() => loadPack(bad)).toThrow(PackValidationError)
  })
})
