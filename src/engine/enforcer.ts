import type { AppliedModifier, EnforcerContext } from './statResolver'

/**
 * 集中叠加规则 enforcer（FR-7）。纯函数过滤器，读每条 modifier 的 policy + groupKeys。
 * 12 条叠加规则（架构 §3.3 矩阵）由此集中强制，不散落到各 step。
 *
 * policy → 行为：
 * - STACKABLE                  R10 持徽手 APL 等：全部保留
 * - UNIQUE_PER_SOURCE          R6 战团战术不自我叠加：同 source 只保留一个（最高优先级）
 * - UNIQUE_PER_GROUP           R1 同类成功升级不叠：同 groupKey 只保留一个
 * - MUTUALLY_EXCLUSIVE_WITH    R4/R5/R12 命中-1不与受创叠 / 掩护豁免不与制高点叠：同组互斥保留一个
 * - CAP_PER_ATTACK_DIE         R3 同源减伤每枚上限：每 source 贡献上限 cap（默认 1）
 * - CONDITIONAL                R2/R7/R11 条件触发（偏移肩盾/关键穿刺/毒素时机）：透传，条件求值在触发层（1.6）
 *
 * 多条竞争时按 priority 降序，胜者先入（保证保留的是最高优先级）。
 */
export function enforcer(mods: AppliedModifier[], _ctx: EnforcerContext = {}): AppliedModifier[] {
  const sorted = [...mods].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const result: AppliedModifier[] = []
  const seenSource = new Set<string>()
  const seenGroup = new Set<string>()
  const perSourceCount = new Map<string, number>()

  for (const m of sorted) {
    switch (m.policy) {
      case 'STACKABLE':
        result.push(m)
        break
      case 'UNIQUE_PER_SOURCE':
        if (!seenSource.has(m.source)) {
          seenSource.add(m.source)
          result.push(m)
        }
        break
      case 'UNIQUE_PER_GROUP':
      case 'MUTUALLY_EXCLUSIVE_WITH': {
        // 同 groupKey 唯一/互斥：保留首个（已按优先级排序=最高者）
        const keys = m.groupKeys?.length ? m.groupKeys : [m.source]
        if (keys.every((k) => !seenGroup.has(k))) {
          keys.forEach((k) => seenGroup.add(k))
          result.push(m)
        }
        break
      }
      case 'CAP_PER_ATTACK_DIE': {
        // R3：同源每枚攻击骰减伤上限（默认 1）
        const cap = m.cap ?? 1
        const prev = perSourceCount.get(m.source) ?? 0
        if (prev < cap) {
          perSourceCount.set(m.source, prev + 1)
          result.push(m)
        }
        break
      }
      case 'CONDITIONAL':
        // 条件求值在触发层（Story 1.6）；enforcer 透传，由调用方在挂载前判断条件
        result.push(m)
        break
      default: {
        // 穷尽保护：未知 policy 不静默丢弃，保留（编译期 union 已穷尽，运行期不应到此）
        const _exhaustive: never = m.policy
        void _exhaustive
        result.push(m)
      }
    }
  }
  return result
}
