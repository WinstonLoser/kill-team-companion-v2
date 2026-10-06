import { describe, it, expect } from 'vitest'
import { loadPack, type Effect } from '../../src'
import { effectiveMove } from '../../src/state/turnStateMachine'
import legionaries from '../../src/data/packs/legionaries.v1.json'

const pack = loadPack(legionaries)
const slaanesh = pack.effects.find((e) => e.effectId === 'mark_slaanesh')! as Effect

const movementBonus: Effect = { ...slaanesh, effectId: 'test_movement_bonus', modifier: { kind: 'STAT_OVERRIDE', payload: { stat: 'move', value: 1 } } }

describe('5-2 movement resolver（effectiveMove + STAT_OVERRIDE{stat:"move"}）', () => {
  it('当前色孽印记保留玩家裁定提示', () => {
    expect(slaanesh.modifier.kind).toBe('CUSTOM_HOOK')
  })

  it('effectiveMove(6, []) = 6（无 effect）', () => {
    expect(effectiveMove(6, [])).toBe(6)
  })

  it('可消费显式移动加成，不擅自应用待裁定印记', () => {
    expect(effectiveMove(6, [movementBonus])).toBe(7)
    expect(effectiveMove(6, [slaanesh])).toBe(6)
  })

  it('基础移动 5 的特工同样可消费显式加成', () => {
    expect(effectiveMove(5, [movementBonus])).toBe(6)
  })
})
