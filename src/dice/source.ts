// 骰源无关输入层（FR-3）。纯逻辑，零 UI 依赖。

export type DiceGrade = 'NORMAL' | 'CRITICAL' | 'FAIL'

export interface DiceRoll {
  nat: 1 | 2 | 3 | 4 | 5 | 6 // 自然点
  grade: DiceGrade // 由命中属性判定，或关键(6)/必败(1)预设
}

export interface DiceSource {
  roll(n: number): DiceRoll[]
}

/**
 * 电子骰：seedable PRNG（Mulberry32）。seed = hash(pipelineId, stepId, attempt) 由调用方注入，
 * 结果可复现（FR-17 回放）。本类不直接用 Math.random。
 */
export class ElectronicDiceSource implements DiceSource {
  private seedable: () => number
  // grade 由调用方据命中属性后置判定；此处只产自然点 + 占位 grade（NORMAL，后续 step 覆写）
  constructor(seed: number) {
    this.seedable = mulberry32(seed >>> 0)
  }
  roll(n: number): DiceRoll[] {
    const out: DiceRoll[] = []
    for (let i = 0; i < n; i++) {
      const nat = d6(this.seedable)
      out.push({ nat, grade: nat === 6 ? 'CRITICAL' : nat === 1 ? 'FAIL' : 'NORMAL' })
    }
    return out
  }
}

/** 物理骰：玩家手投后录入每颗自然点，产出同结构 DiceRoll[]。 */
export class ManualDiceSource implements DiceSource {
  private provided: number[] = []
  provide(nats: number[]): void {
    if (nats.some((d) => d < 1 || d > 6)) throw new Error('ManualDiceSource: dice must be 1..6')
    this.provided = nats
  }
  roll(n: number): DiceRoll[] {
    if (this.provided.length < n) {
      throw new Error(`ManualDiceSource: need ${n} dice, ${this.provided.length} provided`)
    }
    const take = this.provided.slice(0, n)
    this.provided = this.provided.slice(n)
    return take.map((nat) => {
      const d = clamp6(nat)
      return { nat: d, grade: d === 6 ? 'CRITICAL' : d === 1 ? 'FAIL' : 'NORMAL' }
    })
  }
}

/** hash 确定性种子（不依赖 Date.now/Math.random）。 */
export function hashSeed(pipelineId: string, stepId: string, attempt: number): number {
  const s = `${pipelineId}|${stepId}|${attempt}`
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

function d6(rng: () => number): 1 | 2 | 3 | 4 | 5 | 6 {
  return (Math.floor(rng() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6
}

function clamp6(n: number): 1 | 2 | 3 | 4 | 5 | 6 {
  return Math.max(1, Math.min(6, Math.round(n))) as 1 | 2 | 3 | 4 | 5 | 6
}

// Mulberry32 PRNG
function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
