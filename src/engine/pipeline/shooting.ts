// 射击 10 步流水线（架构 §3.1，DN1 StepFn 注册表）。每步纯函数，逻辑自旧 runShooting 平移（数值不变）。
// P22：属性经 resolveStat（两层模型，FR-2）+ 共享 resolveEffects（去重，不再自建 modsOf）。

import type { Effect } from '../../rules/types'
import { validateTarget } from '../../geometry'
import { resolveEffectsTraced, resolveStat } from '../statResolver'
import type { AppliedModifier } from '../statResolver'
import type { RejectionTrace } from '../enforcer'
import type { ShootingState, StepFn, StepResult } from './types'

const effectsAt = (effects: Effect[], point: string): Effect[] =>
  effects.filter((e) => e.trigger.point === point)

const sum = (mods: AppliedModifier[]): number => mods.reduce((s, m) => s + m.amount, 0)
const clampHits = (n: number): number => Math.max(2, Math.min(6, n))

/** RejectionTrace → StepTrace.rejectedEffectIds 条目（ruleId + reason 留痕） */
const toRejected = (r: RejectionTrace): { id: string; reason: string } => ({
  id: r.id,
  reason: `${r.ruleId} ${r.reason}`,
})

export function createInitialShootingState(profile: { hit: number }): ShootingState {
  return {
    hitThreshold: profile.hit,
    attackDice: [],
    normalSuccess: 0,
    criticalSuccess: 0,
    defDice: [],
    defNormal: 0,
    defCritical: 0,
    atkN: 0,
    atkC: 0,
    damage: 0,
    woundsDealt: 0,
    defenderIncapacitated: false,
    targetValid: true,
  }
}

const WEAPON_SELECT: StepFn<ShootingState> = {
  stepId: 'WEAPON_SELECT',
  run: (state, ctx) => ({
    state,
    summary: `武器 ${ctx.attacker.weapon.name}`,
    applied: [],
    rejected: [],
  }),
}

const TARGET_VALIDATE: StepFn<ShootingState> = {
  stepId: 'TARGET_VALIDATE',
  run: (state, ctx) => {
    // P12：注入几何则调 validateTarget（FR-10 资格）；省略则占位放行（向后兼容）。
    if (!ctx.geometry) {
      return { state, summary: '有效目标（几何未注入，占位放行）', applied: [], rejected: [] }
    }
    const g = ctx.geometry
    const res = validateTarget(g.attackerPlacement, g.targetPlacement, g.range, g.board, g.friendlyPositions ?? [], {
      targetOrder: g.targetOrder,
      friendlyPositions: g.friendlyPositions,
    })
    if (res.ok) {
      return { state: { ...state, targetValid: true }, summary: '有效目标（几何资格通过）', applied: [], rejected: [] }
    }
    return {
      state: { ...state, targetValid: false },
      summary: `无效目标：${res.missing.join('；')}`,
      applied: [],
      rejected: [],
      rulings: res.missing,
    }
  },
}

const HIT_ROLL: StepFn<ShootingState> = {
  stepId: 'HIT_ROLL',
  run: (state, ctx) => {
    const profile = ctx.attacker.weapon.profile
    const hmT = resolveEffectsTraced(ctx.effects, 'BEFORE_HIT_ROLL', ['HIT_MINUS'])
    const hpT = resolveEffectsTraced(ctx.effects, 'BEFORE_HIT_ROLL', ['HIT_PLUS'])
    const hitMinus = hmT.applied
    const hitPlus = hpT.applied
    // P22：命中阈值经 resolveStat 两层模型（base=profile.hit）。HIT_MINUS 升阈(+)，HIT_PLUS 降阈(取负)
    const hitMods = [...hitMinus, ...hitPlus.map((m) => ({ ...m, amount: -m.amount }))]
    const hitThreshold = clampHits(resolveStat(profile.hit, hitMods).effective)
    const attackDice = ctx.dice.roll(profile.attacks)
    let normalSuccess = 0
    let criticalSuccess = 0
    for (const d of attackDice) {
      if (d.nat === 1) continue
      if (d.nat === 6) criticalSuccess++
      else if (d.nat >= hitThreshold) normalSuccess++
    }
    return {
      state: { ...state, hitThreshold, attackDice, normalSuccess, criticalSuccess },
      summary: `命中${hitThreshold}+ → 普通${normalSuccess} 关键${criticalSuccess}`,
      dice: attackDice,
      applied: [...hitMinus, ...hitPlus].map((m) => m.id),
      rejected: [...hmT.rejected, ...hpT.rejected].map(toRejected),
    }
  },
}

