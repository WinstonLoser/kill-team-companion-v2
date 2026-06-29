import type { Effect } from '../rules/types'
import { enforcer } from './enforcer'
import type { AppliedModifier } from './statResolver'
import type { ShootInput, ShootResult, StepTrace } from './context'

function effectsAt(effects: Effect[], point: string): Effect[] {
  return effects.filter((e) => e.trigger.point === point)
}

function toMod(e: Effect): AppliedModifier {
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

/** 取指定 kind + 触发点的 effect → AppliedModifier → enforcer 过滤 */
function modsOf(effects: Effect[], point: string, kinds: string[]): AppliedModifier[] {
  const matched = effectsAt(effects, point).filter((e) => kinds.includes(e.modifier.kind))
  return enforcer(matched.map(toMod), {})
}

const sum = (mods: AppliedModifier[]): number => mods.reduce((s, m) => s + m.amount, 0)
const clampHits = (n: number): number => Math.max(2, Math.min(6, n))

/**
 * 射击结算流水线（FR-4，10 step）。每步纯函数推进，effect 按 trigger.point 接入正确 step，
 * 数值修正经 enforcer 集中过滤。几何（资格/掩护）由 1.8 经 input.hasCover 注入。
 *
 * 简化（留 1.3 golden tests 精确化）：DAMAGE_MITIGATION 每条按减 1 计（恼人韧性 D6 成功≈减1）；
 * ATTACK_UPGRADE 仅处理 UPGRADE_SUCCESS（普通升关键）/AUTO_SUCCESS。
 */
export function runShooting(input: ShootInput): ShootResult {
  const traces: StepTrace[] = []
  const { attacker, defender, effects, dice, hasCover } = input
  const profile = attacker.weapon.profile

  // 1 WEAPON_SELECT
  traces.push(step('WEAPON_SELECT', `武器 ${attacker.weapon.name}`))

  // 2 TARGET_VALIDATE（几何资格由 1.8 判；此处假定合法）
  traces.push(step('TARGET_VALIDATE', '有效目标（几何 1.8 判定）'))

  // 3 HIT_ROLL：命中属性 = weapon.hit + HIT_MINUS(升阈值) - HIT_PLUS(降阈值)
  const hitMinus = modsOf(effects, 'BEFORE_HIT_ROLL', ['HIT_MINUS'])
  const hitPlus = modsOf(effects, 'BEFORE_HIT_ROLL', ['HIT_PLUS'])
  const hitThreshold = clampHits(profile.hit + sum(hitMinus) - sum(hitPlus))
  const attackDice = dice.roll(profile.attacks)
  let normalSuccess = 0
  let criticalSuccess = 0
  for (const d of attackDice) {
    if (d.nat === 1) continue
    if (d.nat === 6) criticalSuccess++
    else if (d.nat >= hitThreshold) normalSuccess++
  }
  traces.push(
    step('HIT_ROLL', `命中${hitThreshold}+ → 普通${normalSuccess} 关键${criticalSuccess}`, attackDice, [
      ...hitMinus,
      ...hitPlus,
    ].map((m) => m.id)),
  )

  // 4 ATTACK_UPGRADE（AFTER_HIT_ROLL）：UPGRADE_SUCCESS 普通→关键；AUTO_SUCCESS 直接加
  // P14：跳过 pipelineStep 属近战的 effect（如近战撕裂不在射击触发）
  const upgrade = effectsAt(effects, 'AFTER_HIT_ROLL').filter((e) => e.modifier.kind === 'UPGRADE_SUCCESS' && !e.pipelineStep.startsWith('MELEE'))
  const auto = effectsAt(effects, 'AFTER_HIT_ROLL').filter((e) => e.modifier.kind === 'AUTO_SUCCESS' && !e.pipelineStep.startsWith('MELEE'))
  const upApplied: string[] = []
  for (const e of upgrade) {
    if (normalSuccess > 0) {
      normalSuccess--
      criticalSuccess++
      upApplied.push(e.effectId)
    }
  }
  for (const e of auto) {
    const p = e.modifier.payload as { count: number; grade: 'NORMAL' | 'CRITICAL' }
    const c = Math.max(0, p.count) // P17：clamp 负值
    if (p.grade === 'CRITICAL') criticalSuccess += c
    else normalSuccess += c
    upApplied.push(e.effectId)
  }
  traces.push(step('ATTACK_UPGRADE', `升级/自动后 → 普通${normalSuccess} 关键${criticalSuccess}`, undefined, upApplied))

  // 5 DEFENCE_ROLL：3 颗，PIERCE 减数，掩护给 +1 普通（核心规则，除非 COVER_SAVE effect 覆盖）
  const pierce = modsOf(effects, 'BEFORE_DEFENCE_ROLL', ['PIERCE'])
  const defenceDiceCount = Math.max(0, 3 - sum(pierce))
  const defenceDice = dice.roll(defenceDiceCount)
  const saveThresh = clampHits(defender.save) // P18：save 钳到 2..6
  let defNormal = 0
  let defCritical = 0
  for (const d of defenceDice) {
    if (d.nat === 1) continue
    if (d.nat >= saveThresh) {
      if (d.nat === 6) defCritical++
      else defNormal++
    }
  }
  // P16：掩护豁免——读 COVER_SAVE effect extraNormal；攻城战专家(IMMUNITY cover-save)取消
  const coverEffs = effectsAt(effects, 'BEFORE_DEFENCE_ROLL').filter((e) => e.modifier.kind === 'COVER_SAVE')
  const coverRemoved = effectsAt(effects, 'BEFORE_DEFENCE_ROLL').some((e) => e.modifier.kind === 'IMMUNITY' && (e.modifier.payload as { immuneToEffectGroup?: string }).immuneToEffectGroup === 'cover-save')
  const coverApplied: string[] = coverEffs.map((e) => e.effectId)
  if (hasCover && !coverRemoved) {
    const extra = coverEffs.length ? (coverEffs[0]?.modifier.payload as { extraNormal?: number }).extraNormal ?? 1 : 1
    defNormal += extra
  }
  traces.push(
    step(
      'DEFENCE_ROLL',
      `防御骰${defenceDiceCount} → 普通成功${defNormal} 关键${defCritical}${hasCover ? ' +掩护豁免' : ''}`,
      defenceDice,
      [...pierce.map((m) => m.id), ...coverApplied],
    ),
  )

  // 6 DEFENCE_UPGRADE（AFTER_DEFENCE_ROLL 强健/超人体格）— 占位，留后续 effect 接入
  traces.push(step('DEFENCE_UPGRADE', `防御成功 普通${defNormal} 关键${defCritical}`))

  // 7 PARRY_ALLOCATE：抵挡。2普通挡1关键 → 1普通挡1普通 → 关键挡普通/关键
  let atkN = normalSuccess
  let atkC = criticalSuccess
  let dN = defNormal
  let dC = defCritical
  while (atkC > 0 && dN >= 2) {
    atkC--
    dN -= 2
  }
  while (atkN > 0 && dN >= 1) {
    atkN--
    dN--
  }
  while (atkN > 0 && dC >= 1) {
    atkN--
    dC--
  }
  while (atkC > 0 && dC >= 1) {
    atkC--
    dC--
  }
  traces.push(step('PARRY_ALLOCATE', `未抵挡：普通${atkN} 关键${atkC}`))

  // 8 DAMAGE_PER_DIE：普通→normalDamage，关键→criticalDamage；EXTRA_DAMAGE_ON_HIT(毁灭)
  const extraDmg = modsOf(effects, 'ON_DAMAGE_PER_DIE', ['EXTRA_DAMAGE_ON_HIT'])
  let damage = atkN * profile.normalDamage + atkC * profile.criticalDamage + sum(extraDmg)
  traces.push(
    step(
      'DAMAGE_PER_DIE',
      `造伤 ${atkN * profile.normalDamage + atkC * profile.criticalDamage} + 额外${sum(extraDmg)} = ${damage}`,
      undefined,
      extraDmg.map((m) => m.id),
    ),
  )

  // 9 DAMAGE_TOTAL_MITIGATE：DAMAGE_MITIGATION(恼人韧性) 每条减 1（精确掷骰留 1.3 金样）；IGNORE_DAMAGE 略
  const mitMods = modsOf(effects, 'ON_DAMAGE_TOTAL', ['DAMAGE_MITIGATION'])
  const reduce = mitMods.length // 简化：每条生效的 mitigation 减 1
  damage = Math.max(0, damage - reduce)
  traces.push(
    step('DAMAGE_TOTAL_MITIGATE', `减免 ${reduce} → ${damage}`, undefined, mitMods.map((m) => m.id)),
  )

  // 10 WOUNDS_APPLY_AND_AFTER：扣耐伤 + 后效（毒素 GRANT_MARKER AT_PIPELINE_END）
  const woundsDealt = damage
  const defenderIncapacitated = woundsDealt > 0 && woundsDealt >= defender.wounds // P7：0 伤不致残
  const markers = effectsAt(effects, 'AT_PIPELINE_END').filter((e) => e.modifier.kind === 'GRANT_MARKER')
  traces.push(
    step(
      'WOUNDS_APPLY_AND_AFTER',
      `扣耐伤 ${woundsDealt}${defenderIncapacitated ? ' →残废' : ''}${markers.length ? ` →打标识 ${markers.map((m) => m.effectId).join(',')}` : ''}`,
      undefined,
      markers.map((e) => e.effectId),
    ),
  )

  return {
    woundsDealt,
    defenderIncapacitated,
    remaining: { normalSuccess: atkN, criticalSuccess: atkC },
    traces,
  }
}

function step(stepId: string, summary: string, dice?: ShootResult['traces'][number]['dice'], applied?: string[]): StepTrace {
  return { stepId, summary, dice, appliedEffectIds: applied ?? [], rejectedEffectIds: [] }
}
