import { useState } from 'react'
import { useMatchStore, packOfOp, packOfFaction, type Side } from '../../state/matchStore'
import { loadPack, type FactionPack, type Stratagem } from '../..'
import { useRosterStore } from '../../state/rosterStore'
import { DiceIcon } from '../components/Dice/DiceIcon'
// 6.1 战略阶段屏幕：先手 D6（投骰按钮）→ 双方计谋同屏（剩余 CP）→ 进入交战
export function StrategyPhase() {
  const turn = useMatchStore((s) => s.turn)
  const tokens = useMatchStore((s) => s.tokens)
  const initiative = useMatchStore((s) => s.initiative)
  const strategyTurn = useMatchStore((s) => s.strategyTurn)
  const strategyPasses = useMatchStore((s) => s.strategyPasses)
  const rollInitiative = useMatchStore((s) => s.rollInitiative)
  const strategyAct = useMatchStore((s) => s.strategyAct)
  const strategyUndo = useMatchStore((s) => s.strategyUndo)
  const lastPloy = useMatchStore((s) => s.lastPloy)
  const activeStratagems = useMatchStore((s) => s.activeStratagems)
  const toggleStratagem = useMatchStore((s) => s.toggleStratagem)
  const confirmInitiative = useMatchStore((s) => s.confirmInitiative)
  const [rollResult, setRollResult] = useState<{ a: number; b: number; winner: string } | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [tempDice, setTempDice] = useState<{ a: number; b: number }>({ a: 6, b: 6 })

  function doRoll() {
    setIsRolling(true)
    setRollResult(null)
    
    let ticks = 0
    const interval = setInterval(() => {
      setTempDice({
        a: Math.floor(Math.random() * 6) + 1,
        b: Math.floor(Math.random() * 6) + 1,
      })
      ticks++
      if (ticks > 15) {
        clearInterval(interval)
        setIsRolling(false)
        const result = rollInitiative()
        setRollResult(result)
        setTempDice({ a: result.a, b: result.b })
      }
    }, 50)
  }

  function handleConfirm(side: 'a' | 'b') {
    confirmInitiative(side)
  }

  // 使用战略计谋：标记激活 + 花 1CP + 切对方
  function useStrat(side: Side, strat: Stratagem, pack: FactionPack) {
    const eids = pack.effects.filter((e) => e.source === 'stratagem:' + strat.id).map((e) => e.effectId)
    eids.forEach((eid) => {
      if (!activeStratagems[side].includes(eid)) toggleStratagem(side, eid)
    })
    strategyAct(side, 'ploy')
  }

  const phase = !initiative ? 'roll' : 'ploy'

  return (
    <div className="strategy-phase">
      <h2>战略阶段 · 转折点 {turn.turningPoint}/4</h2>

      {phase === 'roll' && (
        <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <p className="muted">掷 D6 决定先手权（高者胜，胜者决定谁先手）</p>
          
          <div style={{ display: 'flex', gap: '48px', margin: '24px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 'bold', color: '#ff5c5c' }}>A 方</span>
              <DiceIcon 
                dice={{ nat: tempDice.a, grade: 'NORMAL' }} 
                theme={{ baseColor: '#ff5c5c', pipColor: '#111' }} 
                isRolling={isRolling} 
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 'bold', color: '#39d98a' }}>B 方</span>
              <DiceIcon 
                dice={{ nat: tempDice.b, grade: 'NORMAL' }} 
                theme={{ baseColor: '#39d98a', pipColor: '#111' }} 
                isRolling={isRolling} 
              />
            </div>
          </div>

          {!isRolling && !rollResult && (
            <button className="primary main-btn dice-btn" onClick={doRoll} style={{ padding: '12px 32px', fontSize: '1.2rem' }}>
              🎲 掷骰
            </button>
          )}

          {rollResult && !isRolling && (
            <div className="sp-result" style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', width: '100%' }}>
              <h3 style={{ margin: '0 0 16px 0', color: rollResult.winner === 'a' ? '#ff5c5c' : '#39d98a' }}>
                {rollResult.winner.toUpperCase()} 方赢得了掷骰！
              </h3>
              <p style={{ marginBottom: '16px' }}>请 {rollResult.winner.toUpperCase()} 方选择本转折点谁先行动：</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                <button className="primary" onClick={() => handleConfirm('a')} style={{ background: '#ff5c5c', color: '#111' }}>
                  A 方先手
                </button>
                <button className="primary" onClick={() => handleConfirm('b')} style={{ background: '#39d98a', color: '#111' }}>
                  B 方先手
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'ploy' && (
        <div className="sp-ploy">
          <div className="sp-status">
            <span>先手：<strong className={initiative ?? ''}>{initiative?.toUpperCase()}</strong></span>
            <span>轮到：<strong className={strategyTurn ?? ''}>{strategyTurn?.toUpperCase()}</strong></span>
            <span className="muted">剩余 CP — A:{turn.cp.a} B:{turn.cp.b}</span>
            <button className="rollback-btn" disabled={!lastPloy} onClick={() => strategyUndo()} title="撤销最近一次战略计谋（恢复 CP/回合）">
              ↶ 回退
            </button>
          </div>

          <div className="sp-sides">
            {(['a', 'b'] as Side[]).map((side) => {
              const pack = packForSide(tokens, side)
              const cp = turn.cp[side]
              const isTurn = strategyTurn === side
              const active = activeStratagems[side]
              const strategyStrats = (pack?.stratagems ?? []).filter((s) => s.phase === 'STRATEGY')
              return (
                <div key={side} className={`sp-side ${side} ${isTurn ? 'active' : ''}`}>
                  <h4>
                    {side.toUpperCase()} 方
                    {isTurn ? ' · 你的回合' : strategyPasses[side] ? ' · 已跳过' : ''}
                  </h4>
                  <p className="muted">剩余 CP <strong>{cp}</strong></p>

                  <div className="strat-list">
                    {strategyStrats.length === 0 && <span className="muted">无战略计谋</span>}
                    {strategyStrats.map((s) => {
                      const eids = pack!.effects.filter((e) => e.source === 'stratagem:' + s.id).map((e) => e.effectId)
                      const used = eids.length > 0 && eids.every((eid) => active.includes(eid))
                      const canUse = isTurn && cp >= s.cp && !used
                      return (
                        <button
                          key={s.id}
                          className={`strat-card ${used ? 'on' : ''}`}
                          disabled={!canUse}
                          onClick={() => pack && useStrat(side, s, pack)}
                          title={used ? `${s.name}（本回合已用）` : canUse ? `${s.name}（${s.cp}CP）` : isTurn ? 'CP 不足' : '非己方回合'}
                        >
                          <span className="strat-name">{s.name}</span>
                          <span className="strat-cp">CP{s.cp}</span>
                          <span className={`strat-dot ${used ? 'on' : ''}`}>{used ? '✓' : '○'}</span>
                        </button>
                      )
                    })}
                  </div>

                  {isTurn && (
                    <div className="sp-actions">
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

function packForSide(tokens: { side: Side; opId: string; alive: boolean }[], side: Side): FactionPack | null {
  const t = tokens.find((x) => x.side === side && x.alive)
  if (!t) return null
  const roster = side === 'a' ? useRosterStore.getState().rosterA : useRosterStore.getState().rosterB
  return roster.factionId ? packOfFaction(roster.factionId) : packOfOp(t.opId)
}
