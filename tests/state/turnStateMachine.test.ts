import { describe, it, expect } from 'vitest'
import {
  canDoAction,
  canUsePloy,
  turnReducer,
  createInitialTurnState,
  type TurnState,
  type ActionContext,
} from '../../src/state'

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
