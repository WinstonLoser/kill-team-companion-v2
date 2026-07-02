// 射击结算流水线门面（FR-4，10 step）。DN1：逻辑下沉到 pipeline/ 注册表 + 游标驱动器；
// 本文件保留 runShooting 门面以维持旧契约（ShootResult 数值不变），并转出注册表/驱动器/类型。

import type { ShootInput, ShootResult } from './context'
import type { ResolutionContext } from './pipeline/types'
import { createShootingResolution } from './pipeline/driver'

export { SHOOTING_PIPELINE } from './pipeline/shooting'
export { createShootingResolution } from './pipeline/driver'
export type { ShootingResolution } from './pipeline/driver'
export type { StepFn, ResolutionContext, ShootingState, StepResult } from './pipeline/types'

/**
 * 射击结算门面：跑完整 10 步，返回 ShootResult（ woundsDealt / remaining / traces ）。
 * 需逐步控制（暂停/前进/回滚）时直接用 createShootingResolution。
 */
export function runShooting(input: ShootInput): ShootResult {
  const ctx: ResolutionContext = {
    attacker: input.attacker,
    defender: input.defender,
    effects: input.effects,
    dice: input.dice,
    hasCover: input.hasCover,
    geometry: input.geometry,
    predicate: input.predicate,
    pipelineId: 'shooting',
    attempt: 1,
  }
  const res = createShootingResolution(ctx)
  res.run()
  const s = res.state
  return {
    woundsDealt: s.woundsDealt,
    defenderIncapacitated: s.defenderIncapacitated,
    remaining: { normalSuccess: s.atkN, criticalSuccess: s.atkC },
    traces: [...res.records],
  }
}
