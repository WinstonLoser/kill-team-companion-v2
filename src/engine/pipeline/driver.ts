// 流水线驱动器（架构 §7.1/§7.2，DN1 游标 + 快照回滚；DN3 泛化供近战复用）。
// 游标在 step 数组上移动：advance 执行下一 step append；pause 停；
// rollbackTo 丢弃其后并从该步 output 快照恢复 state。

import type { StepTrace } from '../context'
import type { ResolutionContext, ShootingState, StepFn, StepResult } from './types'
import { createInitialShootingState, SHOOTING_PIPELINE } from './shooting'

/** 通用解析游标（DN3：射击/近战共用）。 */
export interface Resolution<S> {
  /** 执行下一 step 并 append；已到末尾或暂停时返回 null */
  advance(): StepTrace | null
  /** 暂停在当前 cursor（advance 不再推进直到再次调用或重置 paused） */
  pause(): void
  /** 0-based：保留 0..i，丢弃其后；cursor=i+1；state 从第 i 步 output 快照恢复 */
  rollbackTo(i: number): void
  /** 当前 cursor 处的记录（已执行的最后一步） */
  current(): StepTrace | null
  /** 跑完剩余 step（直到末尾或暂停），返回本次新增的记录 */
  run(): StepTrace[]
  readonly records: readonly StepTrace[]
  readonly cursor: number
  readonly state: S
  readonly done: boolean
}

function toRecord<S>(step: StepFn<S, unknown>, res: StepResult<S>): StepTrace {
  return {
    stepId: step.stepId,
    summary: res.summary,
    dice: res.dice,
    appliedEffectIds: res.applied,
    rejectedEffectIds: res.rejected,
    inputs: res.snapshot?.inputs,
    output: res.snapshot?.output,
    rulings: res.rulings,
  }
}

/**
 * 通用解析工厂（DN3）：可逐步 advance / 暂停 / 回滚，或一次 run 到底。
 * 射击用 SHOOTING_PIPELINE；近战用 MELEE_PIPELINE（pipeline/melee.ts）。
 */
export function createResolution<S, C>(
  ctx: C,
  pipeline: StepFn<S, C>[],
  initState: () => S,
): Resolution<S> {
  let state = initState()
  const records: StepTrace[] = []
  let cursor = 0
  let paused = false

  const advance = (): StepTrace | null => {
    if (cursor >= pipeline.length || paused) return null
    const step = pipeline[cursor]!
    const res = step.run(state, ctx)
    // 快照：output 捕获本步完成后的 state（steps 不可变更新 → 引用安全，回滚可直接还原）
    const rec = toRecord(step as StepFn<S, unknown>, { ...res, snapshot: { output: res.state } })
    state = res.state
    records.push(rec)
    cursor++
    return rec
  }

  const run = (): StepTrace[] => {
    const added: StepTrace[] = []
    let r: StepTrace | null
    while ((r = advance()) !== null) added.push(r)
    return added
  }

  const rollbackTo = (i: number): void => {
    const idx = Math.max(0, Math.min(i, records.length - 1))
    if (records.length === 0) return
    records.length = idx + 1 // 保留 0..idx
    cursor = idx + 1
    const snap = records[idx]!.output as S | undefined
    if (snap) state = { ...snap }
    paused = false
  }

  return {
    advance,
    pause: () => {
      paused = true
    },
    rollbackTo,
    current: () => (cursor > 0 ? records[cursor - 1]! : null),
    run,
    get records() {
      return records
    },
    get cursor() {
      return cursor
    },
    get state() {
      return state
    },
    get done() {
      return cursor >= pipeline.length
    },
  }
}

/** 射击解析游标（DN1，向后兼容别名）。 */
export type ShootingResolution = Resolution<ShootingState>

/** 创建射击解析：可逐步 advance / 暂停 / 回滚，或一次 run 到底。 */
export function createShootingResolution(ctx: ResolutionContext): ShootingResolution {
  return createResolution(ctx, SHOOTING_PIPELINE, () =>
    createInitialShootingState(ctx.attacker.weapon.profile),
  )
}
