import { beforeEach, describe, expect, it } from 'vitest'
import { useMatchStore, getMatchOperativeData, combatWeapon, type MatchToken } from '../../src/state/matchStore'
import { useRosterStore, emptyRoster } from '../../src/state/rosterStore'
import { buildMatchTokens, canStartMatch } from '../../src/state/setup'
import { ALL_PACKS } from '../../src/data/packs'
import { computeDefaultRoster } from '../../src/ui/roster/OperativePicker'
import { parryAllocation } from '../../src/engine/parry'
import { runShooting } from '../../src/engine'
import { ManualDiceSource } from '../../src/dice'
import type { Weapon } from '../../src/rules'
import { loadMapPack, mapWithDeploymentMode } from '../../src/data/maps'
import openMap from '../../src/data/packs/maps/open.v1.json'
import { VOLKUS_MAPS } from '../../src/data/packs/maps/volkus'

const state = () => useMatchStore.getState()
function teams() {
  for (const [side,id] of [['a','plague_marines'],['b','chaos_cult']] as const) {
    const pack = ALL_PACKS.find(p => p.faction.id === id)!
    useRosterStore.getState().setRoster(side, { ...emptyRoster(), factionId:id, ...computeDefaultRoster(pack) })
  }
}
function begin() {
  teams()
  state().initTokens(buildMatchTokens(true))
  state().setMaplessMode(true)
  state().enterStrategy()
  state().confirmInitiative('a')
  state().strategyAct('a','pass'); state().strategyAct('b','pass')
}
beforeEach(() => {state().reset();useRosterStore.getState().reset()})

