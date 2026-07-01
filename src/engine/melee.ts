// 近战结算门面（FR-5）。DN3：逻辑下沉到 pipeline/melee.ts（StepFn 注册表 + 游标驱动 + 真交替格挡）；
// 本文件保留 runMelee 门面与公开类型以维持旧契约（MeleeResult 数值不变）。

import type { Effect, Weapon } from '../rules/types'
import type { DiceSource } from '../dice'
import type { StepTrace } from './context'
import {
  createMeleeResolution,
  type MeleeCombatant,
  type MeleeResolutionContext,
} from './pipeline/melee'

export type { MeleeCombatant } from './pipeline/melee'
export { MELEE_PIPELINE, createMeleeResolution } from './pipeline/melee'
export type { MeleeState, MeleeResolutionContext, MeleeStep } from './pipeline/melee'

export interface MeleeInput {
  attacker: MeleeCombatant
  defender: MeleeCombatant
  effects: Effect[]
  dice: DiceSource
}

export interface MeleeResult {
  woundsToDefender: number
  woundsToAttacker: number
  defenderIncapacitated: boolean
  attackerIncapacitated: boolean
  traces: StepTrace[]
}

export type { Weapon }
export type { DiceSource }

/**
 * 近战结算门面：跑完整 7 步，返回 MeleeResult（ woundsToDefender / woundsToAttacker / traces ）。
 * 需逐步控制（暂停/前进/回滚）时直接用 createMeleeResolution。
 */
export function runMelee(input: MeleeInput): MeleeResult {
  const ctx: MeleeResolutionContext = {
    attacker: input.attacker,
    defender: input.defender,
    effects: input.effects,
    dice: input.dice,
    pipelineId: 'melee',
    attempt: 1,
  }
  const res = createMeleeResolution(ctx)
  res.run()
  const s = res.state
  return {
    woundsToDefender: s.woundsToDefender,
    woundsToAttacker: s.woundsToAttacker,
    defenderIncapacitated: s.defenderIncapacitated,
    attackerIncapacitated: s.attackerIncapacitated,
    traces: [...res.records],
  }
}
