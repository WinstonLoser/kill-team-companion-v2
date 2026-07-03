// 激活期 effect resolver（5-6 mucus_exit 计划层 1）
// 当敌方特工在持 mucus_exit 的 wargear holder 3"内激活时：
// 掷 D3 → D3=3 且目标无 POISON → 挂 POISON；D3=3 且已有 POISON → 受 D3 伤。
// 纯函数：由 matchStore.activate 后调用。

import type { Effect } from '../rules/types'
import type { Point } from '../geometry'
import type { DiceSource } from '../dice'
import { evalPredicate, type PredicateContext } from '../rules/predicates'
import { hashSeed } from '../dice'
import { ElectronicDiceSource } from '../dice'

export interface ActivationOperative {
  uid: string
  pos: Point
  side: 'a' | 'b'
  markers: string[]
}

export interface WargearHolder {
  uid: string
  pos: Point
  side: 'a' | 'b'
  effects: Effect[]
}

export interface ActivationEffectContext {
  activatorUid: string
  activatorPos: Point
  activatorMarkers: string[]
  /** 持有 mucus_exit 等激活期 wargear effect 的特工（通常是对手方） */
  holders: WargearHolder[]
  dice?: DiceSource
  turningPoint: number
}

export interface ActivationEffectResult {
  markersGranted: { targetUid: string; marker: string }[]
  damageDealt: { targetUid: string; amount: number }[]
  trace: { effectId: string; dieFace: number; triggered: boolean; detail: string }[]
}

const MUCUS_RANGE = 3

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * 解析激活期效果（mucus_exit 排毒口）。
 * 遍历范围内的 wargear holders → 逐个掷 D3 → 按 dieFaceEquals 条件求值 → GRANT_MARKER / EXTRA_DAMAGE。
 */
export function resolveActivationEffects(ctx: ActivationEffectContext): ActivationEffectResult {
  const result: ActivationEffectResult = { markersGranted: [], damageDealt: [], trace: [] }
  const dice = ctx.dice ?? new ElectronicDiceSource(hashSeed(ctx.activatorUid, 'ACTIVATION', ctx.turningPoint))

  for (const holder of ctx.holders) {
    // 仅对手方 holder 在范围内才触发
    if (dist(holder.pos, ctx.activatorPos) > MUCUS_RANGE) continue

    for (const e of holder.effects) {
      if (e.trigger.point !== 'ON_ACTIVATION_START') continue
      if (e.modifier.kind !== 'GRANT_MARKER' && e.modifier.kind !== 'EXTRA_DAMAGE_ON_HIT') continue
      if (e.stacking.policy !== 'CONDITIONAL') continue

      // 掷 D3 (1d6 → 1-3)
      const roll = dice.roll(1)[0]!
      const d3 = ((roll.nat - 1) % 3) + 1 // 1d6 → 1..3

      const predCtx: PredicateContext = {
        dieFace: d3,
        targetMarkers: ctx.activatorMarkers,
      }

      const condition = (e.trigger as { condition?: import('../rules/types').ConditionPredicate }).condition
      const triggered = condition ? evalPredicate(condition, predCtx) : true

      const detail = `${e.effectId}: D3=${d3} → ${triggered ? '触发' : '未触发'}`

      if (triggered) {
        if (e.modifier.kind === 'GRANT_MARKER') {
          const marker = (e.modifier.payload as { marker?: string }).marker ?? 'UNKNOWN'
          // 仅在目标无该 marker 时授予
          if (!ctx.activatorMarkers.includes(marker)) {
            result.markersGranted.push({ targetUid: ctx.activatorUid, marker })
          }
        } else if (e.modifier.kind === 'EXTRA_DAMAGE_ON_HIT') {
          // D3 伤害
          const dmgRoll = dice.roll(1)[0]!
          const dmgD3 = ((dmgRoll.nat - 1) % 3) + 1
          result.damageDealt.push({ targetUid: ctx.activatorUid, amount: dmgD3 })
          result.trace.push({ effectId: e.effectId, dieFace: d3, triggered, detail: `${detail} → D3 伤=${dmgD3}` })
          continue
        }
      }
      result.trace.push({ effectId: e.effectId, dieFace: d3, triggered, detail })
    }
  }

  return result
}
