import { describe, it, expect } from 'vitest'
import { loadPack } from '../../src/rules'
import angels from '../../src/data/packs/angels_of_death.v1.json'

// 1.17 T6：规则查询参数化要点单测。
// 每个 effect 必须暴露引擎参数化字段集（trigger/pipelineStep/modifier/stacking），
// rulesRef 指向本地 doc（不渲染 GW 原文 D-29）。无「原文文本」字段。
const pack = loadPack(angels)

describe('规则查询参数化要点（Story 1.17, D-29）', () => {
  it('每个 effect 含完整参数化字段集', () => {
    for (const e of pack.effects) {
      expect(e.trigger.point).toBeTruthy()
      expect(e.pipelineStep).toBeTruthy()
      expect(e.modifier.kind).toBeTruthy()
      expect(e.stacking.policy).toBeTruthy()
      expect(typeof e.label).toBe('string')
    }
  })

  it('effectId 查询命中且字段不含 GW 原文 blob', () => {
    const e = pack.effects.find((x) => x.effectId === 'chapterTactic_sharpshooter')!
    expect(e).toBeTruthy()
    // 参数化要点字段（查询渲染的就是这些）
    const parametric = { kind: e.modifier.kind, point: e.trigger.point, step: e.pipelineStep, policy: e.stacking.policy }
    expect(parametric.kind).toBe('AUTO_SUCCESS')
    expect(parametric.step).toBe('ATTACK_UPGRADE')
    // 无 rawText/gwText/原文 字段
    expect((e as unknown as Record<string, unknown>).rawText).toBeUndefined()
    expect((e as unknown as Record<string, unknown>).gwText).toBeUndefined()
  })

  it('rulesRef 指向本地 docs/rules（doc 名 + section，非公开仓原文）', () => {
    const e = pack.effects.find((x) => x.rulesRef)!
    expect(e.rulesRef!.doc).toBe('merged_kt_angels_of_death_zh.md')
    expect(e.rulesRef!.section).toBeTruthy()
  })

  it('武器 profile 参数化字段齐全（查询武器时渲染）', () => {
    const w = pack.weapons[0]!
    expect(w.profile.attacks).toBeGreaterThan(0)
    expect(w.profile.hit).toBeGreaterThanOrEqual(2)
    expect(w.profile.normalDamage).toBeGreaterThanOrEqual(0)
    expect(w.profile.criticalDamage).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(w.profile.weaponRules)).toBe(true)
  })
})
