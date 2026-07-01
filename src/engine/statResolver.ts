import type { Effect, StackingPolicy, ConditionPredicate } from '../rules/types'
import { enforcer, enforcerWithTrace } from './enforcer'
import type { RejectionTrace } from './enforcer'

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
  actionId?: string // UNIQUE_PER_ACTION（R9）：标识所属行动实例，过热每行动一次
  condition?: ConditionPredicate // CONDITIONAL（R2/R7）：触发条件；evalCondition 求值（谓词库 1.6 接入）
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
  // CONDITIONAL（R2/R7）条件求值器：谓词库（Story 1.6）注入；未注入则透传（向后兼容）
  evalCondition?: (cond: ConditionPredicate) => boolean
  // R3 CAP_PER_ATTACK_DIE 每骰语义（DN5）：本结算攻击成功骰数（atkN+atkC）。
  // 实际上限 = cap × attackDiceCount；省略则按 1 枚骰（向后兼容）。
  attackDiceCount?: number
}

/** effect → AppliedModifier（提取 payload.amount/cap + 叠加元数据）。 */
export function toAppliedModifier(e: Effect): AppliedModifier {
  const p = e.modifier.payload as { amount?: number; cap?: number }
  return {
    id: e.effectId,
    source: e.source,
    amount: p.amount ?? 0,
    policy: e.stacking.policy,
    groupKeys: e.stacking.groupKeys,
    priority: e.priority,
    cap: p.cap,
  }
}

/**
 * resolveEffects：按 trigger.point + modifier.kind 过滤 effect 栈 → AppliedModifier → enforcer 过滤。
 * pipeline 与属性解析的共享核心（P22：消除 pipeline 自建 modsOf 的重复）。
 */
export function resolveEffects(
  effects: Effect[],
  point: string,
  kinds: string[],
  ctx: EnforcerContext = {},
): AppliedModifier[] {
  const matched = effects.filter((e) => e.trigger.point === point && kinds.includes(e.modifier.kind))
  return enforcer(matched.map(toAppliedModifier), ctx)
}

/**
 * resolveEffectsTraced：同 resolveEffects 但返回被拒项（P2-trace：rejectedEffectIds 留痕）。
 */
export function resolveEffectsTraced(
  effects: Effect[],
  point: string,
  kinds: string[],
  ctx: EnforcerContext = {},
): { applied: AppliedModifier[]; rejected: RejectionTrace[] } {
  const matched = effects.filter((e) => e.trigger.point === point && kinds.includes(e.modifier.kind))
  const { kept, rejected } = enforcerWithTrace(matched.map(toAppliedModifier), ctx)
  return { applied: kept, rejected }
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
