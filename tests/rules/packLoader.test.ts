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

  // ===== 阶段A护栏：ID 唯一性 + 引用完整性 =====

  const weapon = { weaponId: 'w1', name: 'Test Gun', kind: 'RANGED', profile: { attacks: 4, hit: 3, normalDamage: 3, criticalDamage: 4, range: 8, weaponRules: [] }, keywords: [] }
  const operative = {
    operativeId: 'op1', name: 'Tester', keywords: ['TEST'],
    stats: { apl: 3, move: 6, save: 3, wounds: 10 },
    base: { diameterMm: 32 },
    loadouts: [{ description: 'Standard', options: [['w1']] }],
  }

  it('重复 weaponId 拒绝（如混沌教派旧版同名 autopistol）', () => {
    const bad = { ...corePack, operatives: [operative], weapons: [weapon, { ...weapon, profile: { ...weapon.profile, attacks: 3 } }] }
    expect(() => loadPack(bad)).toThrow(PackValidationError)
  })

  it('重复 operativeId / effectId / stratagem id / wargear id 拒绝', () => {
    expect(() => loadPack({ ...corePack, operatives: [operative, { ...operative }] })).toThrow(PackValidationError)
    expect(() => loadPack({ ...corePack, effects: [validEffect, { ...validEffect }] })).toThrow(PackValidationError)
    expect(() => loadPack({ ...corePack, stratagems: [{ id: 's1', name: 'S', cp: 1, useLimit: {}, phase: 'STRATEGY' }, { id: 's1', name: 'S2', cp: 1, useLimit: {}, phase: 'STRATEGY' }] })).toThrow(PackValidationError)
    expect(() => loadPack({ ...corePack, wargear: [{ id: 'g1', name: 'G' }, { id: 'g1', name: 'G2' }] })).toThrow(PackValidationError)
  })

  it('loadouts 武器引用悬空拒绝', () => {
    const bad = { ...corePack, operatives: [operative], weapons: [] }
    expect(() => loadPack(bad)).toThrow(PackValidationError)
  })

  it('abilityRefs / factionRuleRefs 悬空拒绝', () => {
    const withAbilityRef = { ...corePack, operatives: [{ ...operative, abilityRefs: ['nope'] }], weapons: [weapon] }
    expect(() => loadPack(withAbilityRef)).toThrow(PackValidationError)
    const withRuleRef = { ...corePack, operatives: [{ ...operative, factionRuleRefs: ['nope'] }], weapons: [weapon] }
    expect(() => loadPack(withRuleRef)).toThrow(PackValidationError)
  })

  it('subFactionSelector 选项悬空拒绝（须指向 effect 或 factionRule）', () => {
    const bad = {
      ...corePack,
      faction: { ...corePack.faction, subFactionSelector: { id: 'sel', label: '选择', options: ['ghost'], max: 1 } },
    }
    expect(() => loadPack(bad)).toThrow(PackValidationError)
  })
})
