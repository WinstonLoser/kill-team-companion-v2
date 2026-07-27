import { useEffect, useState } from 'react'
import { useMatchStore, type MatchState } from '../state/matchStore'
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
  // 显式标注：zustand 的类型在本项目里没解析上，不写就是 implicit any
  const initiative = useMatchStore((s: MatchState) => s.initiative)
  const turn = useMatchStore((s: MatchState) => s.turn)
  const rulesQuery = useRulesQuery()

  // 战略阶段改成盖在棋盘上的浮层（原来是整屏替换）。收起后棋盘还在，
  // 想回来点状态条上的「战略阶段 ▸」。每进入一个新转折点重新弹出。
  const [strategyHidden, setStrategyHidden] = useState(false)
  useEffect(() => {
    if (phase === 'strategy') setStrategyHidden(false)
  }, [phase, turn.turningPoint])

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

  const inStrategy = phase === 'strategy'

  // 行动条、单位面板等都由 PlayView 承载；战略阶段浮在它上面
  return (
    <>
      <PlayView onQueryRule={(hint) => rulesQuery.open(hint)} />

      {inStrategy && !strategyHidden && (
        <div className="ds-scrim sp-scrim">
          <div className="ds-modal sp-modal">
            <div className="ds-modal-head">
              <div>
                <div className="ds-eyebrow">转折点 {turn.turningPoint}/4</div>
                <h3 className="ds-display ds-display--md">战略阶段</h3>
              </div>
              {/*
                掷完先手骰之前不给关：此时棋盘还没有「轮到谁」，
                放人出去只会看到一个不能操作的空局面。
              */}
              <button
                className="ds-modal-close"
                disabled={!initiative}
                onClick={() => setStrategyHidden(true)}
                title={initiative ? '收起，稍后从状态条继续' : '先掷先手骰'}
                aria-label="收起战略阶段"
              >
                ×
              </button>
            </div>
            <div className="ds-modal-body sp-modal-body">
              <StrategyPhase />
            </div>
          </div>
        </div>
      )}

      {inStrategy && strategyHidden && (
        <button
          className="ds-btn ds-btn--sm sp-reopen"
          onClick={() => setStrategyHidden(false)}
          title="回到战略阶段（选计谋 / 结束本阶段）"
        >
          战略阶段 ▸
        </button>
      )}

      {rulesQuery.node && <RulesQuery ctrl={rulesQuery} />}
    </>
  )
}
