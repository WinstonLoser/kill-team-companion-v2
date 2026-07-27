import { useEffect } from 'react'
import { useMatchStore } from '../state/matchStore'
import { buildTokens } from './buildTokens'
import { PlayView } from './match/PlayView'
import { StrategyPhase } from './match/StrategyPhase'
import { RulesQuery, useRulesQuery } from './match/RulesQuery'
import { ResultPage } from './match/ResultPage'

/**
 * 对局界面（原 SimpleMatchView）：无地图模式，建队完成后直接进入战略阶段。
 *
 * 初始化守卫读的是 store 的 maplessMode，而不是组件本地 state —— 后者会在
 * 「对局 → 建队 → 对局」来回切换时被重置，从而静默重建 token、清空进行中的对局。
 * maplessMode 只由本视图置位、由 matchStore.reset() 清除（⟳ 重置按钮）。
 */
export function BattleView() {
  const phase = useMatchStore((s) => s.phase)
  const maplessMode = useMatchStore((s) => s.maplessMode)
  const initTokens = useMatchStore((s) => s.initTokens)
  const setMaplessMode = useMatchStore((s) => s.setMaplessMode)
  const enterStrategy = useMatchStore((s) => s.enterStrategy)
  const rulesQuery = useRulesQuery()

  useEffect(() => {
    if (useMatchStore.getState().maplessMode) return

    // PlayView 中若干处仍会读 mapPack，占位一张 10×10 空板避免空引用
    useMatchStore.setState({
      mapPack: {
        mapId: 'mapless',
        name: '简化对局板',
        version: '1.0.0',
        bounds: { w: 10, h: 10 },
        terrain: [],
        objectives: [],
        dropZones: { a: [], b: [] },
      },
    })

    initTokens(buildTokens({ placed: true }))
    setMaplessMode(true)
    enterStrategy()
  }, [initTokens, setMaplessMode, enterStrategy])

  if (!maplessMode) return null

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

  // 行动条、单位面板等都由 PlayView 承载
  return (
    <>
      <PlayView onQueryRule={(hint) => rulesQuery.open(hint)} />
      {rulesQuery.node && <RulesQuery ctrl={rulesQuery} />}
    </>
  )
}
