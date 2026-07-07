import { describe, it, expect } from 'vitest'
import { loadPack, type Effect } from '../../src'
import { effectiveMove } from '../../src/state/turnStateMachine'
import legionaries from '../../src/data/packs/legionaries.v1.json'

const pack = loadPack(legionaries)
const slaanesh = pack.effects.find((e) => e.effectId === 'mark_slaanesh')! as Effect

describe('5-2 movement resolver（effectiveMove + STAT_OVERRIDE{stat:"move"}）', () => {
  it('mark_slaanesh 已转 STAT_OVERRIDE{stat:"move", value:1}', () => {
    expect(slaanesh.modifier.kind).toBe('STAT_OVERRIDE')
    expect((slaanesh.modifier.payload as { stat: string }).stat).toBe('move')
    expect((slaanesh.modifier.payload as { value: number }).value).toBe(1)
  })

  it('effectiveMove(6, []) = 6（无 effect）', () => {
    expect(effectiveMove(6, [])).toBe(6)
  })

  it('effectiveMove(6, [mark_slaanesh]) = 7（+1）', () => {
    expect(effectiveMove(6, [slaanesh])).toBe(7)
  })

  it('effectiveMove(5, [mark_slaanesh]) = 6（move 5 operative +1）', () => {
    expect(effectiveMove(5, [slaanesh])).toBe(6)
  })
})
