import { useMatchStore } from '../../state/matchStore'

export function StatusStrip({ prompt, isError, onConfirm, onQueryRule, onEndTP }: { prompt?: string, isError?: boolean, onConfirm?: () => void, onQueryRule?: (hint: string) => void, onEndTP?: () => void }) {
  const turn = useMatchStore((s) => s.turn)
  const vp = useMatchStore((s) => s.vp)
  const selected = useMatchStore((s) => s.selected)
  const effectiveAplOf = useMatchStore((s) => s.effectiveAplOf)
  const effectiveMoveOf = useMatchStore((s) => s.effectiveMoveOf)
  const log = useMatchStore((s) => s.currentLog)
  const diceSource = useMatchStore((s) => s.diceSource)
  const setDiceSource = useMatchStore((s) => s.setDiceSource)
  
  const active = turn.activePlayer
  const selApl = selected ? effectiveAplOf(selected) : null
  const selMove = selected ? effectiveMoveOf(selected) : null

  // 最新一条管线步骤
  const latestStep = log && log.records.length > 0 ? log.records[Math.min(log.cursor, log.records.length - 1)] : null

  return (
    <div className={`status-strip ${active}`}>
      <div className="ss-group">
        <span className="ss-item">转折点 <strong className="ds-stat">{turn.turningPoint}/4</strong></span>
        <span className="ss-item">阶段 <strong>{turn.phase}</strong></span>
        <span className={`ss-item active-player ${active}`}>主动 <strong>{active.toUpperCase()}</strong></span>
        {selApl !== null && <span className="ss-item">APL <strong className="ds-stat">{selApl}</strong></span>}
        {selMove !== null && <span className="ss-item">移动 <strong className="ds-stat">{selMove}"</strong></span>}
        <span className="ss-item vp">VP <strong className="ds-stat">A:{vp.a} B:{vp.b}</strong></span>
      </div>

      <div className={`ss-prompt ${isError ? 'is-error' : ''}`} title={prompt || '提示：等待操作'}>
        {log && latestStep && !isError ? (
           <><strong>流水线: </strong>{latestStep.summary}</>
        ) : (
           <span className={prompt && !isError ? '' : isError ? 'error-text' : 'muted'}>{prompt || '提示：等待操作'}</span>
        )}
      </div>

      <div className="ss-group">
        {onEndTP && (
          <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={onEndTP} title="结束转折点">
            结束转折点
          </button>
        )}
        <button
          className={`ds-btn ds-btn--sm ds-btn--secondary dice-toggle ${diceSource}`}
          onClick={() => setDiceSource(diceSource === 'electronic' ? 'manual' : 'electronic')}
        >
          {diceSource === 'electronic' ? '电子骰 ⇄' : '物理骰 ⇄'}
        </button>
        {onConfirm && (
          <button className="ds-btn ds-btn--sm" disabled={!log} onClick={onConfirm}>
            确认伤亡 ▶
          </button>
        )}
      </div>
    </div>
  )
}
