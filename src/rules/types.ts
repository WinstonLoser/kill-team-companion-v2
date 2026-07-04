// 规则数据 schema（架构 §2）。纯类型，零 UI 依赖。data-driven 的数据面。

// ===== 触发点（架构 §2.4.2） =====
export const TRIGGER_POINTS = [
  'BEFORE_PIPELINE', 'BEFORE_HIT_ROLL', 'ON_HIT_ROLL', 'AFTER_HIT_ROLL',
  'BEFORE_DEFENCE_ROLL', 'ON_DEFENCE_ROLL', 'AFTER_DEFENCE_ROLL',
  'ON_PARRY_ALLOCATION', 'ON_DAMAGE_PER_DIE', 'ON_DAMAGE_TOTAL',
  'BEFORE_WOUNDS_REDUCE', 'AT_PIPELINE_END', 'ON_ACTIVATION_START',
  'ON_ACTIVATION_END', 'ON_REACTION', 'ON_INCAPACITATED', 'ON_TURNING_POINT_END',
] as const
export type TriggerPoint = (typeof TRIGGER_POINTS)[number]

// ===== 流水线 step id（架构 §3.1 射击10 + 近战7 + 激活） =====
export const PIPELINE_STEPS = [
  'WEAPON_SELECT', 'TARGET_VALIDATE', 'HIT_ROLL', 'ATTACK_UPGRADE',
  'DEFENCE_ROLL', 'DEFENCE_UPGRADE', 'PARRY_ALLOCATE', 'DAMAGE_PER_DIE',
  'DAMAGE_TOTAL_MITIGATE', 'WOUNDS_APPLY_AND_AFTER',
  'MELEE_TARGET_SELECT', 'MELEE_WEAPON_SELECT', 'MELEE_SIMULTANEOUS_ROLL',
  'MELEE_ALTERNATING_RESOLVE', 'MELEE_PARRY_RULES', 'MELEE_DAMAGE_AND_MITIGATE', 'MELEE_AFTER',
  'ACTIVATION_PRE',
] as const
export type PipelineStep = (typeof PIPELINE_STEPS)[number]

// ===== 叠加 policy（架构 §2.6 + DN2 R9，7 种） =====
export const STACKING_POLICIES = [
  'STACKABLE', 'UNIQUE_PER_SOURCE', 'UNIQUE_PER_GROUP',
  'MUTUALLY_EXCLUSIVE_WITH', 'CONDITIONAL', 'CAP_PER_ATTACK_DIE', 'UNIQUE_PER_ACTION',
] as const
export type StackingPolicy = (typeof STACKING_POLICIES)[number]

// ===== 条件谓词（壳；谓词库实现留 Story 1.4/1.6） =====
export interface ConditionPredicate {
  op: string
  args?: (string | number)[]
  all?: ConditionPredicate[]
  any?: ConditionPredicate[]
}

// ===== modifier 判别联合（架构 §2.4.1 表 + HEAL_OPERATIVE 补丁 D-32，共 21 种） =====
export type Modifier =
  | { kind: 'HIT_PLUS'; payload: { amount: number } }
  | { kind: 'HIT_MINUS'; payload: { amount: number } }
  | { kind: 'DAMAGE_PLUS'; payload: { amount: number; scope: 'NORMAL' | 'CRITICAL' | 'BOTH' } }
  | { kind: 'DAMAGE_MINUS'; payload: { amount: number; scope: 'NORMAL' | 'CRITICAL' | 'BOTH' } }
  | { kind: 'UPGRADE_SUCCESS'; payload: { fromNatRoll?: number } }
  | { kind: 'DOWNGRADE_SUCCESS'; payload: Record<string, never> }
  | { kind: 'COUNT_PLUS'; payload: { dice: 'ATTACK' | 'DEFENCE'; amount: number } }
  | { kind: 'COUNT_MINUS'; payload: { dice: 'ATTACK' | 'DEFENCE'; amount: number } }
  | { kind: 'REROLL'; payload: { mode: 'ALL' | 'CHOOSE'; count?: number } }
  | { kind: 'AUTO_SUCCESS'; payload: { count: number; grade: 'NORMAL' | 'CRITICAL' } }
  | { kind: 'ATTACH_WEAPON_RULE'; payload: { rule: string } }
  | { kind: 'PIERCE'; payload: { amount: number; criticalOnly?: boolean } }
  | { kind: 'COVER_SAVE'; payload: { extraNormal: number; upgradeToCritical?: boolean } }
  | { kind: 'DAMAGE_MITIGATION'; payload: { threshold: number; roll: string } }
  | { kind: 'IGNORE_DAMAGE'; payload: { oncePerBattleId?: string } }
  | { kind: 'IMMUNITY'; payload: { immuneToEffectGroup: string } }
  | { kind: 'EXTRA_DAMAGE_ON_HIT'; payload: { amount: number; cap?: number } }
  | { kind: 'GRANT_MARKER'; payload: { marker: string; target: 'SELF' | 'DEFENDER' | 'ATTACKER'; atStep?: string } }
  | { kind: 'HEAL_OPERATIVE'; payload: { amount: number; target: 'SELF' | 'DEFENDER' | 'ATTACKER'; condition?: string } }
  | { kind: 'APL_PLUS'; payload: { amount: number; duration: 'ACTIVATION' | 'TURNING_POINT' | 'BATTLE' } }
  | { kind: 'CUSTOM_HOOK'; payload: { hookId: string; prompt: string } }
  | { kind: 'STAT_OVERRIDE'; payload: { stat: 'save' | 'move' | 'apl'; value: number } }
  | { kind: 'ACTION_AP_MOD'; payload: { action: string; delta: number } }

