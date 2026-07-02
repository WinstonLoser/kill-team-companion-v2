// 射击流水线类型（架构 §3.1/§7.1，DN1 StepFn 注册表 + 游标）。零 UI 依赖。

import type { Effect, Weapon } from '../../rules/types'
import type { DiceRoll, DiceSource } from '../../dice'
import type { Combatant, ShootGeometry } from '../context'

/** 解析上下文：只读快照（特工/武器/effect 栈/骰源/几何）。step 不得 mutate。 */
export interface ResolutionContext {
  attacker: { operativeId: string; weapon: Weapon }
  defender: Combatant
  effects: Effect[]
  dice: DiceSource
  hasCover: boolean
  geometry?: ShootGeometry // P12：目标资格几何输入
  pipelineId: string
  attempt: number
}

/** 射击累积状态：step 间线程传递。每步读入 → 产出新状态（不可变更新）。 */
export interface ShootingState {
  hitThreshold: number
  effectiveWeaponRules: string[] // W3b：WEAPON_SELECT 解析的有效武器规则（base + ATTACH_WEAPON_RULE 附加）
  attackDice: DiceRoll[]
  normalSuccess: number
  criticalSuccess: number
  defDice: DiceRoll[]
  defNormal: number
  defCritical: number
  atkN: number // 未抵挡攻击普通
  atkC: number // 未抵挡攻击关键
  damage: number
  woundsDealt: number
  defenderIncapacitated: boolean
  targetValid: boolean // P12：TARGET_VALIDATE 几何资格结果（false → 不造伤）
}

/** 单步执行产出：summary + record 字段 + 更新后的 state + 可选快照。 */
export interface StepResult<S> {
  state: S
  summary: string
  dice?: DiceRoll[]
  applied: string[]
  rejected: { id: string; reason: string }[]
  snapshot?: { inputs?: unknown; output?: unknown }
  rulings?: string[]
}

/** StepFn：纯函数 (state, ctx) → StepResult。同入同出、不 mutate ctx。
 * 泛型 C 默认 ResolutionContext（射击）；近战等异构上下文可传自定义 ctx 类型（DN3）。 */
export interface StepFn<S, C = ResolutionContext> {
  stepId: string
  run: (state: S, ctx: C) => StepResult<S>
}
