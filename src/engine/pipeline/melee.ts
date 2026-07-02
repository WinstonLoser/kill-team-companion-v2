// 近战结算流水线（FR-5，7 step）。DN3：改 StepFn 注册表 + 游标驱动（同架构 §3.1/§7.1）+
// 真交替格挡（修 P3 对称双重计数）+ 出击/格挡子决策日志；格挡用共用 parryAllocation（P4 统一）。

import type { Effect, Weapon } from '../../rules/types'
import type { DiceSource, DiceRoll } from '../../dice'
import type { StepTrace } from '../context'
import type { PredicateContext } from '../../rules/predicates'
import { resolveEffectsTraced } from '../statResolver'
import { evalConditionFor } from '../../rules/predicates'
import type { RejectionTrace } from '../enforcer'
import { parryAllocation, subtractPool, type Pool } from '../parry'
import type { StepFn, StepResult } from './types'
import { createResolution, type Resolution } from './driver'

export interface MeleeCombatant {
  operativeId: string
  weapon: Weapon
  save: number
  wounds: number
}

/** 近战解析上下文：只读快照（双方/武器/effect 栈/骰源）。step 不得 mutate。 */
export interface MeleeResolutionContext {
  attacker: MeleeCombatant
  defender: MeleeCombatant
  effects: Effect[]
  dice: DiceSource
  /** W3 谓词接线：CONDITIONAL effect 条件求值上下文。 */
  predicate?: PredicateContext
  pipelineId: string
  attempt: number
}

/** 近战累积状态：step 间线程传递。 */
export interface MeleeState {
  attackerPool: Pool // 攻击方掷骰成功池
  defenderPool: Pool // 防御方掷骰成功池
  attackerStrike: Pool // 交替格挡后攻击方出击（造伤）池
  defenderStrike: Pool // 交替格挡后防御方出击池
  parryLog: string[] // 交替格挡子决策日志（每次取消一条）
  damageToDefender: number
  damageToAttacker: number
  woundsToDefender: number
  woundsToAttacker: number
  defenderIncapacitated: boolean
  attackerIncapacitated: boolean
}

export type MeleeStep = StepFn<MeleeState, MeleeResolutionContext>

const toRejected = (r: RejectionTrace): { id: string; reason: string } => ({
  id: r.id,
  reason: `${r.ruleId} ${r.reason}`,
})

export function createInitialMeleeState(): MeleeState {
  return {
    attackerPool: { normal: 0, critical: 0 },
    defenderPool: { normal: 0, critical: 0 },
    attackerStrike: { normal: 0, critical: 0 },
    defenderStrike: { normal: 0, critical: 0 },
    parryLog: [],
    damageToDefender: 0,
    damageToAttacker: 0,
    woundsToDefender: 0,
    woundsToAttacker: 0,
    defenderIncapacitated: false,
    attackerIncapacitated: false,
  }
}

function rollSuccesses(dice: DiceSource, weapon: Weapon): { pool: Pool; rolls: DiceRoll[] } {
  const rolls = dice.roll(weapon.profile.attacks)
  const pool: Pool = { normal: 0, critical: 0 }
  for (const d of rolls) {
    if (d.nat === 1) continue
    if (d.nat === 6) pool.critical++
    else if (d.nat >= weapon.profile.hit) pool.normal++
  }
  return { pool, rolls }
}

const MELEE_TARGET_SELECT: MeleeStep = {
  stepId: 'MELEE_TARGET_SELECT',
  run: (state, ctx) => ({
    state,
    summary: `${ctx.attacker.operativeId} ↔ ${ctx.defender.operativeId}`,
    applied: [],
    rejected: [],
  }),
}

const MELEE_WEAPON_SELECT: MeleeStep = {
  stepId: 'MELEE_WEAPON_SELECT',
  run: (state, ctx) => ({
    state,
    summary: `${ctx.attacker.weapon.name} / ${ctx.defender.weapon.name}`,
    applied: [],
    rejected: [],
  }),
}

const MELEE_SIMULTANEOUS_ROLL: MeleeStep = {
  stepId: 'MELEE_SIMULTANEOUS_ROLL',
  run: (state, ctx) => {
    const a = rollSuccesses(ctx.dice, ctx.attacker.weapon)
    const d = rollSuccesses(ctx.dice, ctx.defender.weapon)
    // D1：近战严重（UPGRADE_SUCCESS @ AFTER_HIT_ROLL）——每 effect 把攻方 1 普通升关键。
    // 恐虐印记/恶魔之刃类「严重」机制；此前近战流水线不消费此 kind（Story 2.2 盘点披露）。
    const upT = resolveEffectsTraced(ctx.effects, 'AFTER_HIT_ROLL', ['UPGRADE_SUCCESS'], ctx.predicate ? { evalCondition: evalConditionFor(ctx.predicate) } : {})
    const attackerPool = { ...a.pool }
    const upApplied: string[] = []
    for (const m of upT.applied) {
      if (attackerPool.normal > 0) {
        attackerPool.normal--
        attackerPool.critical++
        upApplied.push(m.id)
      }
    }
    return {
      state: { ...state, attackerPool, defenderPool: d.pool },
      summary: `同时掷骰 攻方 普通${attackerPool.normal}/关键${attackerPool.critical}${upApplied.length ? `（严重升级 ×${upApplied.length}）` : ''}；防方 普通${d.pool.normal}/关键${d.pool.critical}`,
      dice: [...a.rolls, ...d.rolls],
      applied: upApplied,
      rejected: upT.rejected.map(toRejected),
    }
  },
}

