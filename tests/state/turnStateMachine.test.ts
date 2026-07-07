import { describe, it, expect } from 'vitest'
import {
  canDoAction,
  canUsePloy,
  turnReducer,
  createInitialTurnState,
  effectiveApl,
  type TurnState,
  type ActionContext,
} from '../../src/state'
import type { Effect } from '../../src/rules'

const aplPlus = (amount: number, duration: 'ACTIVATION' | 'TURNING_POINT' | 'BATTLE' = 'ACTIVATION'): Effect => ({
  effectId: `apl${amount}`,
  label: 't',
  source: 'test',
  trigger: { point: 'ON_ACTIVATION_START' },
  pipelineStep: 'ACTIVATION_PRE',
  modifier: { kind: 'APL_PLUS', payload: { amount, duration } },
  stacking: { policy: 'UNIQUE_PER_ACTION' },
})

function stateWithOp(over: Partial<TurnState['operatives'][string]> = {}): TurnState {
  const s = createInitialTurnState()
  s.phase = 'ENGAGEMENT'
  s.operatives = {
    op1: {
      order: 'ENGAGED',
      ready: true,
      apUsed: 0,
      actionsThisActivation: [],
      fallBackDone: false,
      chargeDone: false,
      moveDone: false,
      ...over,
    },
  }
  return s
}

const ctx = (over: Partial<ActionContext> = {}): ActionContext => ({
  apl: 3,
  isAstartes: false,
  inEngagementRange: false,
  enemyInEngagement: false,
  ...over,
})

describe('canDoAction 行动合法性 (FR-12)', () => {
  it('AP 不足拒绝', () => {
    const s = stateWithOp({ apUsed: 2 }) // APL 3，剩 1
    expect(canDoAction(s, 'op1', 'FALL_BACK', ctx()).ok).toBe(false) // 需 2
  })
  it('后撤后禁转移', () => {
    const s = stateWithOp({ fallBackDone: true })
    expect(canDoAction(s, 'op1', 'MOVE', ctx()).ok).toBe(false)
    expect(canDoAction(s, 'op1', 'SHOOT', ctx()).ok).toBe(true)
  })
  it('隐匿禁射击', () => {
    const s = stateWithOp({ order: 'CONCEALED' })
    expect(canDoAction(s, 'op1', 'SHOOT', ctx()).ok).toBe(false)
  })
  it('控制范围内禁射击', () => {
    const s = stateWithOp({ order: 'ENGAGED' })
    expect(canDoAction(s, 'op1', 'SHOOT', ctx({ inEngagementRange: true })).ok).toBe(false)
  })
  it('近战需敌方在控制范围', () => {
    const s = stateWithOp()
    expect(canDoAction(s, 'op1', 'FIGHT', ctx({ enemyInEngagement: false })).ok).toBe(false)
    expect(canDoAction(s, 'op1', 'FIGHT', ctx({ enemyInEngagement: true })).ok).toBe(true)
  })
  it('同激活不重复（非阿斯塔特）', () => {
    const s = stateWithOp({ actionsThisActivation: ['SHOOT'] })
    expect(canDoAction(s, 'op1', 'SHOOT', ctx()).ok).toBe(false)
  })
  it('阿斯塔特双射击允许', () => {
    const s = stateWithOp({ actionsThisActivation: ['SHOOT'] })
    expect(canDoAction(s, 'op1', 'SHOOT', ctx({ isAstartes: true })).ok).toBe(true)
    // 第三次仍禁
    const s2 = stateWithOp({ actionsThisActivation: ['SHOOT', 'SHOOT'] })
    expect(canDoAction(s2, 'op1', 'SHOOT', ctx({ isAstartes: true })).ok).toBe(false)
  })
  it('未就绪拒绝', () => {
    const s = stateWithOp({ ready: false })
    expect(canDoAction(s, 'op1', 'MOVE', ctx()).ok).toBe(false)
  })
})

describe('canUsePloy 计谋次数', () => {
  it('每场上限拦截', () => {
    const s = createInitialTurnState()
    s.ployUses = { p1: { used: 1, perBattle: 1 } }
    expect(canUsePloy(s, 'p1').ok).toBe(false)
  })
  it('未达上限放行', () => {
    const s = createInitialTurnState()
    s.ployUses = { p1: { used: 0, perBattle: 1 } }
    expect(canUsePloy(s, 'p1').ok).toBe(true)
  })
})

describe('turnReducer 激活流', () => {
  it('激活→行动→结束激活→待机', () => {
    let s = createInitialTurnState()
    s.operatives = { op1: { order: 'ENGAGED', ready: true, apUsed: 0, actionsThisActivation: [], fallBackDone: false, chargeDone: false, moveDone: false } }
    s = turnReducer(s, { type: 'ACTIVATE', opId: 'op1', player: 'a' })
    s = turnReducer(s, { type: 'DO_ACTION', opId: 'op1', action: 'MOVE' })
    expect(s.operatives.op1?.apUsed).toBe(1)
    s = turnReducer(s, { type: 'END_ACTIVATION', opId: 'op1' })
    expect(s.operatives.op1?.ready).toBe(false)
  })
  it('结束转折点：序号+1、翻回就绪、CP 增', () => {
    let s = createInitialTurnState()
    s.operatives = { op1: { order: 'ENGAGED', ready: false, apUsed: 1, actionsThisActivation: ['MOVE'], fallBackDone: false, chargeDone: false, moveDone: true } }
    s = turnReducer(s, { type: 'END_TURNING_POINT' })
    expect(s.turningPoint).toBe(2)
    expect(s.operatives.op1?.ready).toBe(true)
    expect(s.cp.a).toBeGreaterThan(2)
  })
  it('第 4 转折点结束 → BATTLE_END', () => {
    let s = createInitialTurnState()
    s.turningPoint = 4
    s = turnReducer(s, { type: 'END_TURNING_POINT' })
    expect(s.phase).toBe('BATTLE_END')
  })
})

