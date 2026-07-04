import { describe, it, expect, beforeEach } from 'vitest'
import { useMatchStore } from '../../src/state/matchStore'
import { useRosterStore } from '../../src/state/rosterStore'
import { effectiveMove, effectiveApl, effectiveActionAp } from '../../src/state/turnStateMachine'
import type { Effect } from '../../src/rules'

// 验证 effectiveApl/effectiveMove/effectiveActionAp + matchStore.checkAction/effectiveAplOf/effectiveMoveOf 接线
beforeEach(() => {
  useMatchStore.getState().reset()
  useRosterStore.setState({
    rosterA: { factionId: 'angels_of_death', operativeIds: ['angels_intercessor_warrior'], loadout: {}, subFactionSelection: [], perOperativeMarks: {}, wargearAssignment: {} },
    rosterB: { factionId: 'angels_of_death', operativeIds: ['angels_intercessor_warrior'], loadout: {}, subFactionSelection: [], perOperativeMarks: {}, wargearAssignment: {} },
    editing: 'a',
  })
  useMatchStore.setState({
    mapPack: {
      mapId: 't', name: 't', version: '1', bounds: { w: 30, h: 20 }, terrain: [],
      objectives: [{ id: 'o', pos: { x: 15, y: 10 }, controlRange: 3 }],
      dropZones: { a: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 20 }, { x: 0, y: 20 }], b: [{ x: 24, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 24, y: 20 }] },
    },
    tokens: [
      { uid: 'a1', side: 'a', opId: 'angels_tactical', name: 'A1', pos: { x: 2, y: 5 }, facing: 0, baseRadius: 0.63, wounds: 13, maxWounds: 13, markers: [], alive: true, placed: true, order: 'CONCEAL' },
    ],
  })
})

describe('effectiveApl / effectiveMove / effectiveActionAp 纯函数', () => {
  it('base APL 无 effect → 3', () => {
    expect(effectiveApl(3, [])).toBe(3)
  })

  it('APL_PLUS +1 → 4', () => {
    const eff: Effect = { effectId: 'x', label: 'x', source: 'test', trigger: { point: 'ON_ACTIVATION_START' }, pipelineStep: 'ACTIVATION_PRE', modifier: { kind: 'APL_PLUS', payload: { amount: 1, duration: 'ACTIVATION' } }, stacking: { policy: 'UNIQUE_PER_ACTION' } }
    expect(effectiveApl(3, [eff])).toBe(4)
  })

  it('effectiveMove base 6 + STAT_OVERRIDE move +1 → 7', () => {
    const eff: Effect = { effectId: 'x', label: 'x', source: 'test', trigger: { point: 'ON_ACTIVATION_START' }, pipelineStep: 'ACTIVATION_PRE', modifier: { kind: 'STAT_OVERRIDE', payload: { stat: 'move', value: 1 } }, stacking: { policy: 'UNIQUE_PER_SOURCE' } }
    expect(effectiveMove(6, [eff])).toBe(7)
  })

  it('effectiveActionAp FALL_BACK base 1, ACTION_AP_MOD -1 → 1', () => {
    const eff: Effect = { effectId: 'x', label: 'x', source: 'test', trigger: { point: 'ON_ACTIVATION_START' }, pipelineStep: 'ACTIVATION_PRE', modifier: { kind: 'ACTION_AP_MOD', payload: { action: 'FALL_BACK', delta: -1 } }, stacking: { policy: 'UNIQUE_PER_SOURCE' } }
    // base 1 + delta(-1) = 0, clamped to 1
    expect(effectiveActionAp('FALL_BACK', 1, [eff])).toBe(1)
    // without effect → 1
    expect(effectiveActionAp('FALL_BACK', 1, [])).toBe(1)
  })
})

describe('matchStore effectiveAplOf / effectiveMoveOf 接线', () => {
  it('angels_tactical APL 3, move 6', () => {
    const s = useMatchStore.getState()
    expect(s.effectiveAplOf('a1')).toBe(3)
    expect(s.effectiveMoveOf('a1')).toBe(6)
  })
})

describe('matchStore checkAction', () => {
  it('未激活特工 → not ok', () => {
    const s = useMatchStore.getState()
    const r = s.checkAction('a1', 'MOVE')
    expect(r.ok).toBe(false)
  })

  it('激活后 MOVE → ok', () => {
    const s = useMatchStore.getState()
    s.activate('a1', 'a')
    const r = s.checkAction('a1', 'MOVE')
    expect(r.ok).toBe(true)
  })
})
