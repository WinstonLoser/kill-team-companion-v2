import type { StackingPolicy } from '../rules/types'
import { enforcer } from './enforcer'

// 已应用修正（从 effect 提取，带叠加元数据）
export interface AppliedModifier {
  id: string
  source: string
  stat?: string // 影响的属性（hit/save/damage/move/apl…）
  amount: number
  policy: StackingPolicy
  groupKeys?: string[]
  priority?: number
  cap?: number // CAP_PER_ATTACK_DIE 每源上限（默认 1）
}

// 两层属性模型（FR-2）：base 不可变 + 经 enforcer 过滤的 modifiers
export interface EffectiveStat {
  base: number
  modifiers: AppliedModifier[]
  effective: number
}

export interface EnforcerContext {
  // 预留：攻击骰 id、是否有关键成功等，供 CONDITIONAL 求值（1.6 接入）
  attackerHasCritical?: boolean
}

/**
 * resolveStat：base + Σ(enforcer 过滤后的 modifiers)
 * base 永远来自数据包，运行期不可变；所有变化进 modifiers 并留痕（FR-2 不变量）。
 */
export function resolveStat(
  base: number,
  modifiers: AppliedModifier[],
  ctx: EnforcerContext = {},
): EffectiveStat {
  const filtered = enforcer(modifiers, ctx)
  const effective = base + filtered.reduce((sum, m) => sum + m.amount, 0)
  return { base, modifiers: filtered, effective }
}
