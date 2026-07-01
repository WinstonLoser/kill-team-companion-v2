import { describe, it, expect } from 'vitest'
import { ManualDiceSource } from '../../../src/dice'
import { runMelee, MELEE_PIPELINE, createMeleeResolution, type MeleeInput } from '../../../src/engine'
import type { Weapon } from '../../../src/rules'

const meleeWeapon = (over: Partial<Weapon['profile']> = {}): Weapon => ({
  weaponId: 'mw',
  name: 'chainsword',
  kind: 'MELEE',
  profile: { attacks: 2, hit: 3, normalDamage: 3, criticalDamage: 4, weaponRules: [], ...over },
  keywords: [],
})

function mkInput(diceSeq: number[], over: Partial<MeleeInput> = {}): MeleeInput {
  const dice = new ManualDiceSource()
  dice.provide(diceSeq)
  return {
    attacker: { operativeId: 'a', weapon: meleeWeapon(), save: 4, wounds: 5 },
    defender: { operativeId: 'd', weapon: meleeWeapon({ attacks: 1 }), save: 4, wounds: 5 },
    effects: [],
    dice,
    ...over,
  }
}

describe('MELEE_PIPELINE 注册表 + 游标（DN3）', () => {
  it('7 步顺序', () => {
    expect(MELEE_PIPELINE.map((s) => s.stepId)).toEqual([
      'MELEE_TARGET_SELECT',
      'MELEE_WEAPON_SELECT',
      'MELEE_SIMULTANEOUS_ROLL',
      'MELEE_ALTERNATING_RESOLVE',
      'MELEE_PARRY_RULES',
      'MELEE_DAMAGE_AND_MITIGATE',
      'MELEE_AFTER',
    ])
  })

  it('advance 逐步推进，run 跑完 7 步 done=true', () => {
    const r = createMeleeResolution({
      ...mkInput([4, 6, 4]),
      pipelineId: 'melee',
      attempt: 1,
    } as unknown as MeleeInput & { pipelineId: string; attempt: number })
    expect(r.cursor).toBe(0)
    r.advance()
    expect(r.cursor).toBe(1)
    r.run()
    expect(r.cursor).toBe(7)
    expect(r.done).toBe(true)
    expect(r.records).toHaveLength(7)
  })

  it('rollbackTo 截断 + 从快照恢复 state', () => {
    const ctx = {
      ...mkInput([4, 6, 4]),
      pipelineId: 'melee',
      attempt: 1,
    } as unknown as MeleeInput & { pipelineId: string; attempt: number }
    const r = createMeleeResolution(ctx)
    r.run() // 跑完
    const fullStrike = r.state.attackerStrike.normal + r.state.attackerStrike.critical
    expect(fullStrike).toBeGreaterThan(0)
    r.rollbackTo(2) // 回到 MELEE_SIMULTANEOUS_ROLL 之后
    expect(r.records).toHaveLength(3)
    expect(r.cursor).toBe(3)
    // 交替格挡未跑 → 出击池仍为初值 0
    expect(r.state.attackerStrike.normal + r.state.attackerStrike.critical).toBe(0)
    expect(r.done).toBe(false)
  })
})

describe('DN3 真交替格挡 — 修 P3 对称双重计数', () => {
  it('攻方 {1普通+1关键} vs 防方 {1普通}：关键用于格挡→仅普通出击=3 伤（非对称模型的 4）', () => {
    // 旧对称模型双重计数：攻方关键既格挡防方又出击→4 伤。
    // 交替模型：回合1 攻方关键抵防方普通（消耗），回合2 防方无骰；攻方仅剩普通出击→3 伤。
    const r = runMelee(mkInput([4, 6, 4]))
    expect(r.woundsToDefender).toBe(3) // 1 普通 × 3
    expect(r.woundsToAttacker).toBe(0)
  })

  it('子决策日志：交替格挡每次取消留痕（攻方·/防方· 前缀）', () => {
    const ctx = {
      ...mkInput([4, 6, 4]),
      pipelineId: 'melee',
      attempt: 1,
    } as unknown as MeleeInput & { pipelineId: string; attempt: number }
    const r = createMeleeResolution(ctx)
    r.run()
    expect(r.state.parryLog.length).toBeGreaterThan(0)
    expect(r.state.parryLog.some((l) => l.startsWith('攻方·'))).toBe(true)
  })

  it('双方互格挡全抵消 → 0 伤（交替模型仍正确）', () => {
    // 攻方 [4,6]→1N+1C；防方 [4,6]→1N+1C（防方 attacks=2）
    const r = runMelee(mkInput([4, 6, 4, 6], { defender: { operativeId: 'd', weapon: meleeWeapon({ attacks: 2 }), save: 4, wounds: 5 } }))
    expect(r.woundsToDefender).toBe(0)
    expect(r.woundsToAttacker).toBe(0)
  })
})
