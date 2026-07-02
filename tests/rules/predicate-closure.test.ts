import { describe, it, expect } from 'vitest'
import { loadPack } from '../../src/rules'
import { MODIFIER_KINDS, STACKING_POLICIES, TRIGGER_POINTS, PIPELINE_STEPS } from '../../src/rules/types'
import angels from '../../src/data/packs/angels_of_death.v1.json'
import legionaries from '../../src/data/packs/legionaries.v1.json'
import plague from '../../src/data/packs/plague_marines.v1.json'

// Story 2.2 护栏（AQ-3 封闭性）：每个数据包的 effect 必须只用枚举内的 modifier.kind
// 与 stacking.policy。引入未枚举项 → 红，强制回盘点（加阵营=加数据，不改枚举除非证明必要）。

const PACKS = [
  { name: 'angels_of_death', raw: angels },
  { name: 'legionaries', raw: legionaries },
  { name: 'plague_marines', raw: plague },
]

describe('AQ-3 封闭性护栏（Story 2.2）', () => {
  for (const { name, raw } of PACKS) {
    describe(`pack ${name}`, () => {
      const pack = loadPack(raw)
      const modifierKinds = new Set(MODIFIER_KINDS as readonly string[])
      const policies = new Set(STACKING_POLICIES as readonly string[])
      const triggers = new Set(TRIGGER_POINTS as readonly string[])
      const steps = new Set(PIPELINE_STEPS as readonly string[])

      it('每个 effect 的 modifier.kind 属枚举（21 种）', () => {
        const outside: string[] = []
        for (const e of pack.effects) {
          if (!modifierKinds.has(e.modifier.kind)) outside.push(`${e.effectId}: ${e.modifier.kind}`)
        }
        expect(outside, `未枚举 modifier.kind: ${outside.join(', ')}`).toEqual([])
      })

      it('每个 effect 的 stacking.policy 属枚举（7 种）', () => {
        const outside: string[] = []
        for (const e of pack.effects) {
          if (!policies.has(e.stacking.policy)) outside.push(`${e.effectId}: ${e.stacking.policy}`)
        }
        expect(outside, `未枚举 policy: ${outside.join(', ')}`).toEqual([])
      })

      it('每个 effect 的 trigger.point 属枚举（防 typo dead-effect）', () => {
        const outside: string[] = []
        for (const e of pack.effects) {
          if (!triggers.has(e.trigger.point)) outside.push(`${e.effectId}: ${e.trigger.point}`)
        }
        expect(outside, `未枚举 trigger.point: ${outside.join(', ')}`).toEqual([])
      })

      it('每个 effect 的 pipelineStep 属枚举（防 typo dead-effect）', () => {
        const outside: string[] = []
        for (const e of pack.effects) {
          if (!steps.has(e.pipelineStep)) outside.push(`${e.effectId}: ${e.pipelineStep}`)
        }
        expect(outside, `未枚举 pipelineStep: ${outside.join(', ')}`).toEqual([])
      })

      it('每个 effect 四问齐全（trigger.point/pipelineStep/modifier.kind/stacking.policy）', () => {
        const incomplete: string[] = []
        for (const e of pack.effects) {
          if (!e.trigger?.point || !e.pipelineStep || !e.modifier?.kind || !e.stacking?.policy) {
            incomplete.push(e.effectId)
          }
        }
        expect(incomplete, `四问缺失: ${incomplete.join(', ')}`).toEqual([])
      })
    })
  }

  it('军团兵 effect 100% 复用现有 kind/policy（0 新增需求）', () => {
    const pack = loadPack(legionaries)
    expect(pack.effects.length).toBeGreaterThanOrEqual(18)
    // 全部 kind 都在枚举内 = 无新 modifier 需求（AC2 ≥95% 实为 100%）
    const allKinds = new Set(pack.effects.map((e) => e.modifier.kind))
    for (const k of allKinds) expect(MODIFIER_KINDS).toContain(k)
    const allPolicies = new Set(pack.effects.map((e) => e.stacking.policy))
    for (const p of allPolicies) expect(STACKING_POLICIES).toContain(p)
  })
})
