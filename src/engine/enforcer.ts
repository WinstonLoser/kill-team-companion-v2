import type { AppliedModifier, EnforcerContext } from './statResolver'

/** 被拒 modifier 留痕（FR-17 可审计，1.4 AC5）。 */
export interface RejectionTrace {
  id: string
  source: string
  ruleId: string
  reason: string
}

export interface EnforcerResult {
  kept: AppliedModifier[]
  rejected: RejectionTrace[]
}

/**
 * 集中叠加规则 enforcer（FR-7）。纯函数过滤器，读每条 modifier 的 policy + groupKeys。
 * 12 条叠加规则（架构 §3.3 矩阵）由此集中强制。被拒项以 RejectionTrace 返回（不静默丢弃）。
 */
export function enforcerWithTrace(mods: AppliedModifier[], _ctx: EnforcerContext = {}): EnforcerResult {
  const sorted = [...mods].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const kept: AppliedModifier[] = []
  const rejected: RejectionTrace[] = []
  const seenSource = new Set<string>()
  const seenGroup = new Set<string>()
  const perSourceCount = new Map<string, number>()

  const reject = (m: AppliedModifier, ruleId: string, reason: string) =>
    rejected.push({ id: m.id, source: m.source, ruleId, reason })

  for (const m of sorted) {
    switch (m.policy) {
      case 'STACKABLE':
        kept.push(m)
        break
      case 'UNIQUE_PER_SOURCE':
        if (seenSource.has(m.source)) reject(m, 'R6', `同源唯一：source '${m.source}' 已生效`)
        else {
          seenSource.add(m.source)
          kept.push(m)
        }
        break
      case 'UNIQUE_PER_GROUP':
      case 'MUTUALLY_EXCLUSIVE_WITH': {
        const keys = m.groupKeys?.length ? m.groupKeys : [m.source]
        if (keys.some((k) => seenGroup.has(k))) {
          reject(m, m.policy === 'MUTUALLY_EXCLUSIVE_WITH' ? 'R4/R5/R12' : 'R1', `同组唯一/互斥：${keys.join(',')}`)
        } else {
          keys.forEach((k) => seenGroup.add(k))
          kept.push(m)
        }
        break
      }
      case 'CAP_PER_ATTACK_DIE': {
        const cap = m.cap ?? 1
        const prev = perSourceCount.get(m.source) ?? 0
        if (prev >= cap) reject(m, 'R3', `每源每枚上限 ${cap}：source '${m.source}' 已达上限`)
        else {
          perSourceCount.set(m.source, prev + 1)
          kept.push(m)
        }
        break
      }
      case 'CONDITIONAL':
        // 条件求值在触发层（Story 1.6）；enforcer 透传，由调用方在挂载前判断条件（R2/R7/R11）
        kept.push(m)
        break
      default: {
        // 穷尽保护：union 已穷尽，运行期不应到此（Ajv 守数据）。若到则记为拒绝而非静默通过。
        const _exhaustive: never = m.policy
        void _exhaustive
        reject(m, 'UNKNOWN', `未知 policy '${String(m.policy)}'`)
      }
    }
  }
  return { kept, rejected }
}

/** 便捷：仅返回保留项（向后兼容；需要留痕用 enforcerWithTrace）。 */
export function enforcer(mods: AppliedModifier[], ctx: EnforcerContext = {}): AppliedModifier[] {
  return enforcerWithTrace(mods, ctx).kept
}
