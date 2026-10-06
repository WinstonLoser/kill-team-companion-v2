import { buildMatchTokens, canStartMatch } from '../state/setup'
import { useState } from 'react'
import { useMatchStore, type HeightMode } from '../state/matchStore'
import type { Point, TerrainFeature } from '../geometry'
import { loadMapPack, mapWithDeploymentMode, type DeploymentMode, type MapPack, type ObjectiveMarker } from '../data/maps'
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
import { VOLKUS_MAPS } from '../data/packs/maps/volkus'

const MAPS: MapPack[] = [...VOLKUS_MAPS, ...[openMap, ruinMap, corridorMap].map((m) => loadMapPack(m))]

export function MatchView() {
  const phase = useMatchStore((s) => s.phase)
  const mapPack = useMatchStore((s) => s.mapPack)
  const loadMap = useMatchStore((s) => s.loadMap)
  const startBlank = useMatchStore((s) => s.startBlank)
  const commitBlankMap = useMatchStore((s) => s.commitBlankMap)
  const initTokens = useMatchStore((s) => s.initTokens)

  const [blankBounds] = useState({ w: 30, h: 22 })
  const [blankEditing, setBlankEditing] = useState(false)
  const rulesQuery = useRulesQuery()

  function onLoadMap(m: MapPack, heightMode: HeightMode, deploymentMode: DeploymentMode) {
    if (!canStartMatch()) return
    loadMap(mapWithDeploymentMode(m, deploymentMode), heightMode, deploymentMode)
    initTokens(buildMatchTokens())
  }
  function onBlank() {
    startBlank(blankBounds)
    setBlankEditing(true)
  }
  function onTerrainDone(draft: { terrain: TerrainFeature[]; objectives: ObjectiveMarker[]; dropA: Point[]; dropB: Point[] }) {
    setBlankEditing(false)
    commitBlankMap(draft)
    initTokens(buildMatchTokens())
  }
  function beginPlay() {
    useMatchStore.getState().enterStrategy()
  }

  if (!canStartMatch() && phase === 'map-select') return <div className="empty-state"><h2>先完成双方建队</h2><p>回到建队，为双方选择合法的小队与阵营配置。</p></div>
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
