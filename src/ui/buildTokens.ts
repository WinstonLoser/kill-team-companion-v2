import { packOfOp, packOfFaction, type MatchToken } from '../state/matchStore'
import { useRosterStore } from '../state/rosterStore'

/**
 * 由双方建队结果构造对局 token。
 *
 * 原先 MatchView 与 SimpleMatchView 各有一份近乎逐字相同的实现，唯一差别是
 * 初始 pos/placed：有图对局要走部署阶段（placed=false），简化对局直接开打
 * （placed=true）。这里合并为一个 `placed` 参数。
 *
 * B 方未选人时沿用 A 方名单（保持既有行为）。
 *
 * @param placed true = 已就位（简化对局，跳过部署）；false = 待部署
 * @param defaultIds A 方未选人时的兜底名单（简化对局不传 = 空阵容）
 */
export function buildTokens({
  placed,
  defaultIds = [],
}: {
  placed: boolean
  defaultIds?: string[]
}): MatchToken[] {
  const rosterA = useRosterStore.getState().rosterA
  const rosterB = useRosterStore.getState().rosterB

  const idsA = rosterA.operativeIds.length ? rosterA.operativeIds : defaultIds
  const idsB = rosterB.operativeIds.length ? rosterB.operativeIds : idsA

  const pos = placed ? { x: 0, y: 0 } : { x: -1, y: -1 }

  const out: MatchToken[] = []

  for (const side of ['a', 'b'] as const) {
    const roster = side === 'a' ? rosterA : rosterB
    const ids = side === 'a' ? idsA : idsB
    const opCounts = new Map<string, number>()

    ids.forEach((opId, i) => {
      const packForOp = roster.factionId ? packOfFaction(roster.factionId) : packOfOp(opId)
      const op = packForOp.operatives.find((o) => o.operativeId === opId) ?? packForOp.operatives[0]!
      const baseRadius = op.base.diameterMm / 2 / 25.4
      const count = opCounts.get(opId) ?? 0
      opCounts.set(opId, count + 1)
      // 同名特工按出场序编号，与 rosterStore 的 loadout key 约定一致
      const weapons = roster.loadout[`${opId}#${count}`] || (op.loadouts[0]?.options[0] ?? [])

      out.push({
        uid: `${side}${i + 1}`,
        side,
        factionId: packForOp.faction.id,
        opId,
        name: `${op.name}-${side.toUpperCase()}${i + 1}`,
        pos: { ...pos },
        facing: 0,
        baseRadius,
        wounds: op.stats.wounds,
        maxWounds: op.stats.wounds,
        markers: [],
        alive: true,
        placed,
        order: 'CONCEAL',
        weapons,
      })
    })
  }

  return out
}
