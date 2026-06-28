import { describe, it, expect } from 'vitest'
import { runShooting } from '../../src/engine'
import { buildShootingLog, rollbackTo, stepBack, stepForward, replay, LogStore } from '../../src/engine/log'
import { ManualDiceSource } from '../../src/dice'
import type { Weapon } from '../../src/rules'

const weapon: Weapon = {
  weaponId: 'w', name: 't', kind: 'RANGED',
  profile: { attacks: 4, hit: 3, normalDamage: 3, criticalDamage: 4, weaponRules: [] }, keywords: [],
}

describe('ResolutionLog 回滚/回放', () => {
  function mkLog() {
    const dice = new ManualDiceSource()
    dice.provide([4, 5, 2, 6, 2, 3, 1])
    const input = { attacker: { operativeId: 'a', weapon }, defender: { operativeId: 'd', save: 4, wounds: 5 }, effects: [], dice, hasCover: false }
    const result = runShooting(input)
    return buildShootingLog('r1', input, result)
  }

  it('build：10 records，cursor 指向末尾', () => {
    const log = mkLog()
    expect(log.records).toHaveLength(10)
    expect(log.cursor).toBe(10)
  })

  it('stepBack/stepForward 移动 cursor', () => {
    let log = mkLog()
    log = stepBack(log)
    expect(log.cursor).toBe(9)
    log = stepForward(log)
    expect(log.cursor).toBe(10)
  })

  it('rollbackTo 截断记录', () => {
    let log = mkLog()
    log = rollbackTo(log, 3) // 保留 index 0..3 → 4 条，cursor=4（已执行数）
    expect(log.records).toHaveLength(4)
    expect(log.cursor).toBe(4)
  })

  it('replay 返回 cursor 及之前', () => {
    let log = mkLog()
    log = rollbackTo(log, 2)
    const r = replay(log)
    expect(r).toHaveLength(3) // index 0,1,2
  })
})

describe('LogStore 会话存储', () => {
  it('add/find/clear', () => {
    const store = new LogStore()
    const dice = new ManualDiceSource()
    dice.provide([4, 5, 2, 6, 2, 3, 1])
    const input = { attacker: { operativeId: 'a', weapon }, defender: { operativeId: 'd', save: 4, wounds: 5 }, effects: [], dice, hasCover: false }
    const log = buildShootingLog('r1', input, runShooting(input))
    store.add(log)
    expect(store.find('r1')).toBeDefined()
    expect(store.all()).toHaveLength(1)
    store.clear()
    expect(store.all()).toHaveLength(0)
  })
})
