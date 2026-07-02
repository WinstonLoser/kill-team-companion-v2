import { describe, it, expect } from 'vitest'
import { evalPredicate, PREDICATE_OPS, type PredicateContext } from '../../src/rules/predicates'

const c = (over: Partial<PredicateContext> = {}): PredicateContext => over

describe('谓词库 evalPredicate（Story 3.2 AQ-3）', () => {
  it('weaponKindIs / rangeBucket', () => {
    expect(evalPredicate({ op: 'weaponKindIs', args: ['MELEE'] }, c({ weaponKind: 'MELEE' }))).toBe(true)
    expect(evalPredicate({ op: 'weaponKindIs', args: ['RANGED'] }, c({ weaponKind: 'MELEE' }))).toBe(false)
    expect(evalPredicate({ op: 'rangeBucket', args: ['WITHIN_6IN'] }, c({ rangeInches: 4 }))).toBe(true)
    expect(evalPredicate({ op: 'rangeBucket', args: ['WITHIN_6IN'] }, c({ rangeInches: 8 }))).toBe(false)
  })

  it('attackerHasKeyword / targetHasMarker / operativeHasMarker', () => {
    expect(evalPredicate({ op: 'attackerHasKeyword', args: ['NURGLE'] }, c({ attackerKeywords: ['CHAOS', 'NURGLE'] }))).toBe(true)
    expect(evalPredicate({ op: 'targetHasMarker', args: ['POISON'] }, c({ targetMarkers: ['POISON'] }))).toBe(true)
    expect(evalPredicate({ op: 'operativeHasMarker', args: ['POISON'] }, c({ operativeMarkers: [] }))).toBe(false)
  })

  it('operativeIsInjured / dealtAnyDamageThisPipeline', () => {
    expect(evalPredicate({ op: 'operativeIsInjured' }, c({ operativeInjured: true }))).toBe(true)
    expect(evalPredicate({ op: 'dealtAnyDamageThisPipeline' }, c({ dealtAnyDamage: true }))).toBe(true)
    expect(evalPredicate({ op: 'dealtAnyDamageThisPipeline' }, c({}))).toBe(false)
  })

  it('dieFaceEquals（腐烂诅咒：掷出 3）', () => {
    expect(evalPredicate({ op: 'dieFaceEquals', args: [3] }, c({ dieFace: 3 }))).toBe(true)
    expect(evalPredicate({ op: 'dieFaceEquals', args: [3] }, c({ dieFace: 5 }))).toBe(false)
  })

  it('notSameFaction（毒素不挂己方瘟疫）', () => {
    expect(evalPredicate({ op: 'notSameFaction' }, c({ attackerFaction: 'plague_marines', targetFaction: 'angels_of_death' }))).toBe(true)
    expect(evalPredicate({ op: 'notSameFaction' }, c({ attackerFaction: 'plague_marines', targetFaction: 'plague_marines' }))).toBe(false)
  })

  it('all / any 组合', () => {
    const p = { op: 'all', all: [{ op: 'targetHasMarker', args: ['POISON'] }, { op: 'notSameFaction' }] }
    expect(evalPredicate(p, c({ targetMarkers: ['POISON'], attackerFaction: 'a', targetFaction: 'b' }))).toBe(true)
    expect(evalPredicate(p, c({ targetMarkers: [], attackerFaction: 'a', targetFaction: 'b' }))).toBe(false)
    const any = { op: 'any', any: [{ op: 'operativeIsInjured' }, { op: 'always' }] }
    expect(evalPredicate(any, c({}))).toBe(true) // always 命中
  })

  it('未知 op → false（穷尽保护，不静默猜）', () => {
    expect(evalPredicate({ op: 'nonexistentPredicate' }, c({}))).toBe(false)
  })

  it('PREDICATE_OPS 封闭集（11 项）', () => {
    expect(PREDICATE_OPS).toContain('dieFaceEquals')
    expect(PREDICATE_OPS).toContain('notSameFaction')
    expect(PREDICATE_OPS.length).toBe(11)
  })

  it('rangeBucket 缺省距离 → false（P2：不静默满足 BEYOND_*）', () => {
    expect(evalPredicate({ op: 'rangeBucket', args: ['BEYOND_6IN'] }, c({}))).toBe(false)
    expect(evalPredicate({ op: 'rangeBucket', args: ['WITHIN_6IN'] }, c({}))).toBe(false)
    // 边界：恰好 6 → WITHIN_6IN 真
    expect(evalPredicate({ op: 'rangeBucket', args: ['WITHIN_6IN'] }, c({ rangeInches: 6 }))).toBe(true)
  })

  it('空 args → false（weaponKindIs/targetHasMarker 等不静默真）', () => {
    expect(evalPredicate({ op: 'weaponKindIs', args: [] }, c({ weaponKind: 'MELEE' }))).toBe(false)
    expect(evalPredicate({ op: 'targetHasMarker' }, c({ targetMarkers: ['POISON'] }))).toBe(false)
  })
})
