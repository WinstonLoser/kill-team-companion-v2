import { beforeEach, describe, expect, it } from 'vitest'
import { getMatchOperativeData, useMatchStore, type MatchToken } from '../../src/state/matchStore'
import { createInitialTurnState, turnReducer } from '../../src/state/turnStateMachine'
import type { TerrainFeature } from '../../src/geometry'
import { VOLKUS_MAPS } from '../../src/data/packs/maps/volkus'

const state = () => useMatchStore.getState()
const rect = (id: string, kind: TerrainFeature['kind'], x1: number, y1: number, x2: number, y2: number): TerrainFeature => ({
  id, kind, polygon: [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }],
})
function token(uid: string, side: 'a' | 'b', x: number, y: number, order: MatchToken['order'] = 'ENGAGE'): MatchToken {
  return { uid, side, factionId: 'plague_marines', opId: 'champion', name: uid,
    pos: { x, y }, facing: 0, baseRadius: .5, wounds: 15, maxWounds: 15,
    markers: [], alive: true, placed: true, order, weapons: ['bolt_pistol', 'plague_sword'],
    chosenWeapons: { RANGED: 'bolt_pistol', MELEE: 'plague_sword' },
  }
}
function battle(tokens: MatchToken[], terrain: TerrainFeature[] = []) {
  state().reset()
  const turn = turnReducer(turnReducer(createInitialTurnState(), { type: 'START_BATTLE' }), { type: 'ACTIVATE', opId: 'a1', player: 'a' })
  useMatchStore.setState({ phase: 'play', maplessMode: false, mapPack: {
    mapId: 'scenario', name: '场景棋盘', version: '1', bounds: { w: 30, h: 22 }, terrain,
    objectives: [], dropZones: { a: [], b: [] },
  }, turn: { ...turn, phase: 'ENGAGEMENT' }, tokens })
}
beforeEach(() => state().reset())

describe('交替行动：基础场景', () => {
  it('只能给当前激活特工切换命令，已行动后命令锁定', () => {
    battle([token('a1', 'a', 2, 2), token('a2', 'a', 3, 3), token('b1', 'b', 9, 2)])
    state().selectOrder('a2', 'CONCEALED')
    expect(state().tokens.find(t => t.uid === 'a2')?.order).toBe('ENGAGE')
    state().selectOrder('a1', 'CONCEALED')
    expect(state().tokens.find(t => t.uid === 'a1')?.order).toBe('CONCEAL')
    expect(state().checkAction('a1', 'SHOOT').ok).toBe(false)
    state().selectOrder('a1', 'ENGAGED')
    expect(state().doAction('a1', 'MOVE').ok).toBe(true)
    state().selectOrder('a1', 'CONCEALED')
    expect(state().tokens.find(t => t.uid === 'a1')?.order).toBe('ENGAGE')
  })

  it('墙体隔开控制范围时不能普通近战，墙外仍可行动', () => {
    battle([token('a1', 'a', 4.5, 5), token('b1', 'b', 5.8, 5)], [rect('wall', 'BLOCKING', 5, 4, 5.3, 6)])
    expect(state().checkAction('a1', 'FIGHT').ok).toBe(false)
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'MELEE' }).ok).toBe(false)
    expect(state().checkAction('a1', 'MOVE').ok).toBe(true)
  })

  it('隐匿目标有掩护时，预检和实际结算都拒绝射击', () => {
    battle([token('a1', 'a', 2, 5), token('b1', 'b', 8, 5, 'CONCEAL')], [rect('cover', 'COVER', 7, 4, 7.3, 6)])
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    expect(state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [6, 6, 6, 6], defNats: [1, 1, 1] }).ok).toBe(false)
    expect(state().lastShot).toBeNull()
  })

  it('目标身后的地形不算进攻方向的掩护', () => {
    battle([token('a1', 'a', 2, 5), token('b1', 'b', 8, 5, 'CONCEAL')], [rect('behind', 'COVER', 8.4, 4, 8.7, 6)])
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(true)
  })

  it('不能以己方、残废或未部署单位为攻击目标', () => {
    const a1 = token('a1', 'a', 2, 2)
    const a2 = token('a2', 'a', 6, 2)
    const b1 = { ...token('b1', 'b', 7, 2), alive: false }
    const b2 = { ...token('b2', 'b', 8, 2), placed: false }
    battle([a1, a2, b1, b2])
    for (const targetUid of ['a1', 'a2', 'b1', 'b2']) {
      expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid, kind: 'SHOOT' }).ok).toBe(false)
    }
  })

  it('伤害在确认前只预览，确认后扣血；取消则恢复本次行动', () => {
    battle([token('a1', 'a', 2, 5), token('b1', 'b', 8, 5)])
    expect(state().doAction('a1', 'SHOOT').ok).toBe(true)
    expect(state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [6, 6, 6, 6], defNats: [1, 1, 1] }).ok).toBe(true)
    expect(state().tokens.find(t => t.uid === 'b1')?.wounds).toBe(15)
    const damage = state().lastShot!.woundsDealt
    expect(damage).toBeGreaterThan(0)
    state().undoPending()
    expect(state().turn.operatives.a1?.actionsThisActivation).not.toContain('SHOOT')
    expect(state().tokens.find(t => t.uid === 'b1')?.wounds).toBe(15)
    state().doAction('a1', 'SHOOT')
    state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [6, 6, 6, 6], defNats: [1, 1, 1] })
    state().confirmCasualties()
    expect(state().tokens.find(t => t.uid === 'b1')?.wounds).toBe(Math.max(0, 15 - damage))
  })
})

