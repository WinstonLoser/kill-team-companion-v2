import { describe, expect, it } from 'vitest'
import { evaluateElevationMove } from '../../src/geometry/elevationMove'
import { VOLKUS_MAPS } from '../../src/data/packs/maps/volkus'
import { engagementFinding, rangeFinding } from '../../src/geometry'
import { useMatchStore, vantageBonus } from '../../src/state/matchStore'
import { createInitialTurnState, turnReducer } from '../../src/state/turnStateMachine'

const map = VOLKUS_MAPS[0]!
const move = (from: { x: number; y: number }, to: { x: number; y: number }, fromHeight: number, toHeight: number, allowance = 6, action: 'MOVE' | 'DASH' | 'FALL_BACK' | 'CHARGE' = 'MOVE') =>
  evaluateElevationMove({ map, from, to, fromHeight, toHeight, radius: .45, allowance, action })

describe('沃库斯上下高台', () => {
  it('要塞上层攀爬按实际 3″ 加水平增量计费', () => {
    expect(move({ x: 18.5, y: 4 }, { x: 20, y: 4 }, 0, 3)).toMatchObject({ ok: true, cost: 5 })
    expect(move({ x: 18.5, y: 4 }, { x: 20, y: 4 }, 0, 3, 4)).toMatchObject({ ok: false, cost: 5 })
  })

  it('冲刺不能攀爬，跳落前 2″ 免费', () => {
    expect(move({ x: 18.5, y: 4 }, { x: 20, y: 4 }, 0, 3, 6, 'DASH').reason).toContain('冲刺不能攀爬')
    expect(move({ x: 20, y: 4 }, { x: 18.5, y: 4 }, 3, 0, 3, 'DASH')).toMatchObject({ ok: true, cost: 3 })
  })

  it('移动穿过可通行门额外计 1″', () => {
    expect(move({ x: 18.5, y: 5.5 }, { x: 20, y: 5.5 }, 0, 3)).toMatchObject({ ok: true, cost: 6 })
  })

  it('大型废墟 3.5″ 攀爬向上取整为 4″', () => {
    expect(move({ x: 7.5, y: 7 }, { x: 6.4, y: 7 }, 0, 3.5)).toMatchObject({ ok: true, cost: 6 })
    expect(move({ x: 7.5, y: 7 }, { x: 6.4, y: 7 }, 0, 3.5, 5).ok).toBe(false)
  })

  it('不得在没有高台的地方升高，也不得从平台内部原地穿越天花板下降', () => {
    expect(move({ x: 12, y: 10 }, { x: 13, y: 10 }, 0, 3).ok).toBe(false)
    expect(move({ x: 20, y: 5.5 }, { x: 20, y: 5.5 }, 3, 0).ok).toBe(false)
  })

  it('不同高度的底座不在控制范围内，射程按三维距离计算', () => {
    const a = { operativeId: 'a', pos: { x: 5, y: 5 }, baseRadius: .5, height: 3 }
    const b = { operativeId: 'b', pos: { x: 5, y: 5 }, baseRadius: .5, height: 0 }
    expect(engagementFinding(a, b, true).finalValue).toBe(false)
    expect(rangeFinding(a, b, 2).finalValue).toBe(false)
    expect(rangeFinding(a, b, 3).finalValue).toBe(true)
  })

  it('制高点由实际棋子高度决定，旧楼层覆写不再生效；行动回退恢复高度', () => {
    useMatchStore.getState().reset()
    const turn = turnReducer(turnReducer(createInitialTurnState(), { type: 'START_BATTLE' }), { type: 'ACTIVATE', opId: 'a', player: 'a' })
    useMatchStore.setState({ phase: 'play', turn, heightMode: 'elevation', tokens: [
      { uid: 'a', side: 'a', factionId: 'plague_marines', opId: 'champion', name: 'A', pos: { x: 20, y: 5.5 }, height: 0, facing: 0, baseRadius: .45, wounds: 15, maxWounds: 15, markers: [], alive: true, placed: true, order: 'ENGAGE', weapons: [] },
      { uid: 'b', side: 'b', factionId: 'plague_marines', opId: 'champion', name: 'B', pos: { x: 17, y: 5.5 }, height: 0, facing: 0, baseRadius: .45, wounds: 15, maxWounds: 15, markers: [], alive: true, placed: true, order: 'ENGAGE', weapons: [] },
    ] })
    useMatchStore.getState().setOverride('a>b>VANTAGE', true)
    useMatchStore.getState().setOverride('a>b>ATTACKER_FLOOR', 2)
    expect(vantageBonus('a', 'b')).toBe(0)
    expect(useMatchStore.getState().doAction('a', 'MOVE').ok).toBe(true)
    useMatchStore.getState().moveToken('a', { x: 20, y: 5.5 }, 3)
    expect(vantageBonus('a', 'b')).toBe(1)
    useMatchStore.getState().undoAction()
    expect(useMatchStore.getState().tokens.find(t => t.uid === 'a')?.height).toBe(0)
    expect(vantageBonus('a', 'b')).toBe(0)
  })
})