describe('Lite 游玩闭环', () => {
  it('回退撤销上一批及其后落子，保留更早批次并可重新部署', () => {
    teams()
    state().loadMap(loadMapPack(openMap))
    state().initTokens(buildMatchTokens())
    const first = state().tokens[0]!
    state().placeToken(first.uid, { x: 2, y: 2 }, 0)
    state().recordDeployPlacement(first.uid)
    state().advanceDeployBatch()
    state().recordDeployPlacement(first.uid)
    const second = state().tokens.find((token) => token.side === 'b')!
    state().placeToken(second.uid, { x: 28, y: 2 }, 45)
    state().recordDeployPlacement(second.uid)
    state().advanceDeployBatch()
    const third = state().tokens.find((token) => token.side === 'a' && token.uid !== first.uid)!
    state().placeToken(third.uid, { x: 2, y: 3 }, 90)
    state().recordDeployPlacement(third.uid)
    expect(state().deployBatchIndex).toBe(2)
    expect(state().deployBatchUids[0]).toEqual([first.uid])
    state().rewindDeployBatch()
    expect(state().deployBatchIndex).toBe(1)
    expect(state().deployBatchUids[0]).toEqual([first.uid])
    expect(state().deployBatchUids[1]).toBeUndefined()
    expect(state().tokens.find((token) => token.uid === first.uid)?.placed).toBe(true)
    for (const uid of [second.uid, third.uid]) {
      const token = state().tokens.find((item) => item.uid === uid)!
      expect(token.placed).toBe(false)
      expect(token.pos).toEqual({ x: -1, y: -1 })
      expect(token.facing).toBe(0)
    }
    state().rewindDeployBatch()
    expect(state().deployBatchIndex).toBe(0)
    expect(state().deployBatchUids).toEqual({})
    expect(state().tokens.find((token) => token.uid === first.uid)?.placed).toBe(false)
    state().resetDeploy()
    expect(state().deployBatchIndex).toBe(0)
    expect(state().deployBatchUids).toEqual({})
  })
  it('部署中更新地图模板时保留小队与落子', () => {
    teams()
    const current = VOLKUS_MAPS[0]!
    state().loadMap({ ...mapWithDeploymentMode(current, 'expanded'), version: '1.1.0' }, 'uniform', 'expanded')
    state().initTokens(buildMatchTokens())
    const first = state().tokens[0]!
    state().placeToken(first.uid, { x: 5, y: 18 }, 0)
    const tokenCount = state().tokens.length
    state().refreshMapTemplate(mapWithDeploymentMode(current, 'expanded'), 'expanded')
    expect(state().mapPack?.version).toBe(current.version)
    expect(state().deploymentMode).toBe('expanded')
    expect(Math.max(...state().mapPack!.dropZones.a.map((point) => point.x))).toBe(10)
    expect(state().tokens).toHaveLength(tokenCount)
    expect(state().tokens[0]?.placed).toBe(true)
    expect(state().tokens[0]?.pos).toEqual({ x: 5, y: 18 })
  })
  it('部署必须先选降落区并放完双方特工，落子后不可改选', () => {
    teams()
    state().loadMap(loadMapPack(openMap), 'elevation')
    expect(state().heightMode).toBe('elevation')
    state().initTokens(buildMatchTokens())
    state().rollDeployInitiative()
    state().enterStrategy()
    expect(state().phase).toBe('deploy')
    state().chooseDeployZone('b')
    state().enterStrategy()
    expect(state().phase).toBe('deploy')
    const first = state().tokens[0]!
    state().placeToken(first.uid, { x: 28, y: 2 }, 0)
    state().chooseDeployZone('a')
    expect(state().deployZoneChoice).toBe('b')
    for (const token of state().tokens.filter((t) => !t.placed)) state().placeToken(token.uid, { x: 28, y: 3 }, 0)
    state().enterStrategy()
    expect(state().phase).toBe('strategy')
  })
  it('双方合法之前不生成棋子；14 人队伍的每个实例都有自己的武器', () => {
    expect(canStartMatch()).toBe(false); expect(buildMatchTokens()).toEqual([])
    teams(); expect(canStartMatch()).toBe(true)
    const tokens = buildMatchTokens(true)
    expect(tokens.filter(t => t.side === 'a')).toHaveLength(6)
    expect(tokens.filter(t => t.side === 'b')).toHaveLength(14)
    expect(new Set(tokens.map(t => t.uid)).size).toBe(20)
    expect(tokens.every(t => t.weapons.length > 0)).toBe(true)
  })
  it('首回合3CP；重复确认先手不再发放CP', () => {
    begin(); expect(state().turn.cp).toEqual({a:3,b:3})
    state().confirmInitiative('b'); expect(state().turn.cp).toEqual({a:3,b:3})
  })
  it('隐匿不能冲锋；转移后可以冲刺；消耗AP后命令锁定', () => {
    begin();state().activate('a1','a')
    expect(state().checkAction('a1','CHARGE').ok).toBe(false)
    state().selectOrder('a1','ENGAGED')
    expect(state().doAction('a1','MOVE').ok).toBe(true)
    expect(state().checkAction('a1','DASH').ok).toBe(true)
    expect(state().checkAction('a1','CHARGE').ok).toBe(false)
    state().selectOrder('a1','CONCEALED');expect(state().turn.operatives.a1?.order).toBe('ENGAGED')
  })
  it('不得提前结束转折点或插入第二个激活', () => {
    begin();expect(state().canEndTP().ok).toBe(false)
    state().scoreAndEndTP();expect(state().turn.turningPoint).toBe(1)
    state().activate('a1','a');state().activate('a2','a')
    expect(state().turn.activeOpId).toBe('a1')
  })
  it('双方人数不同仍可经反应/让过走完四个转折点，终态不能重复计分', () => {
    begin()
    for(let tp=1;tp<=4;tp++) {
      if(tp>1) {state().confirmInitiative('a');state().strategyAct('a','pass');state().strategyAct('b','pass')}
      let turns=0
      while(!state().canEndTP().ok && turns++ < 70) {
        const s=state();const side=s.turn.activePlayer
        const next=s.tokens.find(t=>t.alive && t.side===side && s.turn.operatives[t.uid]?.ready)
        if(next) {s.activate(next.uid,side);state().endActivation(next.uid)}
        else {const react=s.tokens.find(t=>s.canReact(t.uid));if(react){s.react(react.uid);expect(state().effectiveAplOf(react.uid)).toBe(1);state().endActivation(react.uid)}else s.passOpportunity()}
      }
      expect(turns).toBeLessThan(70);expect(state().canEndTP().ok).toBe(true)
      state().scoreAndEndTP()
    }
    expect(state().phase).toBe('ended');const vp={...state().vp}
    state().scoreAndEndTP();expect(state().vp).toEqual(vp)
  })
  it('计谋按卡面扣费，次数限制有效，下个转折点清除持续战略计谋', () => {
    teams();state().initTokens(buildMatchTokens(true));state().enterStrategy();state().confirmInitiative('a')
    const pack=ALL_PACKS.find(p=>p.faction.id==='plague_marines')!
    const p=pack.stratagems!.find(p=>p.phase==='STRATEGY')!
    expect(state().usePloy('a',p.id).ok).toBe(true)
    expect(state().turn.cp.a).toBe(3-p.cp)
    expect(state().usePloy('a',p.id).ok).toBe(false)
    state().strategyAct('b','pass');state().strategyAct('a','pass')
    useMatchStore.setState(s=>({tokens:s.tokens.map(t=>({...t,alive:false})),activeStratagems:{a:['test'],b:[]}}))
    state().scoreAndEndTP();expect(state().activeStratagems.a).toEqual([])
  })
  it('撤销恢复攻击双方伤亡，取消待结算返还AP', () => {
    begin();state().activate('a1','a');state().selectOrder('a1','ENGAGED')
    state().doAction('a1','SHOOT');const original=state().tokens.find(t=>t.uid==='b1')!.wounds
    state().applyDamage('b1',3);state().undoAction()
    expect(state().tokens.find(t=>t.uid==='b1')!.wounds).toBe(original)
    expect(state().turn.operatives.a1?.apUsed).toBe(0)
  })
  it('负伤调整仅影响该实例；武器选择只能来自已装备列表', () => {
    begin();const before=getMatchOperativeData('a1')!
    state().applyDamage('a1',9);const after=getMatchOperativeData('a1')!
    expect(after.operative.stats.move).toBe(before.operative.stats.move-2)
    expect(after.weapons[0]!.profile.hit).toBe(before.weapons[0]!.profile.hit+1)
    expect(getMatchOperativeData('a2')!.operative.stats.move).toBe(5)
    const ranged=after.weapons.filter(w=>w.kind==='RANGED');expect(ranged.length).toBeGreaterThan(1)
    state().setCombatWeapon('a1','RANGED',ranged[1]!.weaponId)
    expect(combatWeapon('a1','RANGED')?.weaponId).toBe(ranged[1]!.weaponId)
    state().setCombatWeapon('a1','RANGED','not-equipped')
    expect(combatWeapon('a1','RANGED')?.weaponId).toBe(ranged[1]!.weaponId)
  })
  it('同队不同模型的印记互不影响', () => {
    const pack=ALL_PACKS.find(p=>p.faction.id==='legionaries')!
    const op=pack.operatives[0]!
    const t:MatchToken={uid:'a1',side:'a',factionId:pack.faction.id,opId:op.operativeId,name:'a',pos:{x:1,y:1},facing:0,baseRadius:.6,wounds:op.stats.wounds,maxWounds:op.stats.wounds,markers:[],alive:true,placed:true,order:'ENGAGE',weapons:op.loadouts.flatMap(s=>s.options[0]??[]),selections:['mark_slaanesh']}
    useMatchStore.setState({tokens:[t,{...t,uid:'a2',selections:['mark_khorne']}]})
    expect(getMatchOperativeData('a1')!.operative.stats.move).toBe(op.stats.move+1)
    expect(getMatchOperativeData('a2')!.operative.stats.move).toBe(op.stats.move)
  })
})
describe('射击防御与近战格挡',()=>{
  it('两枚普通只能在射击中抵挡关键',()=>{
    expect(parryAllocation({normal:2,critical:0},{normal:0,critical:1}).survivor.critical).toBe(0)
    expect(parryAllocation({normal:2,critical:0},{normal:0,critical:1},false).survivor.critical).toBe(1)
  })
  it('掩护保留一枚，实际只掷两枚防御骰',()=>{
    const weapon:Weapon={weaponId:'w',name:'w',kind:'RANGED',keywords:[],profile:{attacks:1,hit:3,normalDamage:3,criticalDamage:4,weaponRules:[]}}
    const dice=new ManualDiceSource();dice.provide([3,1,1])
    const result=runShooting({attacker:{operativeId:'a',weapon},defender:{operativeId:'b',wounds:10,save:3},effects:[],dice,hasCover:true})
    expect(result.traces.find(t=>t.stepId==='DEFENCE_ROLL')!.dice).toHaveLength(2)
    expect(result.woundsDealt).toBe(0)
  })
})
