import { useState } from 'react'
import { useMatchStore, type Side } from '../../state/matchStore'
import { loadPack, type FactionPack, type Stratagem } from '../..'
import angelsData from '../../data/packs/angels_of_death.v1.json'
import legionariesData from '../../data/packs/legionaries.v1.json'
import plagueData from '../../data/packs/plague_marines.v1.json'

const PACKS: Record<string, FactionPack> = {
  angels_of_death: loadPack(angelsData),
  legionaries: loadPack(legionariesData),
  plague_marines: loadPack(plagueData),
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
  const [rollResult, setRollResult] = useState<{ a: number; b: number; winner: string } | null>(null)

  function doRoll() {
    setRollResult(rollInitiative())
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
        <div className="sp-card">
          <p className="muted">掷 D6 决定先手权（高者先；平局 A 方选）</p>
          <button className="primary main-btn dice-btn" onClick={doRoll}>🎲 掷 D6</button>
          {rollResult && (
            <div className="sp-result">
              <span className={`sp-dice ${rollResult.winner === 'a' ? 'win' : ''}`}>A: {rollResult.a}</span>
              <span className="muted">vs</span>
              <span className={`sp-dice ${rollResult.winner === 'b' ? 'win' : ''}`}>B: {rollResult.b}</span>
              <p><strong>{rollResult.winner.toUpperCase()} 方</strong>拥有先手权</p>
              <p className="muted">剩余 CP — A:{turn.cp.a} B:{turn.cp.b}</p>
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

/** 从某方 token 的 opId 前缀解析阵营包。 */
function packForSide(tokens: { side: Side; opId: string; alive: boolean }[], side: Side): FactionPack | null {
  const t = tokens.find((x) => x.side === side && x.alive)
  if (!t) return null
  const prefix = t.opId.split('_')[0]
  const key = prefix === 'angels' ? 'angels_of_death' : prefix === 'leg' ? 'legionaries' : prefix === 'plg' ? 'plague_marines' : null
  return key ? PACKS[key] ?? null : null
}