describe('turnReducer 内嵌 guard（DN6：reducer 自防御）', () => {
  it('DO_ACTION 带 ctx 且 guard 失败 → 不变更（防御性 no-op）', () => {
    const s0 = stateWithOp({ apUsed: 2 }) // APL 3 剩 1，FALL_BACK 需 2
    const before = JSON.parse(JSON.stringify(s0))
    const s = turnReducer(s0, { type: 'DO_ACTION', opId: 'op1', action: 'FALL_BACK', ctx: ctx() })
    expect(s).toEqual(before) // apUsed 仍 2，未应用
  })

  it('DO_ACTION 带 ctx 且 guard 通过 → 应用', () => {
    const s0 = stateWithOp()
    const s = turnReducer(s0, { type: 'DO_ACTION', opId: 'op1', action: 'MOVE', ctx: ctx() })
    expect(s.operatives.op1?.apUsed).toBe(1)
  })

  it('DO_ACTION 无 ctx → 向后兼容不拦（调用方已 guard）', () => {
    const s0 = stateWithOp({ apUsed: 2 })
    const s = turnReducer(s0, { type: 'DO_ACTION', opId: 'op1', action: 'FALL_BACK' })
    expect(s.operatives.op1?.apUsed).toBe(4) // 无 guard，2+2
  })

  it('USE_PLOY 超 perBattle 上限 → 不变更', () => {
    let s = createInitialTurnState()
    s.ployUses = { p1: { used: 1, perBattle: 1 } }
    s.cp = { a: 4, b: 4 }
    s = turnReducer(s, { type: 'USE_PLOY', ployId: 'p1', player: 'a', cpCost: 1 })
    expect(s.cp.a).toBe(4) // 未扣
    expect(s.ployUses.p1?.used).toBe(1) // 未增
  })

  it('USE_PLOY CP clamp 防负', () => {
    let s = createInitialTurnState()
    s.cp = { a: 1, b: 4 }
    s = turnReducer(s, { type: 'USE_PLOY', ployId: 'x', player: 'a', cpCost: 3 })
    expect(s.cp.a).toBe(0) // 非 -2
  })

  it('END_TURNING_POINT 重置 perTurningPoint 计谋 used（战斗级保持）', () => {
    let s = createInitialTurnState()
    s.ployUses = {
      perTP: { used: 1, perTurningPoint: 1 },
      perBattle: { used: 1, perBattle: 3 },
    }
    s = turnReducer(s, { type: 'END_TURNING_POINT' })
    expect(s.ployUses.perTP?.used).toBe(0) // 跨 TP 重置
    expect(s.ployUses.perBattle?.used).toBe(1) // 战斗级保持
  })

  it('USE_PLOY perTurningPoint 跨 TP 后可再用', () => {
    let s = createInitialTurnState()
    s.ployUses = { perTP: { used: 1, perTurningPoint: 1 } }
    s = turnReducer(s, { type: 'END_TURNING_POINT' }) // 重置 used→0
    s = turnReducer(s, { type: 'USE_PLOY', ployId: 'perTP', player: 'a', cpCost: 1 })
    expect(s.ployUses.perTP?.used).toBe(1) // 重置后再次使用成功
  })
})

describe('effectiveApl — APL_PLUS 引擎消费（W3a）', () => {
  it('base APL + Σ APL_PLUS amount', () => {
    expect(effectiveApl(3, [aplPlus(1)])).toBe(4) // 变异与扭转 +1
  })

  it('负向 APL_PLUS（不祥迷惑 −1）扣减', () => {
    expect(effectiveApl(3, [aplPlus(-1)])).toBe(2)
  })

  it('多条 APL_PLUS 叠加', () => {
    expect(effectiveApl(2, [aplPlus(1), aplPlus(-1)])).toBe(2)
  })

  it('非 APL_PLUS effect 不影响（过滤）', () => {
    const hit: Effect = {
      effectId: 'h', label: 't', source: 'test',
      trigger: { point: 'BEFORE_HIT_ROLL' }, pipelineStep: 'HIT_ROLL',
      modifier: { kind: 'HIT_PLUS', payload: { amount: 1 } },
      stacking: { policy: 'STACKABLE' },
    }
    expect(effectiveApl(3, [hit, aplPlus(1)])).toBe(4)
  })

  it('无 APL_PLUS → base 不变', () => {
    expect(effectiveApl(3, [])).toBe(3)
  })

  it('端到端：effectiveApl 喂 canDoAction → APL+1 允许原本超 AP 的行动', () => {
    // base APL 2，apUsed 2：剩 0，FALL_BACK(需2) 拒；APL_PLUS +1 → 剩 1 仍拒；
    // 但 MOVE(需1) 在 base 下 apUsed2>剩0 拒，+1 后剩1 允
    const s = stateWithOp({ apUsed: 2 })
    expect(canDoAction(s, 'op1', 'MOVE', ctx({ apl: effectiveApl(2, []) })).ok).toBe(false)
    expect(canDoAction(s, 'op1', 'MOVE', ctx({ apl: effectiveApl(2, [aplPlus(1)]) })).ok).toBe(true)
  })
})
