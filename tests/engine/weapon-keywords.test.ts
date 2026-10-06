import { describe,it,expect } from 'vitest'
import { successPool } from '../../src/engine/weaponKeywords'
import { ManualDiceSource } from '../../src/dice'
import { runShooting } from '../../src/engine'
import type { Weapon } from '../../src/rules'
const weapon=(rules:string[]):Weapon=>({weaponId:'test',name:'test',kind:'RANGED',keywords:[],profile:{attacks:2,hit:3,normalDamage:3,criticalDamage:4,weaponRules:rules}})
const rolls=(nats:number[])=>nats.map(nat=>({nat:nat as 1|2|3|4|5|6,grade:'NORMAL' as const}))
describe('当前数据包武器关键词',()=>{
 it('致命5+将5保留为关键；自然1失败',()=>expect(successPool(rolls([1,3,5]),3,['Lethal 5+'])).toEqual({normal:1,critical:1}))
 it('严重只在没有关键时升级一枚',()=>{expect(successPool(rolls([3,4]),3,['Severe'])).toEqual({normal:1,critical:1});expect(successPool(rolls([3,6]),3,['Severe'])).toEqual({normal:1,critical:1})})
 it('撕裂需要至少一枚关键',()=>{expect(successPool(rolls([3,4]),3,['Rending'])).toEqual({normal:2,critical:0});expect(successPool(rolls([3,6]),3,['Rending'])).toEqual({normal:0,critical:2})})
 it('穿刺1只掷两枚防御骰',()=>{
   const dice=new ManualDiceSource();dice.provide([3,3,1,1])
   const r=runShooting({attacker:{operativeId:'a',weapon:weapon(['Piercing 1'])},defender:{operativeId:'b',wounds:10,save:3},effects:[],hasCover:false,dice})
   expect(r.traces.find(t=>t.stepId==='DEFENCE_ROLL')!.dice).toHaveLength(2);expect(r.woundsDealt).toBe(6)
 })
 it('集中取消掩护保留；防御依然最多三骰',()=>{
   const dice=new ManualDiceSource();dice.provide([3,3,1,1,1])
   const r=runShooting({attacker:{operativeId:'a',weapon:weapon(['Saturate'])},defender:{operativeId:'b',wounds:10,save:3},effects:[],hasCover:true,dice})
   expect(r.traces.find(t=>t.stepId==='DEFENCE_ROLL')!.dice).toHaveLength(3);expect(r.woundsDealt).toBe(6)
 })
 it('交互界面确认的骰子分级不被自然点再次覆盖',()=>{
   expect(successPool([{nat:2,grade:'CRITICAL'},{nat:6,grade:'FAIL'}],3,[],true)).toEqual({normal:0,critical:1})
 })
})
