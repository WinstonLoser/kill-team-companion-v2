/**
 * 有地图的完整对局流程（地图选择 → 地形编辑 → 部署 → 对局）。
 *
 * 当前**未挂路由**：应用已收敛为「建队 → 对局」两屏，入口只保留 BattleView。
 * 文件保留在此以便日后恢复地图玩法，不是死代码。
 */
import { useState } from 'react'
import { loadPack, type FactionPack } from '../'
import { useMatchStore } from '../state/matchStore'
import { buildTokens } from './buildTokens'
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
    initTokens(buildTokens({ placed: false, defaultIds: DEFAULT_IDS }))
  }
  function onBlank() {
    startBlank(blankBounds)
    setBlankEditing(true)
  }
  function onTerrainDone(draft: { terrain: TerrainFeature[]; objectives: ObjectiveMarker[]; dropA: Point[]; dropB: Point[] }) {
    setBlankEditing(false)
    commitBlankMap(draft)
    initTokens(buildTokens({ placed: false, defaultIds: DEFAULT_IDS }))
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
