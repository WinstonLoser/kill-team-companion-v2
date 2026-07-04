import { useState } from 'react'
import { useMatchStore, type Side } from '../../state/matchStore'

// 6.1 战略阶段屏幕：先手 D6 → CP 发放 → 战略计谋轮流使用 → 进入交战
export function StrategyPhase() {
  const turn = useMatchStore((s) => s.turn)
  const initiative = useMatchStore((s) => s.initiative)
  const strategyTurn = useMatchStore((s) => s.strategyTurn)
  const strategyPasses = useMatchStore((s) => s.strategyPasses)
  const rollInitiative = useMatchStore((s) => s.rollInitiative)
  const strategyAct = useMatchStore((s) => s.strategyAct)
  const activeStratagems = useMatchStore((s) => s.activeStratagems)
  const [rollResult, setRollResult] = useState<{ a: number; b: number; winner: string } | null>(null)

  function doRoll() {
    const r = rollInitiative()
    setRollResult(r)
  }

  const phase = !initiative ? 'roll' : 'ploy'

  return (
    <div className="strategy-phase">
      <h2>战略阶段 · 转折点 {turn.turningPoint}/4</h2>

      {phase === 'roll' && (
        <div className="sp-card">
          <p className="muted">掷 D6 决定先手权（高者先；平局 A 方选）</p>
          <button className="primary main-btn" onClick={doRoll}>掷 D6 ▶</button>
          {rollResult && (
            <div className="sp-result">
              <span className={`sp-dice ${rollResult.winner === 'a' ? 'win' : ''}`}>A: {rollResult.a}</span>
              <span className="muted">vs</span>
              <span className={`sp-dice ${rollResult.winner === 'b' ? 'win' : ''}`}>B: {rollResult.b}</span>
              <p><strong>{rollResult.winner.toUpperCase()} 方</strong>拥有先手权</p>
              <p className="muted">CP — A:{turn.cp.a} B:{turn.cp.b}</p>
            </div>
          )}
        </div>
      )}

      {phase === 'ploy' && (
        <div className="sp-ploy">
          <div className="sp-status">
            <span>先手：<strong>{initiative?.toUpperCase()}</strong></span>
            <span>CP — A:{turn.cp.a} B:{turn.cp.b}</span>
            <span>轮到：<strong className={strategyTurn ?? ''}>{strategyTurn?.toUpperCase()}</strong></span>
          </div>

          <div className="sp-sides">
            {(['a', 'b'] as Side[]).map((side) => {
              const cp = turn.cp[side]
              const isTurn = strategyTurn === side
              const passed = strategyPasses[side]
              const active = activeStratagems[side]
              return (
                <div key={side} className={`sp-side ${side} ${isTurn ? 'active' : ''}`}>
                  <h4>{side.toUpperCase()} 方{isTurn ? ' · 你的回合' : passed ? ' · 已跳过' : ''}</h4>
                  <p className="muted">CP {cp}{active.length ? ` · ${active.length} 计谋激活` : ''}</p>
                  {isTurn && (
                    <div className="sp-actions">
                      <button
                        className="primary"
                        disabled={cp < 1}
                        onClick={() => {
                          // 激活一个计谋 → 花 CP → 切对方
                          // 简化：列出战略计谋，点一个激活+花CP
                          strategyAct(side, 'ploy')
                        }}
                        title={cp < 1 ? 'CP 不足' : '使用战略计谋（1CP）'}
                      >
                        使用计谋（1CP）
                      </button>
                      <button onClick={() => strategyAct(side, 'pass')}>跳过</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
