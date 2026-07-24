// 射击 10 步流水线（架构 §3.1，DN1 StepFn 注册表）。每步纯函数，逻辑自旧 runShooting 平移（数值不变）。
// P22：属性经 resolveStat（两层模型，FR-2）+ 共享 resolveEffects（去重，不再自建 modsOf）。

import type { Effect } from '../../rules/types'
import { validateTarget } from '../../geometry'
import { parryAllocation } from '../parry'
import { withAttachedRules, attachedRules } from '../weaponResolver'
import { resolveEffectsTraced, resolveStat } from '../statResolver'
import type { EnforcerContext } from '../statResolver'
import type { AppliedModifier } from '../statResolver'
import { evalConditionFor } from '../../rules/predicates'
import type { RejectionTrace } from '../enforcer'
import type { ShootingState, StepFn, StepResult } from './types'

const effectsAt = (effects: Effect[], point: string): Effect[] =>
  effects.filter((e) => e.trigger.point === point)

/** 攻方 + 防方 effect 合并（防御方 stratagem/wargear 影响攻击方掷骰等；enforcer 去重）。 */
const allEffects = (ctx: { effects: Effect[]; defenderEffects?: Effect[] }): Effect[] =>
  [...ctx.effects, ...(ctx.defenderEffects ?? [])]

const sum = (mods: AppliedModifier[]): number => mods.reduce((s, m) => s + m.amount, 0)
const clampHits = (n: number): number => Math.max(2, Math.min(6, n))

/** W3 谓词接线：把 ctx.predicate 包成 evalCondition 注入 EnforcerContext。 */
const withPred = (ctx: { predicate?: import('../../rules/predicates').PredicateContext }, extra: EnforcerContext = {}): EnforcerContext =>
  ctx.predicate ? { evalCondition: evalConditionFor(ctx.predicate), ...extra } : extra

/** RejectionTrace → StepTrace.rejectedEffectIds 条目（ruleId + reason 留痕） */
const toRejected = (r: RejectionTrace): { id: string; reason: string } => ({
  id: r.id,
  reason: `${r.ruleId} ${r.reason}`,
})

export function createInitialShootingState(profile: { hit: number; weaponRules?: string[] }): ShootingState {
  return {
    hitThreshold: profile.hit,
    effectiveWeaponRules: profile.weaponRules ?? [],
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
    rotCurseDamage: 0,
  }
}

