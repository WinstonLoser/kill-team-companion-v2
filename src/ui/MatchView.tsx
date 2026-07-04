import { useState } from 'react'
import { loadPack, type FactionPack } from '../'
import { useMatchStore, type MatchToken } from '../state/matchStore'
import { useRosterStore } from '../state/rosterStore'
import type { Point, TerrainFeature } from '../geometry'
import { loadMapPack, type MapPack, type ObjectiveMarker } from '../data/maps'
import { MapSelect } from './match/MapSelect'
import { TerrainEditor } from './match/TerrainEditor'
import { DeployPhase } from './match/DeployPhase'
import { PlayView } from './match/PlayView'
import { StrategyPhase } from './match/StrategyPhase'
import { ResultPage } from './match/ResultPage'
import { RulesQuery, useRulesQuery } from './match/RulesQuery'
import openMap from '../data/packs/maps/open.v1.json'
import ruinMap from '../data/packs/maps/ruin.v1.json'
import corridorMap from '../data/packs/maps/corridor.v1.json'
import angelsPack from '../data/packs/angels_of_death.v1.json'

const pack: FactionPack = loadPack(angelsPack)
const MAPS: MapPack[] = [openMap, ruinMap, corridorMap].map((m) => loadMapPack(m))

const DEFAULT_IDS = [pack.operatives[0]!.operativeId, (pack.operatives[1] ?? pack.operatives[0]!).operativeId]

function buildTokens(): MatchToken[] {
  const picked = useRosterStore.getState().rosterA.operativeIds
  const ids = picked.length ? picked : DEFAULT_IDS
  const out: MatchToken[] = []
  ids.forEach((opId, i) => {
    const op = pack.operatives.find((o) => o.operativeId === opId) ?? pack.operatives[0]!
    const baseRadius = op.base.diameterMm / 2 / 25.4 // mm→英寸半径（D-27）
    ;(['a', 'b'] as const).forEach((side) => {
      out.push({
        uid: `${side}${i + 1}`,
        side,
        opId,
        name: `${op.name}-${side.toUpperCase()}${i + 1}`,
        pos: { x: -1, y: -1 },
        facing: 0,
        baseRadius,
        wounds: op.stats.wounds,
        maxWounds: op.stats.wounds,
        markers: [],
        alive: true,
        placed: false,
      })
    })
  })
  return out
}

export function MatchView() {
  const phase = useMatchStore((s) => s.phase)
  const mapPack = useMatchStore((s) => s.mapPack)
  const loadMap = useMatchStore((s) => s.loadMap)
  const startBlank = useMatchStore((s) => s.startBlank)
  const commitBlankMap = useMatchStore((s) => s.commitBlankMap)
  const initTokens = useMatchStore((s) => s.initTokens)

  const [blankBounds] = useState({ w: 30, h: 20 })
  const [blankEditing, setBlankEditing] = useState(false)
  const rulesQuery = useRulesQuery()

  function onLoadMap(m: MapPack) {
    loadMap(m)
    initTokens(buildTokens())
  }
  function onBlank() {
    startBlank(blankBounds)
    setBlankEditing(true)
  }
  function onTerrainDone(draft: { terrain: TerrainFeature[]; objectives: ObjectiveMarker[]; dropA: Point[]; dropB: Point[] }) {
    setBlankEditing(false)
    commitBlankMap(draft)
    initTokens(buildTokens())
  }
  function beginPlay() {
    useMatchStore.getState().enterStrategy()
  }

  if (phase === 'ended') {
    return (
      <>
        <ResultPage onQueryRule={() => rulesQuery.open('胜负')} />
        {rulesQuery.node && <RulesQuery ctrl={rulesQuery} />}
      </>
    )
  }
  if (blankEditing && mapPack) {
    return (
      <TerrainEditor
        bounds={mapPack.bounds}
        initialTerrain={mapPack.terrain}
        initialObjectives={mapPack.objectives}
        initialDropA={mapPack.dropZones.a}
        initialDropB={mapPack.dropZones.b}
        onCommit={onTerrainDone}
      />
    )
  }
  if (phase === 'map-select') {
    return <MapSelect maps={MAPS} onLoad={onLoadMap} onBlank={onBlank} />
  }
  if (phase === 'deploy') {
    return <DeployPhase onBeginPlay={beginPlay} />
  }
  if (phase === 'strategy') {
    return <StrategyPhase />
  }
  // play
  return (
    <>
      <PlayView onQueryRule={(hint) => rulesQuery.open(hint)} />
      {rulesQuery.node && <RulesQuery ctrl={rulesQuery} />}
    </>
  )
}
