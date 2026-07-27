import { useState } from 'react'
import { useMatchStore, packOfOp, packOfFaction, type Side } from '../../state/matchStore'
import { loadPack, type FactionPack, type Stratagem } from '../..'
import { useRosterStore } from '../../state/rosterStore'
import { DiceIcon } from '../components/Dice/DiceIcon'
// 先手骰的骰面取阵营色（锈橙 / 枪铁），点数用主题无关的 chrome 黑。
// DiceIcon 走 SVG，需要具体色值而非 var()，故在此解析成常量。
const SIDE_DIE: Record<Side, { base: string; pip: string }> = {
  a: { base: 'var(--kc-rust-3)', pip: 'var(--kc-black-1)' },
  b: { base: 'var(--kc-steel-4)', pip: 'var(--kc-black-1)' },
}

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
  const pushLog = useMatchStore((s) => s.pushLog)
  const [rollResult, setRollResult] = useState<{ a: number; b: number; winner: string } | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [tempDice, setTempDice] = useState<{ a: number; b: number }>({ a: 6, b: 6 })
  const [manualA, setManualA] = useState<number | ''>('')
  const [manualB, setManualB] = useState<number | ''>('')

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
      {/* 标题与转折点由外层浮层的 ds-modal-head 提供，这里不再重复 */}

      {phase === 'roll' && (
        <div className="sp-card">
          <p className="muted">掷 D6 决定先手权（高者胜，胜者决定谁先手）</p>

          <div className="sp-dice-row">
            {(['a', 'b'] as Side[]).map((side) => (
              <div key={side} className="sp-dice-col">
                <span className={`ds-label sp-side-name ${side}`}>{side.toUpperCase()} 方</span>
                <DiceIcon
                  dice={{ nat: tempDice[side], grade: 'NORMAL' }}
                  theme={{ baseColor: SIDE_DIE[side].base, pipColor: SIDE_DIE[side].pip }}
                  isRolling={isRolling}
                />
              </div>
            ))}
          </div>

          {!isRolling && !rollResult && (
            <div className="sp-roll-actions">
              <button className="ds-btn ds-btn--lg dice-btn" onClick={doRoll} style={{ width: '100%' }}>
                系统自动投掷
              </button>

              <div className="sp-manual">
                <p className="ds-label sp-manual-hint">或手动输入你们掷出的点数：</p>
                <div className="sp-manual-row">
                  <span className="ds-label sp-side-name a">A方</span>
                  <input className="ds-input sp-manual-input a" type="number" min="1" max="6" value={manualA} onChange={e => setManualA(parseInt(e.target.value) || '')} />

                  <span className="ds-label sp-side-name b">B方</span>
                  <input className="ds-input sp-manual-input b" type="number" min="1" max="6" value={manualB} onChange={e => setManualB(parseInt(e.target.value) || '')} />
                  <button 
                    className="ds-btn ds-btn--sm ds-btn--secondary"
                    disabled={!manualA || !manualB || manualA === manualB || manualA > 6 || manualA < 1 || manualB > 6 || manualB < 1}
                    onClick={() => {
                      if (typeof manualA === 'number' && typeof manualB === 'number') {
                        const winner = manualA > manualB ? 'a' : 'b'
                        setRollResult({ a: manualA, b: manualB, winner })
                        setTempDice({ a: manualA, b: manualB })
                        pushLog('system', `玩家手动录入先手权掷骰：A 掷出 ${manualA}, B 掷出 ${manualB}。${winner.toUpperCase()} 方获胜！`)
                      }
                    }}
                  >确认点数</button>
                </div>
                {manualA !== '' && manualB !== '' && manualA === manualB && <p className="sp-tie">平局，请重新投掷</p>}
              </div>
            </div>
          )}

          {rollResult && !isRolling && (
            <div className="sp-result">
              <h3 className={`ds-display ds-display--md sp-winner ${rollResult.winner}`}>
                {rollResult.winner.toUpperCase()} 方赢得了掷骰
              </h3>
              <p className="sp-result-hint">请 {rollResult.winner.toUpperCase()} 方选择本转折点谁先行动：</p>
              <div className="sp-result-actions">
                <button className="ds-btn sp-pick a" onClick={() => handleConfirm('a')}>A 方先手</button>
                <button className="ds-btn sp-pick b" onClick={() => handleConfirm('b')}>B 方先手</button>
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
            <span className="ds-stat">剩余 CP — A:{turn.cp.a} B:{turn.cp.b}</span>
            <button className="ds-btn ds-btn--sm ds-btn--ghost rollback-btn" disabled={!lastPloy} onClick={() => strategyUndo()} title="撤销最近一次战略计谋（恢复 CP/回合）">
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
                  <h4 className="ds-display ds-display--sm">
                    {side.toUpperCase()} 方
                    {isTurn ? ' · 你的回合' : strategyPasses[side] ? ' · 已跳过' : ''}
                  </h4>
                  {/* CP 作为主视觉数字：Big Shoulders Display 大字号 */}
                  <p className="sp-cp"><span className="ds-stat--hero">{cp}</span> <span className="ds-label">CP 剩余</span></p>

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
                      <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => strategyAct(side, 'pass')}>跳过</button>
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
