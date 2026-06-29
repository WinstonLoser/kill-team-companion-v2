import { describe, it, expect } from 'vitest'
import schema from '../../src/rules/schema/faction-pack.schema.json'
import { MODIFIER_KINDS, TRIGGER_POINTS, STACKING_POLICIES } from '../../src/rules/types'

// 防漂移：TS const 枚举与 JSON Schema enum 必须一致
// JSON 结构含非 enum 的 $defs.effect，用 any 取目标 enum（测试代码）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defs = (schema as any).$defs as Record<string, { enum: string[] }>

describe('schema 与 TS 类型同源', () => {
  it('modifier.kind 一致（含 HEAL_OPERATIVE，21 种）', () => {
    const kinds = defs.modifierKind?.enum ?? []
    expect([...kinds].sort()).toEqual([...MODIFIER_KINDS].sort())
    expect(kinds).toHaveLength(21)
  })

  it('trigger.point 一致', () => {
    const pts = defs.triggerPoint?.enum ?? []
    expect([...pts].sort()).toEqual([...TRIGGER_POINTS].sort())
  })

  it('stacking.policy 一致（7 种，含 DN2 R9 UNIQUE_PER_ACTION）', () => {
    const pols = defs.stackingPolicy?.enum ?? []
    expect([...pols].sort()).toEqual([...STACKING_POLICIES].sort())
    expect(pols).toHaveLength(7)
  })
})
