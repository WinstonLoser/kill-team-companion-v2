import type { Effect, Weapon } from '../rules/types'
import type { DiceRoll, DiceSource } from '../dice'
import type { Board, OperativePlacement, Point } from '../geometry'
import type { PredicateContext } from '../rules/predicates'

export interface Combatant {
  operativeId: string
  save: number // 豁免属性（D6 阈值）
  wounds: number // 当前耐伤
}

/** P12：射击几何资格输入（注入则 TARGET_VALIDATE 调 validateTarget；省略则占位）。 */
export interface ShootGeometry {
  board: Board
  attackerPlacement: OperativePlacement
  targetPlacement: OperativePlacement
  range: number
  friendlyPositions?: Point[]
  targetOrder?: 'ENGAGED' | 'CONCEALED'
}

export interface ShootInput {
  attacker: { operativeId: string; weapon: Weapon }
  defender: Combatant
  effects: Effect[]
  defenderEffects?: Effect[] // 防御方 effect 栈（防御计谋/装备影响攻击方掷骰等）
  dice: DiceSource
  hasCover: boolean
  geometry?: ShootGeometry
  predicate?: PredicateContext
}

export interface StepTrace {
  stepId: string
  summary: string
  dice?: DiceRoll[]
  appliedEffectIds: string[]
  rejectedEffectIds: { id: string; reason: string }[]
  inputs?: unknown // P21/DN1：本步输入快照（回滚可从快照恢复）
  output?: unknown // P21/DN1：本步输出快照
  rulings?: string[] // 人工裁定 id（咨询式几何/规则缺口）
}

export interface ShootResult {
  woundsDealt: number
  defenderIncapacitated: boolean
  remaining: { normalSuccess: number; criticalSuccess: number }
  traces: StepTrace[]
}

export type { DiceSource }
