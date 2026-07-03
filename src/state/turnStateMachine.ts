// 回合/激活状态机（FR-11/FR-12）。用可测 reducer 表达分层状态；XState 可作生产包装。
// 行动合法性 guard 是 FR-12 的可测核心。

import type { Effect } from '../rules/types'

export type Order = 'ENGAGED' | 'CONCEALED'
export type ActionType = 'MOVE' | 'DASH' | 'FALL_BACK' | 'CHARGE' | 'SHOOT' | 'FIGHT'

export const ACTION_AP: Record<ActionType, number> = {
  MOVE: 1,
  DASH: 1,
  FALL_BACK: 2,
  CHARGE: 1,
  SHOOT: 1,
  FIGHT: 1,
}

export interface OperativeActivation {
  order: Order
  ready: boolean
  apUsed: number
  actionsThisActivation: ActionType[]
  fallBackDone: boolean
  chargeDone: boolean
  moveDone: boolean
}

export type Phase = 'DEPLOYMENT' | 'STRATEGY' | 'ENGAGEMENT' | 'TURNING_POINT_END' | 'BATTLE_END'

export interface TurnState {
  phase: Phase
  turningPoint: number // 1..4
  activePlayer: 'a' | 'b'
  cp: { a: number; b: number }
  ployUses: Record<string, { used: number; perBattle?: number; perTurningPoint?: number }>
  operatives: Record<string, OperativeActivation>
}

export interface ActionContext {
  apl: number
  isAstartes: boolean
  inEngagementRange: boolean // 该特工位于敌方控制范围内
  enemyInEngagement: boolean // 近战目标在控制范围内
}

export interface LegalityResult {
  ok: boolean
  reason?: string
}

/**
 * 激活期有效 APL（W3a：消费 APL_PLUS kind）。base APL + Σ(本激活生效的 APL_PLUS amount)。
 * duration=ACTIVATION 的 APL_PLUS（如「变异与扭转」+1 / 「不祥迷惑」−1）在此叠加；
 * duration=TURNING_POINT/BATTLE 由调用方决定是否计入 active effects（默认全计）。
 * 纯函数：由 UI/matchStore 在构造 ActionContext.apl 时调用（AR-9 intent 驱动）。
 */
export function effectiveApl(baseApl: number, activeEffects: Effect[]): number {
  const bonus = activeEffects
    .filter((e) => e.modifier.kind === 'APL_PLUS')
    .reduce((s, e) => s + (e.modifier.payload as { amount: number }).amount, 0)
  return baseApl + bonus
}

/**
 * 5-1：激活期有效行动 AP（消费 ACTION_AP_MOD kind）。
 * base AP + Σ(匹配 action 的 ACTION_AP_MOD delta)；如 chapterTactic_mobile 后撤 -1 AP。
 */
export function effectiveActionAp(action: ActionType, baseAp: number, activeEffects: Effect[]): number {
  const mod = activeEffects
    .filter((e) => e.modifier.kind === 'ACTION_AP_MOD' && (e.modifier.payload as { action?: string }).action === action)
    .reduce((s, e) => s + (e.modifier.payload as { delta: number }).delta, 0)
  return Math.max(1, baseAp + mod) // AP 至少 1
}

/** 行动合法性（FR-12）。纯函数。 */
export function canDoAction(
  state: TurnState,
  opId: string,
  action: ActionType,
  ctx: ActionContext,
): LegalityResult {
  const op = state.operatives[opId]
  if (!op) return { ok: false, reason: '特工不存在' }
  if (!op.ready) return { ok: false, reason: '特工已待机（非就绪）' }

  // AP ≤ APL
  if (op.apUsed + ACTION_AP[action] > ctx.apl) {
    return { ok: false, reason: `AP 不足（需${ACTION_AP[action]}，剩${ctx.apl - op.apUsed}）` }
  }

  // 后撤后禁转移/冲锋
  if (op.fallBackDone && (action === 'MOVE' || action === 'CHARGE' || action === 'DASH')) {
    return { ok: false, reason: '后撤后该激活禁转移/冲锋' }
  }
  // 冲锋后禁冲刺/转移
  if (op.chargeDone && (action === 'DASH' || action === 'MOVE')) {
    return { ok: false, reason: '冲锋后禁冲刺/转移' }
  }
  // 转移/冲锋后禁冲刺（简化：moveDone 后禁 DASH）
  if (op.moveDone && action === 'DASH') {
    return { ok: false, reason: '转移后禁冲刺' }
  }

  // 同激活不重复同行动（阿斯塔特双近战/双射击例外）
  const count = op.actionsThisActivation.filter((a) => a === action).length
  const isAstartesDouble =
    ctx.isAstartes && (action === 'SHOOT' || action === 'FIGHT') && count < 2
  if (count >= 1 && !isAstartesDouble) {
    return { ok: false, reason: '同激活不可重复同一行动' }
  }

  // 行动专属前置
  if (action === 'FALL_BACK' && !ctx.inEngagementRange) {
    return { ok: false, reason: '后撤须正位于敌方控制范围内' }
  }
  if (action === 'SHOOT') {
    if (op.order === 'CONCEALED') return { ok: false, reason: '隐匿命令禁射击' }
    if (ctx.inEngagementRange) return { ok: false, reason: '控制范围内禁射击' }
  }
  if (action === 'FIGHT' && !ctx.enemyInEngagement) {
    return { ok: false, reason: '近战需敌方在控制范围内' }
  }

  return { ok: true }
}

