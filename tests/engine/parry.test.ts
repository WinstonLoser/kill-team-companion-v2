import { describe, it, expect } from 'vitest'
import { parryAllocation, subtractPool, type Pool } from '../../src/engine'

const pool = (normal: number, critical: number): Pool => ({ normal, critical })

describe('parryAllocation — 共用格挡矩阵（P4 统一 / DN3）', () => {
  it('1 关键抵 1 关键', () => {
    const r = parryAllocation(pool(0, 1), pool(0, 1))
    expect(r.survivor).toEqual(pool(0, 0))
    expect(r.used).toEqual(pool(0, 1))
  })

  it('2 普通抵 1 关键', () => {
    const r = parryAllocation(pool(2, 0), pool(0, 1))
    expect(r.survivor).toEqual(pool(0, 0))
    expect(r.used).toEqual(pool(2, 0))
  })

  it('1 关键抵 1 普通', () => {
    const r = parryAllocation(pool(0, 1), pool(1, 0))
    expect(r.survivor).toEqual(pool(0, 0))
    expect(r.used).toEqual(pool(0, 1))
  })

  it('1 普通抵 1 普通', () => {
    const r = parryAllocation(pool(1, 0), pool(1, 0))
    expect(r.survivor).toEqual(pool(0, 0))
    expect(r.used).toEqual(pool(1, 0))
  })

  it('优先级：关键抵关键 → 2普通抵关键 → 关键抵普通 → 普通抵普通', () => {
    // parrier {N:2,C:1} vs target {N:1,C:2}
    const r = parryAllocation(pool(2, 1), pool(1, 2))
    // 关键抵关键: tC 2→1, pC 1→0
    // 2普通抵关键: tC 1→0, pN 2→0
    // 关键抵普通: pC=0 跳过
    // 普通抵普通: pN=0 跳过 → tN 1 未抵
    expect(r.survivor).toEqual(pool(1, 0))
    expect(r.used).toEqual(pool(2, 1))
  })

  it('格挡方不足 → 目标有剩余，used 仅记消耗', () => {
    const r = parryAllocation(pool(1, 0), pool(3, 0))
    expect(r.survivor).toEqual(pool(2, 0))
    expect(r.used).toEqual(pool(1, 0))
  })

  it('子决策日志：每次取消一条', () => {
    const r = parryAllocation(pool(2, 1), pool(1, 2))
    // 关键抵关键 + 2普通抵关键（pC/pN 耗尽，普通抵普通未发生）
    expect(r.log).toHaveLength(2)
    expect(r.log).toEqual(['关键抵关键', '2普通抵关键'])
  })

  it('subtractPool：逐类相减（消耗后剩余出击池）', () => {
    expect(subtractPool(pool(3, 2), pool(1, 1))).toEqual(pool(2, 1))
  })
})
