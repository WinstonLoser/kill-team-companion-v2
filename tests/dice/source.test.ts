import { describe, it, expect } from 'vitest'
import {
  ElectronicDiceSource,
  ManualDiceSource,
  hashSeed,
  type DiceSource,
} from '../../src/dice'

describe('ElectronicDiceSource（seedable，可复现）', () => {
  it('同 seed 产出相同序列', () => {
    const seed = hashSeed('p1', 'HIT_ROLL', 0)
    const a = new ElectronicDiceSource(seed).roll(5)
    const b = new ElectronicDiceSource(seed).roll(5)
    expect(a.map((d) => d.nat)).toEqual(b.map((d) => d.nat))
  })

  it('自然点落在 1..6；6=CRITICAL，1=FAIL', () => {
    const d = new ElectronicDiceSource(12345).roll(50)
    for (const r of d) {
      expect(r.nat).toBeGreaterThanOrEqual(1)
      expect(r.nat).toBeLessThanOrEqual(6)
      if (r.nat === 6) expect(r.grade).toBe('CRITICAL')
      if (r.nat === 1) expect(r.grade).toBe('FAIL')
    }
  })

  it('数量正确', () => {
    expect(new ElectronicDiceSource(1).roll(7)).toHaveLength(7)
  })
})

describe('ManualDiceSource（物理骰录入）', () => {
  it('录入后产出同结构 DiceRoll[]', () => {
    const m = new ManualDiceSource()
    m.provide([6, 3, 1, 4])
    const out = m.roll(4)
    expect(out.map((d) => d.nat)).toEqual([6, 3, 1, 4])
    expect(out[0]?.grade).toBe('CRITICAL')
    expect(out[2]?.grade).toBe('FAIL')
  })

  it('数量不足抛错', () => {
    const m = new ManualDiceSource()
    m.provide([2, 3])
    expect(() => m.roll(3)).toThrow()
  })

  it('越界录入抛错', () => {
    const m = new ManualDiceSource()
    expect(() => m.provide([0, 7])).toThrow()
  })
})

describe('骰源无关', () => {
  it('两源实现同一接口，流水线对来源无感知', () => {
    const e: DiceSource = new ElectronicDiceSource(99)
    const m: DiceSource = new ManualDiceSource()
    ;(m as ManualDiceSource).provide([1, 2, 3])
    expect(e.roll(3)).toHaveLength(3)
    expect(m.roll(3)).toHaveLength(3)
  })
})