describe('交替行动：战略与个性化场景', () => {
  it('战略计谋扣 CP、限本转折点一次；未编码的效果不凭空改变伤害', () => {
    battle([token('a1', 'a', 2, 5), token('b1', 'b', 8, 5)])
    useMatchStore.setState(s => ({ phase: 'strategy', initiative: 'a', strategyTurn: 'a', turn: { ...s.turn, cp: { a: 3, b: 3 } } }))
    expect(state().usePloy('a', 'cloud_of_flies').ok).toBe(true)
    expect(state().turn.cp.a).toBe(2)
    expect(state().usePloy('a', 'cloud_of_flies').ok).toBe(false)
    expect(state().activeStratagems.a).toEqual([])
    expect(state().strategyTurn).toBe('b')
  })

  it('个性化机动战术只降低该特工后撤 AP；负伤修正只作用于该实例', () => {
    const a1 = { ...token('a1', 'a', 2, 5), factionId: 'angels_of_death', opId: 'intercessor_sergeant', selections: ['chapterTactic_mobile'], weapons: ['bolt_rifle', 'fists'] }
    const a2 = { ...a1, uid: 'a2', selections: [], pos: { x: 3, y: 5 } }
    battle([a1, a2, token('b1', 'b', 8, 5)])
    expect(state().actionCostOf('a1', 'FALL_BACK')).toBe(1)
    expect(state().actionCostOf('a2', 'FALL_BACK')).toBe(2)
    const before = getMatchOperativeData('a1')!
    state().applyDamage('a1', 9)
    const after = getMatchOperativeData('a1')!
    expect(after.operative.stats.move).toBe(before.operative.stats.move - 2)
    expect(getMatchOperativeData('a2')!.operative.stats.move).toBe(before.operative.stats.move)
  })
})