const WEAPON_SELECT: StepFn<ShootingState> = {
  stepId: 'WEAPON_SELECT',
  run: (state, ctx) => {
    // W3b：消费 ATTACH_WEAPON_RULE——解析有效武器规则（base + 附加），写入 state。
    const weapon = ctx.attacker.weapon
    const effective = withAttachedRules(weapon, ctx.effects)
    const added = attachedRules(weapon, ctx.effects)
    return {
      state: { ...state, effectiveWeaponRules: effective.profile.weaponRules },
      summary: `武器 ${weapon.name}${added.length ? ` +附加 ${added.join('/')}` : ''}`,
      applied: [],
      rejected: [],
    }
  },
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
    const hmT = resolveEffectsTraced(allEffects(ctx), 'BEFORE_HIT_ROLL', ['HIT_MINUS'], withPred(ctx))
    const hpT = resolveEffectsTraced(allEffects(ctx), 'BEFORE_HIT_ROLL', ['HIT_PLUS'], withPred(ctx))
    const rrT = resolveEffectsTraced(allEffects(ctx), 'BEFORE_HIT_ROLL', ['REROLL'], withPred(ctx))
    const hitMinus = hmT.applied
    const hitPlus = hpT.applied
    // P22：命中阈值经 resolveStat 两层模型（base=profile.hit）。HIT_MINUS 升阈(+)，HIT_PLUS 降阈(取负)
    const hitMods = [...hitMinus, ...hitPlus.map((m) => ({ ...m, amount: -m.amount }))]
    const hitThreshold = clampHits(resolveStat(profile.hit, hitMods).effective)
    let attackDice = ctx.dice.roll(profile.attacks)
    // D1：重掷（REROLL @ BEFORE_HIT_ROLL）——mode ALL 重掷全部攻击骰；CHOOSE 重掷失败骰（上限 count）。
    // 无分印记「无休」；此前流水线不消费 REROLL kind（Story 2.2 盘点披露）。payload 从原 effect 取。
    const rerollApplied: string[] = []
    if (rrT.applied.length > 0) {
      const appliedIds = new Set(rrT.applied.map((m) => m.id))
      const effs = effectsAt(ctx.effects, 'BEFORE_HIT_ROLL').filter((e) => e.modifier.kind === 'REROLL' && appliedIds.has(e.effectId))
      const rerollAll = effs.some((e) => (e.modifier.payload as { mode?: string }).mode === 'ALL')
      if (rerollAll) {
        attackDice = ctx.dice.roll(profile.attacks)
      } else {
        const count = effs.reduce((s, e) => s + ((e.modifier.payload as { count?: number }).count ?? 0), 0)
        let budget = count
        attackDice = attackDice.map((d) => {
          if (budget > 0 && d.nat !== 6 && (d.nat === 1 || d.nat < hitThreshold)) {
            budget--
            return ctx.dice.roll(1)[0]!
          }
          return d
        })
      }
      rrT.applied.forEach((m) => rerollApplied.push(m.id))
    }
    let normalSuccess = 0
    let criticalSuccess = 0
    for (const d of attackDice) {
      if (d.nat === 1) continue
      if (d.nat === 6) criticalSuccess++
      else if (d.nat >= hitThreshold) normalSuccess++
    }
    return {
      state: { ...state, hitThreshold, attackDice, normalSuccess, criticalSuccess },
      summary: `命中${hitThreshold}+ → 普通${normalSuccess} 关键${criticalSuccess}${rerollApplied.length ? '（重掷）' : ''}`,
      dice: attackDice,
      applied: [...hitMinus, ...hitPlus].map((m) => m.id).concat(rerollApplied),
      rejected: [...hmT.rejected, ...hpT.rejected, ...rrT.rejected].map(toRejected),
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
    const pierceT = resolveEffectsTraced(ctx.effects, 'BEFORE_DEFENCE_ROLL', ['PIERCE'], withPred(ctx))
    const pierce = pierceT.applied
    const defenceDiceCount = Math.max(0, 3 - sum(pierce))
    const defDice = ctx.dice.roll(defenceDiceCount)
    // 5-1: STAT_OVERRIDE{stat:'save'} from effects → override save threshold
    const overrides = allEffects(ctx).filter((e) => e.modifier.kind === 'STAT_OVERRIDE' && (e.modifier.payload as { stat?: string }).stat === 'save')
    const effectiveSave = overrides.length ? Math.min(...overrides.map((e) => (e.modifier.payload as { value: number }).value)) : ctx.defender.save
    const saveThresh = clampHits(effectiveSave) // P18：save 钳到 2..6
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
    // 腐烂诅咒（rot_curse，per-die，dieFaceEquals 驱动）：ON_DEFENCE_ROLL effect 带 dieFaceEquals(face) 条件
    // → 每枚防御骰面值===face 累加 1 伤（不可保留/重掷，DAMAGE_PER_DIE 加入造伤）。
    const rotEffs = effectsAt(ctx.effects, 'ON_DEFENCE_ROLL').filter((e) => {
      const c = (e.trigger as { condition?: { op?: string } }).condition
      return c?.op === 'dieFaceEquals'
    })
    let rotCurseDamage = 0
    const rotApplied: string[] = []
    for (const e of rotEffs) {
      const face = (e.trigger as { condition?: { args?: (string | number)[] } }).condition?.args?.[0]
      if (typeof face === 'number') {
        const hits = defDice.filter((d) => d.nat === face).length
        if (hits > 0) { rotCurseDamage += hits; rotApplied.push(e.effectId) }
      }
    }
    return {
      state: { ...state, defDice, defNormal, defCritical, rotCurseDamage },
      summary: `防御骰${defenceDiceCount} → 普通成功${defNormal} 关键${defCritical}${ctx.hasCover ? ' +掩护豁免' : ''}${rotCurseDamage ? ` 腐烂诅咒+${rotCurseDamage}` : ''}`,
      dice: defDice,
      applied: [...pierce.map((m) => m.id), ...coverEffs.map((e) => e.effectId), ...rotApplied],
      rejected: pierceT.rejected.map(toRejected),
    }
  },
}

