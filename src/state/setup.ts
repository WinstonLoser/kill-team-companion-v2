import { ALL_PACKS } from '../data/packs'
import { evaluateLegality } from '../rules/legality'
import { useRosterStore, type RosterEntry } from './rosterStore'
import type { MatchToken } from './matchStore'

export function rosterLegal(entry: RosterEntry) {
  const pack = ALL_PACKS.find(p => p.faction.id === entry.factionId)
  return pack ? evaluateLegality({ pack, ...entry }) : { legal: false, checks: [] }
}

export function canStartMatch() {
  const { rosterA, rosterB } = useRosterStore.getState()
  return rosterLegal(rosterA).legal && rosterLegal(rosterB).legal
}

export function buildMatchTokens(mapless = false): MatchToken[] {
  if (!canStartMatch()) return []
  const rosters = useRosterStore.getState()
  return (['a', 'b'] as const).flatMap(side => {
    const r = side === 'a' ? rosters.rosterA : rosters.rosterB
    const pack = ALL_PACKS.find(p => p.faction.id === r.factionId)!
    const counts = new Map<string, number>()
    return r.operativeIds.map((opId, index) => {
      const op = pack.operatives.find(o => o.operativeId === opId)!
      const instance = counts.get(opId) ?? 0
      counts.set(opId, instance + 1)
      const key = `${opId}#${instance}`
      return {
        uid: `${side}${index + 1}`, side, factionId: pack.faction.id, opId,
        name: `${op.name.split(' / ').pop()} · ${side.toUpperCase()}${index + 1}`,
        pos: { x: -1, y: -1 }, facing: 0, baseRadius: op.base.diameterMm / 50.8,
        wounds: op.stats.wounds, maxWounds: op.stats.wounds, markers: [],
        alive: true, placed: mapless, order: 'CONCEAL' as const,
        weapons: [...(r.loadout[key] ?? [])],
        selections: [...r.subFactionSelection, ...(r.perOperativeMarks[key] ? [r.perOperativeMarks[key]!] : [])],
        wargear: [...(r.wargearAssignment[key] ?? [])],
      }
    })
  })
}