const ATTACK_UPGRADE: StepFn<ShootingState> = {
  stepId: 'ATTACK_UPGRADE',
  run: (state, ctx) => {
    let { normalSuccess, criticalSuccess } = state
    // P14：跳过 pipelineStep 属近战的 effect（如近战撕裂不在射击触发）
    const upgrade = effectsAt(ctx.effects, 'AFTER_HIT_ROLL').filter((e) => e.modifier.kind === 'UPGRADE_SUCCESS' && !e.pipelineStep.startsWith('MELEE'))
    const auto = effectsAt(ctx.effects, 'AFTER_HIT_ROLL').filter((e) => e.modifier.kind === 'AUTO_SUCCESS' && !e.pipelineStep.startsWith('MELEE'))
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
    return {
      state: { ...state, normalSuccess, criticalSuccess },
      summary: `升级/自动后 → 普通${normalSuccess} 关键${criticalSuccess}`,
      applied: upApplied,
      rejected: [],
    }
  },
}

const DEFENCE_ROLL: StepFn<ShootingState> = {
  stepId: 'DEFENCE_ROLL',
  run: (state, ctx) => {
    const pierceT = resolveEffectsTraced(ctx.effects, 'BEFORE_DEFENCE_ROLL', ['PIERCE'])
    const pierce = pierceT.applied
    const defenceDiceCount = Math.max(0, 3 - sum(pierce))
    const defDice = ctx.dice.roll(defenceDiceCount)
    const saveThresh = clampHits(ctx.defender.save) // P18：save 钳到 2..6
    let defNormal = 0
    let defCritical = 0
    for (const d of defDice) {
      if (d.nat === 1) continue
      if (d.nat >= saveThresh) {
        if (d.nat === 6) defCritical++
        else defNormal++
      }
    }
    // P16：掩护豁免——读 COVER_SAVE effect extraNormal；攻城战专家(IMMUNITY cover-save)取消
    const coverEffs = effectsAt(ctx.effects, 'BEFORE_DEFENCE_ROLL').filter((e) => e.modifier.kind === 'COVER_SAVE')
    const coverRemoved = effectsAt(ctx.effects, 'BEFORE_DEFENCE_ROLL').some(
      (e) => e.modifier.kind === 'IMMUNITY' && (e.modifier.payload as { immuneToEffectGroup?: string }).immuneToEffectGroup === 'cover-save',
    )
    if (ctx.hasCover && !coverRemoved) {
      const extra = coverEffs.length ? (coverEffs[0]?.modifier.payload as { extraNormal?: number }).extraNormal ?? 1 : 1
      defNormal += extra
    }
    return {
      state: { ...state, defDice, defNormal, defCritical },
      summary: `防御骰${defenceDiceCount} → 普通成功${defNormal} 关键${defCritical}${ctx.hasCover ? ' +掩护豁免' : ''}`,
      dice: defDice,
      applied: [...pierce.map((m) => m.id), ...coverEffs.map((e) => e.effectId)],
      rejected: pierceT.rejected.map(toRejected),
    }
  },
}

const DEFENCE_UPGRADE: StepFn<ShootingState> = {
  stepId: 'DEFENCE_UPGRADE',
  run: (state) => ({
    state,
    summary: `防御成功 普通${state.defNormal} 关键${state.defCritical}`,
    applied: [],
    rejected: [],
  }),
}

