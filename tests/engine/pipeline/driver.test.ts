import { describe, it, expect } from 'vitest'
import { ManualDiceSource } from '../../../src/dice'
import type { Weapon } from '../../../src/rules'
import { SHOOTING_PIPELINE, createShootingResolution, runShooting } from '../../../src/engine'
import type { ResolutionContext, ShootingState } from '../../../src/engine'

const weapon: Weapon = {
  weaponId: 'w',
  name: 'test-gun',
  kind: 'RANGED',
  profile: { attacks: 4, hit: 3, normalDamage: 3, criticalDamage: 4, weaponRules: [] },
  keywords: [],
}

function mkCtx(diceSeq: number[]): ResolutionContext {
  const dice = new ManualDiceSource()
  dice.provide(diceSeq)
  return {
    attacker: { operativeId: 'a', weapon },
    defender: { operativeId: 'd', save: 4, wounds: 5 },
    effects: [],
    dice,
    hasCover: false,
    pipelineId: 'shooting',
    attempt: 1,
  }
}

describe('SHOOTING_PIPELINE 注册表（AC1 顺序）', () => {
  it('10 步按架构 §3.1 顺序', () => {
    expect(SHOOTING_PIPELINE.map((s) => s.stepId)).toEqual([
      'WEAPON_SELECT',
      'TARGET_VALIDATE',
      'HIT_ROLL',
      'ATTACK_UPGRADE',
      'DEFENCE_ROLL',
      'DEFENCE_UPGRADE',
      'PARRY_ALLOCATE',
      'DAMAGE_PER_DIE',
      'DAMAGE_TOTAL_MITIGATE',
      'WOUNDS_APPLY_AND_AFTER',
    ])
  })
})

describe('createShootingResolution 游标驱动（AC5）', () => {
  it('advance 逐步推进，cursor 自增', () => {
    const r = createShootingResolution(mkCtx([4, 5, 2, 6, 2, 3, 1]))
    expect(r.cursor).toBe(0)
    expect(r.done).toBe(false)
    const first = r.advance()
    expect(first?.stepId).toBe('WEAPON_SELECT')
    expect(r.cursor).toBe(1)
    expect(r.records).toHaveLength(1)
  })

  it('run 跑完 10 步，done=true', () => {
    const r = createShootingResolution(mkCtx([4, 5, 2, 6, 2, 3, 1]))
    r.run()
    expect(r.cursor).toBe(10)
    expect(r.done).toBe(true)
    expect(r.records).toHaveLength(10)
    expect(r.advance()).toBeNull() // 到末尾
  })

  it('pause 停止 advance', () => {
    const r = createShootingResolution(mkCtx([4, 5, 2, 6, 2, 3, 1]))
    r.advance() // WEAPON_SELECT
    r.pause()
    expect(r.advance()).toBeNull() // 暂停中
    expect(r.cursor).toBe(1)
  })

  it('current 返回最后执行的记录', () => {
    const r = createShootingResolution(mkCtx([4, 5, 2, 6, 2, 3, 1]))
    r.advance()
    expect(r.current()?.stepId).toBe('WEAPON_SELECT')
  })

  it('rollbackTo 截断记录 + 从快照恢复 state', () => {
    const r = createShootingResolution(mkCtx([4, 5, 2, 6, 2, 3, 1]))
    r.run() // 跑完，normalSuccess 应非 0
    const fullNormal = r.state.normalSuccess
    expect(fullNormal).toBeGreaterThan(0)
    // 回滚到 HIT_ROLL（index 2）之后：保留 0..2，cursor=3
    r.rollbackTo(2)
    expect(r.records).toHaveLength(3)
    expect(r.cursor).toBe(3)
    expect(r.records[2]?.stepId).toBe('HIT_ROLL')
    // state 已从 HIT_ROLL 的 output 快照恢复（atkN/atkC 仍是初值 0，未被后续 PARRY 写入）
    expect(r.state.atkN).toBe(0)
    expect(r.state.atkC).toBe(0)
    expect(r.state.normalSuccess).toBe(fullNormal) // HIT_ROLL 快照保留了命中数
    expect(r.done).toBe(false)
  })

  it('rollbackTo 后 advance 可从该步继续', () => {
    const r = createShootingResolution(mkCtx([4, 5, 2, 6, 2, 3, 1, 2, 3, 1]))
    r.advance() // WEAPON_SELECT
    r.advance() // TARGET_VALIDATE
    r.advance() // HIT_ROLL（消费 4 骰）
    r.rollbackTo(1) // 回到 TARGET_VALIDATE 之后
    expect(r.cursor).toBe(2)
    const hit = r.advance() // 重新跑 HIT_ROLL（消费后续 4 骰）
    expect(hit?.stepId).toBe('HIT_ROLL')
    expect(r.cursor).toBe(3)
  })
})

describe('StepRecord 快照（AC4/P21）', () => {
  it('每步 output 快照捕获完成后的 state', () => {
    const r = createShootingResolution(mkCtx([4, 5, 2, 6, 2, 3, 1]))
    r.run()
    const hitRecord = r.records[2]!
    const snap = hitRecord.output as ShootingState
    expect(snap.hitThreshold).toBe(3)
    expect(snap.normalSuccess + snap.criticalSuccess).toBeGreaterThan(0)
    const woundRecord = r.records[9]!
    const wsnap = woundRecord.output as ShootingState
    expect(wsnap.woundsDealt).toBeGreaterThan(0)
    expect(wsnap.defenderIncapacitated).toBe(true)
  })
})

describe('step 独立可单测（AC7）', () => {
  it('HIT_ROLL step 注入 mock ctx 独立跑', () => {
    const hitStep = SHOOTING_PIPELINE[2]!
    const init: ShootingState = {
      hitThreshold: 3,
      attackDice: [],
      normalSuccess: 0,
      criticalSuccess: 0,
      defDice: [],
      defNormal: 0,
      defCritical: 0,
      atkN: 0,
      atkC: 0,
      damage: 0,
      woundsDealt: 0,
      defenderIncapacitated: false,
      targetValid: true,
    }
    const res = hitStep.run(init, mkCtx([4, 5, 2, 6]))
    expect(res.state.normalSuccess).toBe(2)
    expect(res.state.criticalSuccess).toBe(1)
    expect(res.dice).toHaveLength(4)
  })
})

describe('门面 runShooting 与驱动器数值一致', () => {
  it('runShooting 的 woundsDealt == 驱动器终态', () => {
    const diceSeq = [4, 5, 2, 6, 2, 3, 1]
    const facade = runShooting({
      attacker: { operativeId: 'a', weapon },
      defender: { operativeId: 'd', save: 4, wounds: 5 },
      effects: [],
      dice: (() => {
        const d = new ManualDiceSource()
        d.provide(diceSeq)
        return d
      })(),
      hasCover: false,
    })
    const driver = createShootingResolution(mkCtx(diceSeq))
    driver.run()
    expect(driver.state.woundsDealt).toBe(facade.woundsDealt)
    expect(driver.state.defenderIncapacitated).toBe(facade.defenderIncapacitated)
  })
})
