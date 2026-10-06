import { useMatchStore } from '../../state/matchStore'

export function StatusStrip({ prompt, isError, onConfirm, onQueryRule: _onQueryRule, onEndTP }: { prompt?: string, isError?: boolean, onConfirm?: () => void, onQueryRule?: (hint: string) => void, onEndTP?: () => void }) {
  const turn = useMatchStore((s) => s.turn)
  const vp = useMatchStore((s) => s.vp)
  const selected = useMatchStore((s) => s.selected)
  const effectiveAplOf = useMatchStore((s) => s.effectiveAplOf)
  const effectiveMoveOf = useMatchStore((s) => s.effectiveMoveOf)
  const lastShot = useMatchStore(s => s.lastShot)
  const log = useMatchStore((s) => s.currentLog)
  const diceSource = useMatchStore((s) => s.diceSource)
  const setDiceSource = useMatchStore((s) => s.setDiceSource)
  
  const tokens = useMatchStore(s => s.tokens)
  const gate = useMatchStore(s => s.canEndTP)()
  const pass = useMatchStore(s => s.passOpportunity)
  const noReady = !tokens.some(t => t.side === turn.activePlayer && t.alive && t.placed && turn.operatives[t.uid]?.ready !== false)
  const active = turn.activePlayer
  const selApl = selected ? effectiveAplOf(selected) : null
  const selMove = selected ? effectiveMoveOf(selected) : null

  // 最新一条管线步骤
  const latestStep = log && log.records.length > 0 ? log.records[Math.min(log.cursor, log.records.length - 1)] : null

  return (
    <div className={`status-strip ${active}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span className="ss-item">转折点 <strong>{turn.turningPoint}/4</strong></span>
        <span className="ss-item">阶段 <strong>{turn.phase === 'ENGAGEMENT' ? '交战' : turn.phase === 'STRATEGY' ? '战略' : turn.phase}</strong></span>
        <span className={`ss-item active-player ${active}`}>主动 <strong>{active.toUpperCase()}</strong></span>
        {selApl !== null && <span className="ss-item">APL <strong>{selApl}</strong></span>}
        {selMove !== null && <span className="ss-item">移动 <strong>{selMove}"</strong></span>}
        <span className="ss-item vp">VP <strong>A:{vp.a} B:{vp.b}</strong></span>
      </div>

      <div style={{ flex: 1, textAlign: 'center', margin: '0 12px', fontSize: '0.85rem', color: isError ? '#ff4d4f' : '#ffeb3b', fontWeight: isError ? 'bold' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={prompt || '提示：等待操作'}>
        {log && latestStep && !isError ? (
           <><strong>流水线: </strong>{latestStep.summary}</>
        ) : (
           <span className={prompt && !isError ? '' : isError ? 'error-text' : 'muted'}>{prompt || '提示：等待操作'}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {noReady && !turn.activeOpId && !gate.ok && <button onClick={pass}>放弃反应 · 交给对手</button>}
        {onEndTP && (
          <button className="secondary" onClick={onEndTP} style={{ minHeight: '28px', padding: '0 12px', fontSize: '0.8rem' }} disabled={!gate.ok} title={gate.reason ?? "结算得分并进入下一个转折点"}>
            结束转折点
          </button>
        )}
        <button
          className={`dice-toggle ${diceSource}`}
          onClick={() => setDiceSource(diceSource === 'electronic' ? 'manual' : 'electronic')}
          style={{ minHeight: '28px', padding: '0 8px', fontSize: '0.75rem' }}
        >
          {diceSource === 'electronic' ? '电子骰 ⇄' : '物理骰 ⇄'}
        </button>
        {onConfirm && (
          <button className="primary" disabled={!lastShot} onClick={onConfirm} style={{ minHeight: '28px', padding: '0 12px', fontSize: '0.8rem' }}>
            确认伤亡 ▶
          </button>
        )}
      </div>
    </div>
  )
}
