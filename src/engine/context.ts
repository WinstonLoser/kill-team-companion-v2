import type { Effect, Weapon } from '../rules/types'
import type { DiceRoll, DiceSource } from '../dice'

export interface Combatant {
  operativeId: string
  save: number // 豁免属性（D6 阈值）
  wounds: number // 当前耐伤
}

export interface ShootInput {
  attacker: { operativeId: string; weapon: Weapon }
  defender: Combatant
  effects: Effect[] // 本结算生效的 effect 栈
  dice: DiceSource
  hasCover: boolean // 1.8 几何注入：目标是否有掩护
}

export interface StepTrace {
  stepId: string
  summary: string
  dice?: DiceRoll[]
  appliedEffectIds: string[]
  rejectedEffectIds: { id: string; reason: string }[]
}

export interface ShootResult {
  woundsDealt: number
  defenderIncapacitated: boolean
  remaining: { normalSuccess: number; criticalSuccess: number }
  traces: StepTrace[]
}

export type { DiceSource }