describe('交替行动：高低差场景', () => {
  it('只有启用高低差才按墙体高度越墙射击；预检、地图提示和结算一致', () => {
    const lowWall = { ...rect('low-wall', 'BLOCKING', 5, 4, 5.3, 6), bottom: 0, top: 2 }
    battle([{ ...token('a1', 'a', 2, 5), height: 3 }, token('b1', 'b', 8, 5)], [lowWall])
    expect(state().heightMode).toBe('uniform')
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    expect(state().attackViz('a1').targets.find(t => t.uid === 'b1')?.losFinal).toBe(false)
    expect(state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [6, 6, 6, 6], defNats: [1, 1, 1] }).ok).toBe(false)
    useMatchStore.setState({ heightMode: 'elevation' })
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(true)
    expect(state().attackViz('a1').targets.find(t => t.uid === 'b1')?.losFinal).toBe(true)
    expect(state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [6, 6, 6, 6], defNats: [1, 1, 1] }).ok).toBe(true)
  })

  it('关闭高低差时，即使棋子残留高台高度也使用平面掩护', () => {
    const lowCover = { ...rect('low-cover', 'COVER', 7, 4, 7.3, 6), bottom: 0, top: 0.75 }
    battle([{ ...token('a1', 'a', 2, 5), height: 3 }, { ...token('b1', 'b', 8, 5, 'CONCEAL'), height: 3 }], [lowCover])
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    useMatchStore.setState({ heightMode: 'elevation' })
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(true)
  })

  it('高点可射击低两英寸的轻掩护隐匿目标，但重掩护仍保护隐匿', () => {
    battle([token('a1', 'a', 2, 5), token('b1', 'b', 8, 5, 'CONCEAL')], [rect('light', 'COVER', 7, 4, 7.3, 6)])
    useMatchStore.setState({ heightMode: 'elevation' })
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    useMatchStore.setState(s => ({ tokens: s.tokens.map(t => t.uid === 'a1' ? { ...t, height: 3 } : t) }))
    state().setOverride('a1>b1>COVER_TYPE', 'LIGHT')
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(true)
    state().setOverride('a1>b1>COVER_TYPE', 'HEAVY')
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
  })

  it('高点射击交战目标有精准奖励；统一高度不触发', () => {
    battle([token('a1', 'a', 2, 5), token('b1', 'b', 8, 5)])
    state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [1, 1, 1, 1], defNats: [1, 1, 1] })
    expect(state().lastShot?.woundsDealt).toBe(0)
    state().undoPending()
    useMatchStore.setState({ heightMode: 'elevation' })
    useMatchStore.setState(s => ({ tokens: s.tokens.map(t => t.uid === 'a1' ? { ...t, height: 3 } : t) }))
    state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [1, 1, 1], defNats: [1, 1, 1] })
    expect(state().lastShot?.woundsDealt).toBeGreaterThan(0)
  })

  it('高点射击轻掩护隐匿目标时，自动结算保留两个普通豁免', () => {
    const terrain = [rect('light', 'COVER', 7, 4, 7.3, 6)]
    battle([token('a1', 'a', 2, 5), token('b1', 'b', 8, 5)], terrain)
    state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [4, 4, 1, 1], defNats: [1, 1] })
    const normalCoverDamage = state().lastShot!.woundsDealt
    state().undoPending()
    useMatchStore.setState({ heightMode: 'elevation', tokens: [{ ...token('a1', 'a', 2, 5), height: 3 }, token('b1', 'b', 8, 5, 'CONCEAL')] })
    state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [4, 4, 1, 1], defNats: [1] })
    expect(state().lastShot!.woundsDealt).toBeLessThan(normalCoverDamage)
  })
})

describe('交替行动：沃库斯门场景', () => {
  const door = { ...rect('door', 'COVER', 5, 4, 5.3, 6), isDoor: true, accessible: true, terrainClass: 'HEAVY' as const }

  it('门阻挡普通射击；隔门 1 英寸控制范围仍可正常近战', () => {
    battle([token('a1', 'a', 4.5, 5), token('b1', 'b', 5.8, 5)], [door])
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'MELEE' }).ok).toBe(true)
    expect(state().checkAction('a1', 'FIGHT').ok).toBe(true)
  })

  it('超过普通控制范围时不得用普通近战冒充隔门近战', () => {
    battle([token('a1', 'a', 4.5, 5), token('b1', 'b', 6.8, 5)], [door])
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'MELEE' }).ok).toBe(false)
    expect(state().checkAction('a1', 'FIGHT').ok).toBe(false)
  })

  it.todo('门另一侧 2 英寸内的 Door Fight 独立行动、AP 和近战分配')
})

