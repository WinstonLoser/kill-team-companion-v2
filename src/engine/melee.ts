import type { Effect, Weapon } from '../rules/types'
import type { DiceSource, DiceRoll } from '../dice'
import { resolveEffectsTraced } from './statResolver'
import type { RejectionTrace } from './enforcer'
import type { StepTrace } from './context'

export interface MeleeCombatant {
  operativeId: string
  weapon: Weapon
  save: number
  wounds: number
}

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

interface Pool {
  normal: number
  critical: number
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

/**
 * 互格挡：用 `parrier` 的成功抵消 `target` 的成功。
 * 规则矩阵：1 关键 → 1 关键或普通；2 普通 → 1 关键；1 普通 → 1 普通。
 * 返回 target 被抵消后剩余。
 */
function parry(parrier: Pool, target: Pool): Pool {
  let tN = target.normal
  let tC = target.critical
  let pN = parrier.normal
  let pC = parrier.critical
  // 关键先挡关键
  while (tC > 0 && pC >= 1) {
    tC--
    pC--
  }
  // 2 普通挡 1 关键
  while (tC > 0 && pN >= 2) {
    tC--
    pN -= 2
  }
  // 关键挡普通
  while (tN > 0 && pC >= 1) {
    tN--
    pC--
  }
  // 普通挡普通
  while (tN > 0 && pN >= 1) {
    tN--
    pN--
  }
  return { normal: tN, critical: tC }
}

const toRejected = (r: RejectionTrace): { id: string; reason: string } => ({
  id: r.id,
  reason: `${r.ruleId} ${r.reason}`,
})

const step = (
  stepId: string,
  summary: string,
  applied: string[] = [],
  rejected: { id: string; reason: string }[] = [],
): StepTrace => ({
  stepId,
  summary,
  appliedEffectIds: applied,
  rejectedEffectIds: rejected,
})

/**
 * 近战结算流水线（FR-5，7 step）。双方同时掷攻击骰 → 互格挡 → 剩余出击造伤。
 * 简化（留 1.3 金样精确化）：互格挡为对称一次性（双方各用全部成功抵消对方，剩余出击）。
 */
export function runMelee(input: MeleeInput): MeleeResult {
  const traces: StepTrace[] = []
  const { attacker, defender, effects, dice } = input

  traces.push(step('MELEE_TARGET_SELECT', `${attacker.operativeId} ↔ ${defender.operativeId}`))
  traces.push(step('MELEE_WEAPON_SELECT', `${attacker.weapon.name} / ${defender.weapon.name}`))

  // 3 同时掷攻击骰
  const a = rollSuccesses(dice, attacker.weapon)
  const d = rollSuccesses(dice, defender.weapon)
  traces.push(
    step(
      'MELEE_SIMULTANEOUS_ROLL',
      `攻击方 普通${a.pool.normal}/关键${a.pool.critical}；防御方 普通${d.pool.normal}/关键${d.pool.critical}`,
    ),
  )

  // 4/5 轮流结算 + 格挡规则：双方互格挡，剩余出击
  const atkSurvive = parry(d.pool, a.pool) // 防御方格挡攻击方
  const defSurvive = parry(a.pool, d.pool) // 攻击方格挡防御方
  traces.push(
    step(
      'MELEE_ALTERNATING_RESOLVE',
      `互格挡后：攻击方剩余 普通${atkSurvive.normal}/关键${atkSurvive.critical}；防御方剩余 普通${defSurvive.normal}/关键${defSurvive.critical}`,
    ),
  )
  traces.push(step('MELEE_PARRY_RULES', '格挡矩阵：关键挡任意 / 2普通挡1关键 / 1普通挡1普通'))

  // 6 造伤 + 减免
  const wpnA = attacker.weapon.profile
  const wpnD = defender.weapon.profile
  let dmgToDef = atkSurvive.normal * wpnA.normalDamage + atkSurvive.critical * wpnA.criticalDamage
  let dmgToAtk = defSurvive.normal * wpnD.normalDamage + defSurvive.critical * wpnD.criticalDamage
  // DN5：CAP_PER_ATTACK_DIE 每骰语义——按造伤方剩余出击骰计上限
  const mitDefT = resolveEffectsTraced(effects, 'ON_DAMAGE_TOTAL', ['DAMAGE_MITIGATION'], {
    attackDiceCount: atkSurvive.normal + atkSurvive.critical,
  })
  const mitDef = mitDefT.applied
  dmgToDef = Math.max(0, dmgToDef - mitDef.length)
  dmgToAtk = Math.max(0, dmgToAtk - mitDef.length) // P6：双向减伤（对称近似；按源分边留 DN）
  traces.push(
    step(
      'MELEE_DAMAGE_AND_MITIGATE',
      `攻→防 ${dmgToDef}，防→攻 ${dmgToAtk}`,
      mitDef.map((m) => m.id),
      mitDefT.rejected.map(toRejected),
    ),
  )

  // 7 后效
  const after = effects.filter((e) => e.trigger.point === 'AT_PIPELINE_END' && e.modifier.kind === 'HEAL_OPERATIVE')
  const woundsToDefender = dmgToDef
  const woundsToAttacker = dmgToAtk
  traces.push(
    step(
      'MELEE_AFTER',
      `扣耐伤 防${woundsToDefender}${woundsToDefender >= defender.wounds ? '→残废' : ''} / 攻${woundsToAttacker}${woundsToAttacker >= attacker.wounds ? '→残废' : ''}${after.length ? ' +后效' : ''}`,
      after.map((e) => e.effectId),
    ),
  )

  return {
    woundsToDefender,
    woundsToAttacker,
    defenderIncapacitated: woundsToDefender > 0 && woundsToDefender >= defender.wounds,
    attackerIncapacitated: woundsToAttacker > 0 && woundsToAttacker >= attacker.wounds,
    traces,
  }
}