const PARRY_ALLOCATE: StepFn<ShootingState> = {
  stepId: 'PARRY_ALLOCATE',
  run: (state) => {
    let atkN = state.normalSuccess
    let atkC = state.criticalSuccess
    let dN = state.defNormal
    let dC = state.defCritical
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
    return {
      state: { ...state, atkN, atkC },
      summary: `未抵挡：普通${atkN} 关键${atkC}`,
      applied: [],
      rejected: [],
    }
  },
}

const DAMAGE_PER_DIE: StepFn<ShootingState> = {
  stepId: 'DAMAGE_PER_DIE',
  run: (state, ctx) => {
    const profile = ctx.attacker.weapon.profile
    const extraT = resolveEffectsTraced(ctx.effects, 'ON_DAMAGE_PER_DIE', ['EXTRA_DAMAGE_ON_HIT'])
    const extraDmg = extraT.applied
    const base = state.atkN * profile.normalDamage + state.atkC * profile.criticalDamage
    const damage = base + sum(extraDmg)
    return {
      state: { ...state, damage },
      summary: `造伤 ${base} + 额外${sum(extraDmg)} = ${damage}`,
      applied: extraDmg.map((m) => m.id),
      rejected: extraT.rejected.map(toRejected),
    }
  },
}

const DAMAGE_TOTAL_MITIGATE: StepFn<ShootingState> = {
  stepId: 'DAMAGE_TOTAL_MITIGATE',
  run: (state, ctx) => {
    // DN5：CAP_PER_ATTACK_DIE 每骰语义——减伤按未抵挡命中骰数（atkN+atkC）计上限
    const mitT = resolveEffectsTraced(ctx.effects, 'ON_DAMAGE_TOTAL', ['DAMAGE_MITIGATION'], {
      attackDiceCount: state.atkN + state.atkC,
    })
    const mitMods = mitT.applied
    const reduce = mitMods.length
    const damage = Math.max(0, state.damage - reduce)
    return {
      state: { ...state, damage },
      summary: `减免 ${reduce} → ${damage}`,
      applied: mitMods.map((m) => m.id),
      rejected: mitT.rejected.map(toRejected),
    }
  },
}

const WOUNDS_APPLY_AND_AFTER: StepFn<ShootingState> = {
  stepId: 'WOUNDS_APPLY_AND_AFTER',
  run: (state, ctx) => {
    // P12：几何资格失败（targetValid=false）→ 不造伤（FR-14 先验拦截）
    const woundsDealt = state.targetValid ? state.damage : 0
    const defenderIncapacitated = woundsDealt > 0 && woundsDealt >= ctx.defender.wounds // P7：0 伤不致残
    const markers = effectsAt(ctx.effects, 'AT_PIPELINE_END').filter((e) => e.modifier.kind === 'GRANT_MARKER')
    return {
      state: { ...state, woundsDealt, defenderIncapacitated },
      summary: `扣耐伤 ${woundsDealt}${defenderIncapacitated ? ' →残废' : ''}${markers.length ? ` →打标识 ${markers.map((m) => m.effectId).join(',')}` : ''}`,
      applied: markers.map((e) => e.effectId),
      rejected: [],
    }
  },
}

/** 射击流水线注册表（架构 §3.1，10 步顺序）。 */
export const SHOOTING_PIPELINE: StepFn<ShootingState>[] = [
  WEAPON_SELECT,
  TARGET_VALIDATE,
  HIT_ROLL,
  ATTACK_UPGRADE,
  DEFENCE_ROLL,
  DEFENCE_UPGRADE,
  PARRY_ALLOCATE,
  DAMAGE_PER_DIE,
  DAMAGE_TOTAL_MITIGATE,
  WOUNDS_APPLY_AND_AFTER,
]

export type { StepResult }
