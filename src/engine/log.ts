import type { StepTrace, ShootInput, ShootResult } from './context'
import type { MeleeInput, MeleeResult } from './melee'

// 结算日志（受限 event sourcing，FR-16/FR-17，架构 §7）。会话内内存，刷新重置（D-20）。

export interface ResolutionLog {
  resolutionId: string
  pipelineKind: 'SHOOTING' | 'MELEE'
  records: StepTrace[]
  cursor: number // 当前推进到第几步（0..records.length）；回滚=移动 cursor + 截断
  inputSnapshot: ShootInput | MeleeInput // 完整重跑用（电子骰 seed 可复现）
  result: ShootResult | MeleeResult
  rulings?: string[] // 人工裁定 id（咨询式几何/规则缺口）
}

export function buildShootingLog(
  resolutionId: string,
  input: ShootInput,
  result: ShootResult,
): ResolutionLog {
  return {
    resolutionId,
    pipelineKind: 'SHOOTING',
    records: result.traces,
    cursor: result.traces.length,
    inputSnapshot: input,
    result,
  }
}

export function buildMeleeLog(
  resolutionId: string,
  input: MeleeInput,
  result: MeleeResult,
): ResolutionLog {
  return {
    resolutionId,
    pipelineKind: 'MELEE',
    records: result.traces,
    cursor: result.traces.length,
    inputSnapshot: input,
    result,
  }
}

/** 单步回滚（FR-16）：cursor 回退一步。 */
export function stepBack(log: ResolutionLog): ResolutionLog {
  return { ...log, cursor: Math.max(0, log.cursor - 1) }
}

/** 回滚到指定步（index 为 0-based 步序，保留 0..index，丢弃其后）。cursor = 已执行数 = index+1。 */
export function rollbackTo(log: ResolutionLog, index: number): ResolutionLog {
  const i = Math.max(0, Math.min(index, log.records.length - 1))
  return {
    ...log,
    cursor: i + 1,
    records: log.records.slice(0, i + 1), // 保留 0..index（含）
  }
}

/** 前进（重新执行到下一步）。 */
export function stepForward(log: ResolutionLog): ResolutionLog {
  return { ...log, cursor: Math.min(log.records.length, log.cursor + 1) }
}

/** 回放（FR-17）：返回 cursor 及之前的记录，供 UI 逐步重演。 */
export function replay(log: ResolutionLog): StepTrace[] {
  return log.records.slice(0, log.cursor)
}

/** 会话内日志存储（无持久化，D-20）。 */
export class LogStore {
  private logs: ResolutionLog[] = []
  add(log: ResolutionLog): void {
    this.logs.push(log)
  }
  all(): readonly ResolutionLog[] {
    return this.logs
  }
  find(resolutionId: string): ResolutionLog | undefined {
    return this.logs.find((l) => l.resolutionId === resolutionId)
  }
  clear(): void {
    this.logs = []
  }
}