const DEFENCE_UPGRADE: StepFn<ShootingState> = {
  stepId: 'DEFENCE_UPGRADE',
  run: (state, ctx) => {
    // 5-3：防御方 UPGRADE_SUCCESS（如 capricious_fate 无常命运）从 allEffects 消费
    let { defNormal, defCritical } = state
    const upgrades = effectsAt(allEffects(ctx), 'AFTER_DEFENCE_ROLL').filter((e) => e.modifier.kind === 'UPGRADE_SUCCESS')
    const applied: string[] = []
    for (const e of upgrades) {
      if (defNormal > 0) { defNormal--; defCritical++; applied.push(e.effectId) }
    }
    return {
      state: { ...state, defNormal, defCritical },
      summary: `防御成功 普通${defNormal} 关键${defCritical}${applied.length ? '（升级）' : ''}`,
      applied,
      rejected: [],
    }
  },
}

const PARRY_ALLOCATE: StepFn<ShootingState> = {
  stepId: 'PARRY_ALLOCATE',
  run: (state) => {
    // P4/DN3：防御方用共用 parryAllocation 格挡攻击方成功（关键抵关键→关键抵普通→普通抵普通）。
    const alloc = parryAllocation(
      { normal: state.defNormal, critical: state.defCritical },
      { normal: state.normalSuccess, critical: state.criticalSuccess },
    )
    const atkN = alloc.survivor.normal
    const atkC = alloc.survivor.critical
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
    const extraT = resolveEffectsTraced(ctx.effects, 'ON_DAMAGE_PER_DIE', ['EXTRA_DAMAGE_ON_HIT'], withPred(ctx))
    const extraDmg = extraT.applied
    const base = state.atkN * profile.normalDamage + state.atkC * profile.criticalDamage
    // W1：EXTRA_DAMAGE cap 强制——多 effect 叠加时，总额外伤钳到最严 cap（min）。
    const caps = extraDmg.map((m) => m.cap).filter((c): c is number => typeof c === 'number')
    const limit = caps.length ? Math.min(...caps) : Infinity
    const rawExtra = sum(extraDmg)
    const extra = Math.min(rawExtra, limit)
    // 腐烂诅咒伤（DEFENCE_ROLL 算的 per-die 面值匹配伤）加入总造伤
    const damage = base + extra + state.rotCurseDamage
    return {
      state: { ...state, damage },
      summary: `造伤 ${base} + 额外${extra}${extra < rawExtra ? `（钳 cap ${limit}）` : ''}${state.rotCurseDamage ? ` + 腐烂诅咒${state.rotCurseDamage}` : ''} = ${damage}`,
      applied: extraDmg.map((m) => m.id),
      rejected: extraT.rejected.map(toRejected),
    }
  },
}

const DAMAGE_TOTAL_MITIGATE: StepFn<ShootingState> = {
  stepId: 'DAMAGE_TOTAL_MITIGATE',
  run: (state, ctx) => {
    // DN5：CAP_PER_ATTACK_DIE 每骰语义——减伤按未抵挡命中骰数（atkN+atkC）计上限
    const mitT = resolveEffectsTraced(ctx.effects, 'ON_DAMAGE_TOTAL', ['DAMAGE_MITIGATION'], withPred(ctx, {
      attackDiceCount: state.atkN + state.atkC,
    }))
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
    const defenderIncapacitated = woundsDealt > 0 && woundsDealt >= ctx.defender.wounds
    const markers = effectsAt(allEffects(ctx), 'AT_PIPELINE_END').filter((e) => e.modifier.kind === 'GRANT_MARKER')
    // 5-5：ON_INCAPACITATED GRANT_MARKER（virulent_blight 残废时挂 POISON）——仅残废时生效
    const incapMarkers = defenderIncapacitated
      ? effectsAt(allEffects(ctx), 'ON_INCAPACITATED').filter((e) => e.modifier.kind === 'GRANT_MARKER')
      : []
    const allMarkers = [...markers, ...incapMarkers]
    return {
      state: { ...state, woundsDealt, defenderIncapacitated },
      summary: `扣耐伤 ${woundsDealt}${defenderIncapacitated ? ' →残废' : ''}${allMarkers.length ? ` →打标识 ${allMarkers.map((m) => m.effectId).join(',')}` : ''}`,
      applied: allMarkers.map((e) => e.effectId),
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
