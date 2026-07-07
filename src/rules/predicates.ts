// 声明式条件谓词库（架构 §2.5，AQ-3 封闭集）。纯函数 + 有限封闭，不引入通用 JS eval
// （安全 + CSP + 可审计）。Story 3.2 落地——3 阵营全编后的 AQ-3 收口。
//
// 状态：谓词纯函数 + evalPredicate 分派器已实现 + 单测覆盖。
// 引擎接线（待独立任务）：enforcer CONDITIONAL 的 evalCondition 注入点接 evalPredicate，
// + pipeline ctx 携带 marker 状态/阵营/dealtDamage/dieFace。接线前 CONDITIONAL 透传（不拒不验）。

import type { ConditionPredicate } from './types'

/** 谓词求值上下文（pipeline 接线时由引擎注入；此处纯数据）。 */
export interface PredicateContext {
  attackerKeywords?: string[]
  attackerFaction?: string
  targetKeywords?: string[]
  targetFaction?: string
  targetMarkers?: string[] // 目标身上的指示物 marker
  weaponKind?: 'RANGED' | 'MELEE'
  rangeInches?: number
  /** 激活/受 effect 的特工自身状态（operativeHasMarker/operativeIsInjured 用） */
  operativeMarkers?: string[]
  operativeInjured?: boolean
  dealtAnyDamage?: boolean // 本流水线是否已造成任何伤害
  dieFace?: number // 某枚骰面值（dieFaceEquals 用）
}

type Op = string

/** 求值单条原子谓词（op + args）。未知 op → false（穷尽保护，NFR-5 不静默猜）。 */
function evalAtom(op: Op, args: (string | number)[], ctx: PredicateContext): boolean {
  switch (op) {
    case 'weaponKindIs':
      return ctx.weaponKind !== undefined && args.includes(ctx.weaponKind)
    case 'rangeBucket': {
      // args = [桶名...]：WITHIN_6IN(≤6) / BEYOND_6IN(>6) 等。
      // P2：rangeInches 缺省（pipeline 未注入距离）→ 恒 false，不静默满足 BEYOND_*。
      if (ctx.rangeInches === undefined) return false
      const r = ctx.rangeInches
      return args.some((b) => {
        const s = String(b)
        if (s === 'WITHIN_6IN') return r <= 6
        if (s === 'BEYOND_6IN') return r > 6
        if (s === 'WITHIN_12IN') return r <= 12
        return false
      })
    }
    case 'attackerHasKeyword':
      return ctx.attackerKeywords !== undefined && args.some((k) => ctx.attackerKeywords!.includes(String(k)))
    case 'targetHasKeyword':
      return ctx.targetKeywords !== undefined && args.some((k) => ctx.targetKeywords!.includes(String(k)))
    case 'targetHasMarker':
      return ctx.targetMarkers !== undefined && args.some((m) => ctx.targetMarkers!.includes(String(m)))
    case 'targetHasNoMarker':
      return ctx.targetMarkers === undefined || args.every((m) => !ctx.targetMarkers!.includes(String(m)))
    case 'operativeHasMarker':
      return ctx.operativeMarkers !== undefined && args.some((m) => ctx.operativeMarkers!.includes(String(m)))
    case 'operativeIsInjured':
      return Boolean(ctx.operativeInjured)
    case 'dealtAnyDamageThisPipeline':
      return Boolean(ctx.dealtAnyDamage)
    case 'dieFaceEquals':
      return ctx.dieFace !== undefined && args.includes(ctx.dieFace)
    case 'notSameFaction':
      return ctx.attackerFaction !== undefined && ctx.targetFaction !== undefined && ctx.attackerFaction !== ctx.targetFaction
    case 'always':
      return true
    default:
      return false // 未知谓词 → false（穷尽保护）
  }
}

/** 求值 ConditionPredicate（支持 all/any 组合 + 原子 op）。 */
export function evalPredicate(p: ConditionPredicate, ctx: PredicateContext): boolean {
  if (p.all) return p.all.every((sub) => evalPredicate(sub, ctx))
  if (p.any) return p.any.some((sub) => evalPredicate(sub, ctx))
  return evalAtom(p.op, p.args ?? [], ctx)
}

/** 谓词接线（W3）：构造 enforcer CONDITIONAL 用的 evalCondition 注入函数，绑定 PredicateContext。 */
export function evalConditionFor(pred: PredicateContext): (cond: ConditionPredicate) => boolean {
  return (cond) => evalPredicate(cond, pred)
}

/** 谓词封闭集清单（文档化，§2.5）。 */
export const PREDICATE_OPS = [
  'weaponKindIs',
  'rangeBucket',
  'attackerHasKeyword',
  'targetHasKeyword',
  'targetHasMarker',
  'targetHasNoMarker',
  'operativeHasMarker',
  'operativeIsInjured',
  'dealtAnyDamageThisPipeline',
  'dieFaceEquals',
  'notSameFaction',
  'always',
] as const
export type PredicateOp = (typeof PREDICATE_OPS)[number]
