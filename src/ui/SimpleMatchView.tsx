import { useEffect, useState } from 'react'
import { useMatchStore, packOfOp, packOfFaction, type MatchToken } from '../state/matchStore'
import { useRosterStore } from '../state/rosterStore'
import { PlayView } from './match/PlayView'
import { StrategyPhase } from './match/StrategyPhase'
import { RulesQuery, useRulesQuery } from './match/RulesQuery'
import { ResultPage } from './match/ResultPage'

function buildTokens(): MatchToken[] {
  const rosterA = useRosterStore.getState().rosterA
  const rosterB = useRosterStore.getState().rosterB
  const pickedA = rosterA.operativeIds
  const pickedB = rosterB.operativeIds
  
  const idsA = pickedA.length ? pickedA : []
  const idsB = pickedB.length ? pickedB : idsA

  const out: MatchToken[] = []
  
  const opCountsA = new Map<string, number>()
  idsA.forEach((opId, i) => {
    const packForOp = rosterA.factionId ? packOfFaction(rosterA.factionId) : packOfOp(opId)
    const op = packForOp.operatives.find((o) => o.operativeId === opId) ?? packForOp.operatives[0]!
    const baseRadius = op.base.diameterMm / 2 / 25.4
    const count = opCountsA.get(opId) ?? 0
    opCountsA.set(opId, count + 1)
    const key = `${opId}#${count}`
    const weapons = rosterA.loadout[key] || (op.loadouts[0]?.options[0] ?? [])
    
    out.push({
      uid: `a${i + 1}`, side: 'a', factionId: packForOp.faction.id, opId, name: `${op.name}-A${i + 1}`,
      pos: { x: 0, y: 0 }, facing: 0, baseRadius, wounds: op.stats.wounds, maxWounds: op.stats.wounds,
      markers: [], alive: true, placed: true, order: 'CONCEAL', weapons // placed = true for mapless
    })
  })

  const opCountsB = new Map<string, number>()
  idsB.forEach((opId, i) => {
    const packForOp = rosterB.factionId ? packOfFaction(rosterB.factionId) : packOfOp(opId)
    const op = packForOp.operatives.find((o) => o.operativeId === opId) ?? packForOp.operatives[0]!
    const baseRadius = op.base.diameterMm / 2 / 25.4
    const count = opCountsB.get(opId) ?? 0
    opCountsB.set(opId, count + 1)
    const key = `${opId}#${count}`
    const weapons = rosterB.loadout[key] || (op.loadouts[0]?.options[0] ?? [])
    
    out.push({
      uid: `b${i + 1}`, side: 'b', factionId: packForOp.faction.id, opId, name: `${op.name}-B${i + 1}`,
      pos: { x: 0, y: 0 }, facing: 0, baseRadius, wounds: op.stats.wounds, maxWounds: op.stats.wounds,
      markers: [], alive: true, placed: true, order: 'CONCEAL', weapons // placed = true for mapless
    })
  })

  return out
}

export function SimpleMatchView() {
  const phase = useMatchStore((s) => s.phase)
  const initTokens = useMatchStore((s) => s.initTokens)
  const setMaplessMode = useMatchStore((s) => s.setMaplessMode)
  const enterStrategy = useMatchStore((s) => s.enterStrategy)
  const rulesQuery = useRulesQuery()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized) {
      // Force empty map to prevent null errors in PlayView
      useMatchStore.setState({
        mapPack: {
          mapId: 'mapless',
          name: '简化对局板',
          version: '1.0.0',
          bounds: { w: 10, h: 10 },
          terrain: [],
          objectives: [],
          dropZones: { a: [], b: [] },
        }
      })
      
      const tokens = buildTokens()
      initTokens(tokens)
      setMaplessMode(true)
      enterStrategy()
      setInitialized(true)
    }
  }, [initialized, initTokens, setMaplessMode, enterStrategy])

  if (!initialized) return null

  if (phase === 'ended') {
    return (
      <>
        <ResultPage onQueryRule={() => rulesQuery.open('胜负')} />
        {rulesQuery.node && <RulesQuery ctrl={rulesQuery} />}
      </>
    )
  }

  if (phase === 'strategy') {
    return <StrategyPhase />
  }

  // Use PlayView because it handles action bars and UI properly
  return (
    <>
      <PlayView onQueryRule={(hint) => rulesQuery.open(hint)} />
      {rulesQuery.node && <RulesQuery ctrl={rulesQuery} />}
    </>
  )
}