const MELEE_ALTERNATING_RESOLVE: MeleeStep = {
  stepId: 'MELEE_ALTERNATING_RESOLVE',
  run: (state) => {
    const a = state.attackerPool
    const d = state.defenderPool
    // DN3 真交替（修 P3 双重计数）：
    // 回合1 攻击方（主动方）格挡防御方——消耗攻击方骰，抵消防御方成功
    const r1 = parryAllocation(a, d)
    const defenderAfterAtk = r1.survivor
    const attackerRemaining = subtractPool(a, r1.used)
    // 回合2 防御方用其剩余骰格挡攻击方剩余——消耗防御方骰
    const r2 = parryAllocation(defenderAfterAtk, attackerRemaining)
    const attackerStrike = r2.survivor
    const defenderStrike = subtractPool(defenderAfterAtk, r2.used)
    const parryLog = [
      ...r1.log.map((l) => `攻方·${l}`),
      ...r2.log.map((l) => `防方·${l}`),
    ]
    return {
      state: { ...state, attackerStrike, defenderStrike, parryLog },
      summary: `交替格挡后 攻方出击 普通${attackerStrike.normal}/关键${attackerStrike.critical}；防方出击 普通${defenderStrike.normal}/关键${defenderStrike.critical}`,
      applied: [],
      rejected: [],
    }
  },
}

const MELEE_PARRY_RULES: MeleeStep = {
  stepId: 'MELEE_PARRY_RULES',
  run: (state) => ({
    state,
    summary: `格挡矩阵：关键抵任意 / 2普通抵1关键 / 1普通抵1普通${state.parryLog.length ? `（${state.parryLog.length} 次取消）` : ''}`,
    applied: [],
    rejected: [],
  }),
}

const MELEE_DAMAGE_AND_MITIGATE: MeleeStep = {
  stepId: 'MELEE_DAMAGE_AND_MITIGATE',
  run: (state, ctx) => {
    const wpnA = ctx.attacker.weapon.profile
    const wpnD = ctx.defender.weapon.profile
    const damageToDefender =
      state.attackerStrike.normal * wpnA.normalDamage + state.attackerStrike.critical * wpnA.criticalDamage
    const damageToAttacker =
      state.defenderStrike.normal * wpnD.normalDamage + state.defenderStrike.critical * wpnD.criticalDamage
    // DN5：CAP_PER_ATTACK_DIE 每骰——按造伤方出击骰计上限
    const mitT = resolveEffectsTraced(ctx.effects, 'ON_DAMAGE_TOTAL', ['DAMAGE_MITIGATION'], {
      ...(ctx.predicate ? { evalCondition: evalConditionFor(ctx.predicate) } : {}),
      attackDiceCount: state.attackerStrike.normal + state.attackerStrike.critical,
    })
    const mit = mitT.applied.length
    // 双向同额减伤（对称近似；按源分边留后续 DN）
    const dmgToDef = Math.max(0, damageToDefender - mit)
    const dmgToAtk = Math.max(0, damageToAttacker - mit)
    return {
      state: { ...state, damageToDefender: dmgToDef, damageToAttacker: dmgToAtk },
      summary: `攻→防 ${dmgToDef}，防→攻 ${dmgToAtk}`,
      applied: mitT.applied.map((m) => m.id),
      rejected: mitT.rejected.map(toRejected),
    }
  },
}

const MELEE_AFTER: MeleeStep = {
  stepId: 'MELEE_AFTER',
  run: (state, ctx) => {
    const after = ctx.effects.filter(
      (e) => e.trigger.point === 'AT_PIPELINE_END' && e.modifier.kind === 'HEAL_OPERATIVE',
    )
    const woundsToDefender = state.damageToDefender
    const woundsToAttacker = state.damageToAttacker
    const defenderIncapacitated = woundsToDefender > 0 && woundsToDefender >= ctx.defender.wounds
    const attackerIncapacitated = woundsToAttacker > 0 && woundsToAttacker >= ctx.attacker.wounds
    return {
      state: { ...state, woundsToDefender, woundsToAttacker, defenderIncapacitated, attackerIncapacitated },
      summary: `扣耐伤 防${woundsToDefender}${defenderIncapacitated ? '→残废' : ''} / 攻${woundsToAttacker}${attackerIncapacitated ? '→残废' : ''}${after.length ? ' +后效' : ''}`,
      applied: after.map((e) => e.effectId),
      rejected: [],
    }
  },
}

/** 近战流水线注册表（架构 §3.1，7 步顺序）。 */
export const MELEE_PIPELINE: MeleeStep[] = [
  MELEE_TARGET_SELECT,
  MELEE_WEAPON_SELECT,
  MELEE_SIMULTANEOUS_ROLL,
  MELEE_ALTERNATING_RESOLVE,
  MELEE_PARRY_RULES,
  MELEE_DAMAGE_AND_MITIGATE,
  MELEE_AFTER,
]

/** 创建近战解析：可逐步 advance / 暂停 / 回滚，或一次 run 到底（DN3 游标）。 */
export function createMeleeResolution(ctx: MeleeResolutionContext): Resolution<MeleeState> {
  return createResolution(ctx, MELEE_PIPELINE, createInitialMeleeState)
}

export type { StepResult, StepTrace }
