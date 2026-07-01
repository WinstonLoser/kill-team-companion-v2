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
 * 12 条叠加规则（架构 §3.3 矩阵）由此集中强制，不散落到各 step。被拒项以 RejectionTrace 返回（不静默丢弃）。
 *
 * policy → 行为：
 * - STACKABLE                  R10：全部保留
 * - UNIQUE_PER_SOURCE          R6：同 source 只保留一个（最高优先级）
 * - UNIQUE_PER_GROUP           R1：同 groupKey 只保留一个
 * - MUTUALLY_EXCLUSIVE_WITH    R4/R5/R12：同组互斥保留一个
 * - CAP_PER_ATTACK_DIE         R3：同源每枚减伤上限（默认 1）
 * - UNIQUE_PER_ACTION          R9：过热每行动一次，同 actionId 只保留一个（无 actionId 退化为每源唯一）
 * - CONDITIONAL                R2/R7/R11：ctx.evalCondition 注入则求值（false→拒）；未注入透传（谓词库 1.6 接入）
 *
 * 多条竞争时按 priority 降序，胜者先入（保证保留的是最高优先级）。
 */
export function enforcerWithTrace(mods: AppliedModifier[], ctx: EnforcerContext = {}): EnforcerResult {
  const sorted = [...mods].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const kept: AppliedModifier[] = []
  const rejected: RejectionTrace[] = []
  const seenSource = new Set<string>()
  const seenGroup = new Set<string>()
  const seenAction = new Set<string>()
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
        // 同 groupKey 唯一/互斥：保留首个（已按优先级排序=最高者）
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
        // R3：同源每枚攻击骰减伤上限（默认 1）
        const cap = m.cap ?? 1
        const prev = perSourceCount.get(m.source) ?? 0
        if (prev >= cap) reject(m, 'R3', `每源每枚上限 ${cap}：source '${m.source}' 已达上限`)
        else {
          perSourceCount.set(m.source, prev + 1)
          kept.push(m)
        }
        break
      }
      case 'UNIQUE_PER_ACTION': {
        // R9：过热每行动一次。按 actionId 去重（无 actionId 退化为按 source 唯一）
        const key = m.actionId ?? m.source
        if (seenAction.has(key)) reject(m, 'R9', `每行动一次：actionId '${key}' 已生效`)
        else {
          seenAction.add(key)
          kept.push(m)
        }
        break
      }
      case 'CONDITIONAL': {
        // R2/R7：条件触发。注入 evalCondition（谓词库 1.6）则求值；否则透传。
        if (m.condition && ctx.evalCondition) {
          if (ctx.evalCondition(m.condition)) kept.push(m)
          else reject(m, 'R2/R7', '条件不满足，未触发')
        } else {
          kept.push(m)
        }
        break
      }
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
