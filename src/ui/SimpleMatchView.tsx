import { buildMatchTokens, canStartMatch } from '../state/setup'
import { useEffect, useState } from 'react'
import { useMatchStore } from '../state/matchStore'
import { PlayView } from './match/PlayView'
import { StrategyPhase } from './match/StrategyPhase'
import { RulesQuery, useRulesQuery } from './match/RulesQuery'
import { ResultPage } from './match/ResultPage'

export function SimpleMatchView() {
  const phase = useMatchStore((s) => s.phase)
  const initTokens = useMatchStore((s) => s.initTokens)
  const setMaplessMode = useMatchStore((s) => s.setMaplessMode)
  const enterStrategy = useMatchStore((s) => s.enterStrategy)
  const rulesQuery = useRulesQuery()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized && canStartMatch()) {
      if (useMatchStore.getState().phase !== 'map-select') { setInitialized(true); return }
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
      
      const tokens = buildMatchTokens(true)
      initTokens(tokens)
      setMaplessMode(true)
      enterStrategy()
      setInitialized(true)
    }
  }, [initialized, initTokens, setMaplessMode, enterStrategy])

  if (!initialized) return <div className="empty-state"><h2>先完成双方建队</h2><p>实体棋盘模式保留回合、行动和掷骰，由你们裁定距离与可见性。</p></div>

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
