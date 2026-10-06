import {beforeEach,describe,it,expect} from 'vitest'
import {useMatchStore, type MatchToken} from '../../src/state/matchStore'
import {ALL_PACKS} from '../../src/data/packs'
const s=()=>useMatchStore.getState()
beforeEach(()=>{
 s().reset()
 const pack=ALL_PACKS.find(p=>p.faction.id==='plague_marines')!
 const op=pack.operatives.find(o=>o.operativeId==='champion')!
 const t:MatchToken={uid:'a1',side:'a',factionId:'plague_marines',opId:op.operativeId,name:'勇士',pos:{x:2,y:2},facing:0,baseRadius:.6,wounds:15,maxWounds:15,markers:[],alive:true,placed:true,order:'ENGAGE',weapons:['plague_sword']}
 useMatchStore.setState({mapPack:{mapId:'test',name:'test',version:'1',bounds:{w:30,h:22},terrain:[],objectives:[],dropZones:{a:[],b:[]}},maplessMode:true,tokens:[t,{...t,uid:'b1',side:'b',wounds:60,maxWounds:60}]})
})
function attack(){expect(s().resolveAttack({attackerUid:'a1',targetUid:'b1',kind:'MELEE',atkNats:[3,3,3,3,3],defNats:[1,1,1,1,1]}).ok).toBe(true)}
describe('毒素与剧毒按武器和来源生效',()=>{
 it('造成伤害后在确认阶段挂己方毒素，取消不挂',()=>{
  attack();expect(s().tokens[1]!.markers).toEqual([])
  s().undoPending();expect(s().tokens[1]!.markers).toEqual([])
  attack();s().confirmCasualties();expect(s().tokens[1]!.markers).toContain('POISON:a')
 })
 it('剧毒只对已有己方毒素的目标提升每枚成功伤害',()=>{
  attack();const base=s().lastShot!.woundsDealt;s().undoPending()
  useMatchStore.setState(x=>({tokens:x.tokens.map(t=>t.uid==='b1'?{...t,markers:['POISON:b']}:t)}))
  attack();expect(s().lastShot!.woundsDealt).toBe(base);s().undoPending()
  useMatchStore.setState(x=>({tokens:x.tokens.map(t=>t.uid==='b1'?{...t,markers:['POISON:a']}:t)}))
  attack();expect(s().lastShot!.woundsDealt).toBe(base+5)
 })
 it('全失败不授予毒素',()=>{
  s().resolveAttack({attackerUid:'a1',targetUid:'b1',kind:'MELEE',atkNats:[1,1,1,1,1],defNats:[1,1,1,1,1]})
  s().confirmCasualties();expect(s().tokens[1]!.markers).toEqual([])
 })
})