export type ModifierKind = Modifier['kind']

export const MODIFIER_KINDS = [
  'HIT_PLUS', 'HIT_MINUS', 'DAMAGE_PLUS', 'DAMAGE_MINUS',
  'UPGRADE_SUCCESS', 'DOWNGRADE_SUCCESS', 'COUNT_PLUS', 'COUNT_MINUS',
  'REROLL', 'AUTO_SUCCESS', 'ATTACH_WEAPON_RULE', 'PIERCE', 'COVER_SAVE',
  'DAMAGE_MITIGATION', 'IGNORE_DAMAGE', 'IMMUNITY', 'EXTRA_DAMAGE_ON_HIT',
  'GRANT_MARKER', 'HEAL_OPERATIVE', 'APL_PLUS', 'CUSTOM_HOOK',
  'STAT_OVERRIDE', 'ACTION_AP_MOD',
] as const satisfies readonly ModifierKind[]

// ===== Effect 描述符（四问：trigger.point / pipelineStep / modifier.kind / stacking.policy） =====
export interface Effect {
  effectId: string
  label: string
  source: string
  trigger: { point: TriggerPoint; condition?: ConditionPredicate }
  pipelineStep: PipelineStep
  priority?: number
  modifier: Modifier
  stacking: { policy: StackingPolicy; groupKeys?: string[] }
  rulesRef?: { doc: string; section: string }
}

// ===== 数据包结构（架构 §2.1-2.3） =====
export interface SubFactionSelector {
  id: string
  label: string
  options: string[] // option ids（阵营机制 = 数据；死亡天使=战团战术 effectId，军团兵=印记 id）
  max: number // 可选项数上限（死亡天使 8 选 2 → max=2；军团兵印记 5 选 1 → max=1）
  default?: string
  /** 选择器作用域：team=整队选 max 项（战团战术）；perOperative=每名特工各选（混沌印记，存 perOperativeMarks）。默认 team。 */
  scope?: 'team' | 'perOperative'
}

export interface OperativeStats {
  apl: number
  move: number
  save: number
  wounds: number
}

export interface Operative {
  operativeId: string
  name: string
  keywords: string[]
  stats: OperativeStats
  base: { diameterMm: number } // D-27：规则源不提供，GW 约定
  weaponRefs: string[]
  abilities?: string[]
}

export type WeaponKind = 'RANGED' | 'MELEE'

export interface WeaponProfile {
  attacks: number
  hit: number
  normalDamage: number
  criticalDamage: number
  range?: number
  weaponRules: string[]
}

export interface Weapon {
  weaponId: string
  name: string
  kind: WeaponKind
  profile: WeaponProfile
  keywords: string[]
}

export interface Stratagem {
  id: string
  name: string
  cp: number
  useLimit: { perBattle?: number; perTurningPoint?: number }
  phase: 'STRATEGY' | 'ENGAGEMENT'
}

export interface Wargear {
  id: string
  name: string
}

export interface BuildConstraints {
  // 特工来源结构性约束（KT Lite 无点数 D-30，仅 min/max 数量）
  operatives?: { min?: number; max?: number }
  /** AC3 队长规则：入队特工须 ≥1 名来自该列表（如 [野心勇士, 神选者]）。 */
  leaderFrom?: string[]
  /** AC3 每类限 1：除该例外列表（如 [战士]）外，每个 operativeId 全队最多 1 名。 */
  maxPerTypeExcept?: string[]
  // 装备限制：key 为 weaponId 或武器 keyword（按 equipmentLimitScope 判定），value 为全队上限数量
  equipmentLimits?: Record<string, number>
  equipmentLimitScope?: 'weaponId' | 'keyword'
  notes?: string
}

export interface Faction {
  id: string
  name: string
  keywords: string[]
  subFactionSelector?: SubFactionSelector
}

export interface FactionPack {
  packId: string
  version: string
  rulesetVersion: string
  faction: Faction
  operatives: Operative[]
  weapons: Weapon[]
  effects: Effect[]
  stratagems?: Stratagem[]
  wargear?: Wargear[]
  buildConstraints?: BuildConstraints
}
