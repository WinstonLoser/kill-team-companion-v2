import { packOfFaction, type MatchToken, type Side } from '../../state/matchStore'

/** Read-only rule reference for the faction equipment selected before the match. */
export function TeamWargearSummary({ side, team }: { side: Side; team: MatchToken[] }) {
  const first = team[0]
  if (!first?.teamWargearIds?.length) return null
  const wargear = (packOfFaction(first.factionId).wargear ?? []).filter(item => first.teamWargearIds?.includes(item.id))
  if (!wargear.length) return null
  return <details className="team-wargear"><summary>{side.toUpperCase()} 方阵营装备 · {wargear.length} 项（玩家裁定）</summary><ul>{wargear.map(item => <li key={item.id}><strong>{item.name.split(' / ').at(-1)}</strong><span>{item.description}</span></li>)}</ul></details>
}