describe('沃库斯地图：可见、掩护与遮蔽', () => {
  const volkus = VOLKUS_MAPS[0]!
  const onMap = (tokens: MatchToken[]) => {
    battle(tokens, volkus.terrain)
    useMatchStore.setState({ mapPack: volkus })
  }

  it('D 废墟墙和门挡住射击视线，空旷通道可射击', () => {
    onMap([token('a1', 'a', 5, 7.5), token('b1', 'b', 8, 7.5)])
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    expect(state().attackViz('a1').targets[0]?.losFinal).toBe(false)
    useMatchStore.setState(s => ({ tokens: s.tokens.map(t => t.uid === 'a1' ? { ...t, pos: { x: 5, y: 5 } } : t.uid === 'b1' ? { ...t, pos: { x: 8, y: 5 } } : t) }))
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    useMatchStore.setState(s => ({ tokens: s.tokens.map(t => t.uid === 'a1' ? { ...t, pos: { x: 8, y: 8 } } : t.uid === 'b1' ? { ...t, pos: { x: 11, y: 8 } } : t) }))
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(true)
    expect(state().attackViz('a1').targets[0]?.shootable).toBe(true)
  })

  it('废墟墙角部分遮挡底座时仍可见，但目标获得重型掩护', () => {
    onMap([token('a1', 'a', 5, 9.5), token('b1', 'b', 8, 8.8, 'CONCEAL')])
    const target = state().attackViz('a1').targets[0]
    expect(target?.losFinal).toBe(true)
    expect(target?.cover).toBe(true)
    expect(target?.shootable).toBe(false)
  })

  it('I 轻型碎石给掩护：交战目标可射击，隐匿目标不可射击', () => {
    onMap([token('a1', 'a', 5, 11), token('b1', 'b', 12.5, 11)])
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(true)
    expect(state().attackViz('a1').targets[0]).toMatchObject({ cover: true, shootable: true })
    state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [4, 4, 1, 1], defNats: [1, 1] })
    const coverDamage = state().lastShot?.woundsDealt ?? 0
    state().undoPending()
    useMatchStore.setState({ mapPack: { ...volkus, terrain: volkus.terrain.filter(t => t.id !== 'I-light') } })
    state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [4, 4, 1, 1], defNats: [1, 1, 1] })
    expect(coverDamage).toBeLessThan(state().lastShot?.woundsDealt ?? 0)
    state().undoPending()
    useMatchStore.setState({ mapPack: volkus })
    useMatchStore.setState(s => ({ tokens: s.tokens.map(t => t.uid === 'b1' ? { ...t, order: 'CONCEAL' } : t) }))
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    expect(state().attackViz('a1').targets[0]).toMatchObject({ cover: true, shootable: false })
  })

  it('掩护与近距离例外按底座边缘量距，而非圆心', () => {
    onMap([token('a1', 'a', 5, 11), token('b1', 'b', 13.3, 11, 'CONCEAL')])
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    useMatchStore.setState(s => ({ tokens: s.tokens.map(t => t.uid === 'a1' ? { ...t, pos: { x: 9.5, y: 11 } } : t.uid === 'b1' ? { ...t, pos: { x: 12.5, y: 11 } } : t) }))
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(true)
  })

  it('G 重型碎石遮蔽目标：仍可射击，但丢弃一枚成功且关键命中降为普通', () => {
    onMap([token('a1', 'a', 11, 13.5), token('b1', 'b', 19, 13.5)])
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(true)
    expect(state().attackViz('a1').targets.find(t => t.uid === 'b1')).toMatchObject({ obscured: true, shootable: true })
    state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [6, 6, 6, 6], defNats: [1, 1, 1] })
    const obscuredDamage = state().lastShot?.woundsDealt ?? 0
    state().undoPending()
    useMatchStore.setState({ mapPack: { ...volkus, terrain: volkus.terrain.filter(t => t.id !== 'G-heavy') } })
    state().resolveAttack({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT', atkNats: [6, 6, 6, 6], defNats: [1, 1, 1] })
    expect(obscuredDamage).toBeGreaterThan(0)
    expect(obscuredDamage).toBeLessThan(state().lastShot?.woundsDealt ?? 0)
  })

  it('H 重型碎石保护隐匿目标，高点也不能直接将其作为目标', () => {
    onMap([token('a1', 'a', 15, 11.5), token('b1', 'b', 22.5, 11.5, 'CONCEAL')])
    useMatchStore.setState({ heightMode: 'elevation' })
    useMatchStore.setState(s => ({ tokens: s.tokens.map(t => t.uid === 'a1' ? { ...t, height: 3 } : t) }))
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    expect(state().attackViz('a1').targets.find(t => t.uid === 'b1')?.shootable).toBe(false)
  })

  it('目标与己方另一特工处于控制范围时，禁止从远处射击该目标', () => {
    onMap([token('a1', 'a', 5, 11), token('a2', 'a', 14.2, 11), token('b1', 'b', 12.5, 11)])
    expect(state().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(false)
    expect(state().attackViz('a1').targets.find(t => t.uid === 'b1')?.shootable).toBe(false)
  })
})