/** CP/计谋次数追踪（FR-11）。 */
export function canUsePloy(state: TurnState, ployId: string): LegalityResult {
  const ploy = state.ployUses[ployId]
  if (!ploy) return { ok: true } // 未登记计谋不拦
  const used = ploy.used
  if (ploy.perBattle !== undefined && used >= ploy.perBattle) {
    return { ok: false, reason: `计谋 ${ployId} 达每场上限 ${ploy.perBattle}` }
  }
  if (ploy.perTurningPoint !== undefined && used >= ploy.perTurningPoint) {
    return { ok: false, reason: `计谋 ${ployId} 达每转折点上限 ${ploy.perTurningPoint}` }
  }
  return { ok: true }
}

// ===== reducer（激活流） =====
export type TurnEvent =
  | { type: 'START_BATTLE' }
  | { type: 'START_ENGAGEMENT' }
  | { type: 'ACTIVATE'; opId: string; player: 'a' | 'b' }
  | { type: 'SELECT_ORDER'; opId: string; order: Order }
  | { type: 'DO_ACTION'; opId: string; action: ActionType; ctx?: ActionContext }
  | { type: 'END_ACTIVATION'; opId: string }
  | { type: 'END_TURNING_POINT' }
  | { type: 'USE_PLOY'; ployId: string; player: 'a' | 'b'; cpCost: number }

export function createInitialTurnState(): TurnState {
  return {
    phase: 'DEPLOYMENT',
    turningPoint: 1,
    activePlayer: 'a',
    cp: { a: 2, b: 2 },
    ployUses: {},
    operatives: {},
  }
}

export function turnReducer(state: TurnState, event: TurnEvent): TurnState {
  switch (event.type) {
    case 'START_BATTLE':
      return { ...state, phase: 'STRATEGY', turningPoint: 1, cp: { a: 3, b: 3 } }
    case 'START_ENGAGEMENT':
      return { ...state, phase: 'ENGAGEMENT' }
    case 'ACTIVATE': {
      // P5：ACTIVATE 自包含——upsert 一条 ready:true 的激活条目（保留既有 order）。
      // 调用方只需 dispatch ACTIVATE，不再需手填 operatives（避免双写/孤儿条目）。
      const prev = state.operatives[event.opId]
      return {
        ...state,
        activePlayer: event.player,
        operatives: {
          ...state.operatives,
          [event.opId]: {
            order: prev?.order ?? 'ENGAGED',
            ready: true,
            apUsed: 0,
            actionsThisActivation: [],
            fallBackDone: false,
            chargeDone: false,
            moveDone: false,
          },
        },
      }
    }
    case 'SELECT_ORDER': {
      const op = state.operatives[event.opId]
      if (!op) return state
      return { ...state, operatives: { ...state.operatives, [event.opId]: { ...op, order: event.order } } }
    }
    case 'DO_ACTION': {
      const op = state.operatives[event.opId]
      if (!op) return state
      // DN6：内嵌 guard。带 ctx 则先验合法性，非法行动防御性 no-op（不依赖调用方先 guard）。
      // 无 ctx → 向后兼容（调用方已 guard），直接应用。
      if (event.ctx && !canDoAction(state, event.opId, event.action, event.ctx).ok) return state
      const next: OperativeActivation = {
        ...op,
        apUsed: op.apUsed + ACTION_AP[event.action],
        actionsThisActivation: [...op.actionsThisActivation, event.action],
        fallBackDone: op.fallBackDone || event.action === 'FALL_BACK',
        chargeDone: op.chargeDone || event.action === 'CHARGE',
        moveDone: op.moveDone || event.action === 'MOVE',
      }
      return { ...state, operatives: { ...state.operatives, [event.opId]: next } }
    }
    case 'END_ACTIVATION': {
      const op = state.operatives[event.opId]
      if (!op) return state
      return { ...state, operatives: { ...state.operatives, [event.opId]: { ...op, ready: false } } }
    }
    case 'USE_PLOY': {
      // DN6：内嵌 guard（计谋次数上限先验）+ CP clamp 防负（补丁 #10）。
      if (!canUsePloy(state, event.ployId).ok) return state
      const ploy = state.ployUses[event.ployId]
      const next = {
        ...state,
        cp: { ...state.cp, [event.player]: Math.max(0, state.cp[event.player] - event.cpCost) },
        ployUses: {
          ...state.ployUses,
          [event.ployId]: { used: (ploy?.used ?? 0) + 1, perBattle: ploy?.perBattle, perTurningPoint: ploy?.perTurningPoint },
        },
      }
      return next
    }
    case 'END_TURNING_POINT': {
      if (state.phase === 'BATTLE_END') return state // 终态保护（P11）
      const next = state.turningPoint + 1
      // 翻回就绪 + CP 发放（先手+1/非先手+2，简化：双方 +2）
      const ops = Object.fromEntries(
        Object.entries(state.operatives).map(([id, o]) => [id, { ...o, ready: true, apUsed: 0, actionsThisActivation: [], fallBackDone: false, chargeDone: false, moveDone: false }]),
      )
      // P10：每转折点计谋次数重置（perBattle 保留）
      const ployUses = Object.fromEntries(
        Object.entries(state.ployUses).map(([k, v]) => [
          k,
          v.perTurningPoint ? { ...v, used: 0 } : v,
        ]),
      )
      return {
        ...state,
        turningPoint: next,
        phase: next > 4 ? 'BATTLE_END' : 'STRATEGY',
        cp: { a: state.cp.a + 2, b: state.cp.b + 2 },
        operatives: ops,
        ployUses,
      }
    }
    default:
      return state
  }
}
