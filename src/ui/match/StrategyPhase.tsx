import { useState } from 'react'
import { useMatchStore, packOfFaction, packOfOp, type Side } from '../../state/matchStore'
import type { FactionPack } from '../../rules'
import { useRosterStore } from '../../state/rosterStore'
import { DiceIcon } from '../components/Dice/DiceIcon'
import { TeamWargearSummary } from './TeamWargearSummary'
import { useVisualFxStore } from '../../state/visualFxStore'

const SIDES: Side[] = ['a', 'b']

export function StrategyPhase() {
  const turn = useMatchStore(s => s.turn)
  const tokens = useMatchStore(s => s.tokens)
  const initiative = useMatchStore(s => s.initiative)
  const initiativeRoll = useMatchStore(s => s.initiativeRoll)
  const strategyTurn = useMatchStore(s => s.strategyTurn)
  const strategyPasses = useMatchStore(s => s.strategyPasses)
  const lastPloy = useMatchStore(s => s.lastPloy)
  const usedPloys = useMatchStore(s => s.usedPloys)
  const rollInitiative = useMatchStore(s => s.rollInitiative)
  const recordInitiativeRoll = useMatchStore(s => s.recordInitiativeRoll)
  const confirmInitiative = useMatchStore(s => s.confirmInitiative)
  const strategyAct = useMatchStore(s => s.strategyAct)
  const strategyUndo = useMatchStore(s => s.strategyUndo)
  const usePloy = useMatchStore(s => s.usePloy)
  const useStrategicGambit = useMatchStore(s => s.useStrategicGambit)
  const setPushMsg = useMatchStore(s => s.setPushMsg)
  const showPhaseNotice = useVisualFxStore(s => s.showPhaseNotice)
  const [manualA, setManualA] = useState('')
  const [manualB, setManualB] = useState('')

  const manualValid = /^[1-6]$/.test(manualA) && /^[1-6]$/.test(manualB)
  const cpGain = turn.turningPoint === 1 ? '+1 / +1' : '+1 先手 / +2 后手'

  return (
    <main className="strategy-phase">
      <header className="sp-hero">
        <div className="sp-eyebrow">转折点 {turn.turningPoint} / 4 · 战略准备</div>
        <h2>{initiative ? '轮流制定战略' : '决定本轮先手'}</h2>
        <p>{initiative ? '从先手方开始，交替使用战略计谋或跳过。双方连续跳过后进入交战。' : '双方各掷一枚 D6。高点数一方决定谁取得先手权。'}</p>
        <div className="sp-steps" aria-label="战略阶段流程">
          <span className={initiativeRoll ? 'done' : 'current'}>1 · 争夺先手</span>
          <span className={initiative ? 'done' : initiativeRoll ? 'current' : ''}>2 · 获得 CP</span>
          <span className={initiative ? 'current' : ''}>3 · 战略计谋</span>
        </div>
      </header>

      {!initiative && (
        <section className="sp-card sp-initiative" aria-label="先手争夺">
          <div className="sp-rule-note">{turn.turningPoint === 1 ? '开局每方有 2 CP。本阶段确定先手后，各获得 1 CP。' : '确定先手后，先手方获得 1 CP，后手方获得 2 CP。'}</div>
          <div className="sp-dice-row">
            {SIDES.map(side => (
              <div className={`sp-die ${side}`} key={side}>
                <span>{side.toUpperCase()} 方</span>
                {initiativeRoll ? <DiceIcon dice={{ nat: initiativeRoll[side] as 1|2|3|4|5|6, grade: 'NORMAL' }} theme={{ baseColor: side === 'a' ? '#c75d3a' : '#3a7bc7', pipColor: '#111' }} /> : <div className="sp-die-placeholder">D6</div>}
                <strong>{initiativeRoll ? initiativeRoll[side] : '待掷'}</strong>
              </div>
            ))}
          </div>
          {!initiativeRoll ? (
            <div className="sp-roll-actions">
              <button className="primary sp-roll-button" onClick={() => rollInitiative()}>掷骰决定先手</button>
              <div className="sp-manual">
                <span>使用实体骰？录入点数</span>
                {SIDES.map(side => (
                  <label key={side}>
                    {side.toUpperCase()} 方
                    <input type="number" inputMode="numeric" min="1" max="6" step="1" value={side === 'a' ? manualA : manualB} onChange={event => side === 'a' ? setManualA(event.target.value) : setManualB(event.target.value)} />
                  </label>
                ))}
                <button disabled={!manualValid} onClick={() => recordInitiativeRoll(Number(manualA), Number(manualB))}>确认点数</button>
              </div>
            </div>
          ) : (
            <div className="sp-result">
              <strong>{initiativeRoll.a === initiativeRoll.b ? '平局' : `${initiativeRoll.decider.toUpperCase()} 方点数较高`}</strong>
              <p>{initiativeRoll.a === initiativeRoll.b ? `${initiativeRoll.decider.toUpperCase()} 方上轮没有先手权，由其决定本轮先手。` : `${initiativeRoll.decider.toUpperCase()} 方决定本轮谁先行动。`}</p>
              <div className="sp-initiative-choices">
                {SIDES.map(side => <button className="primary" key={side} onClick={() => confirmInitiative(side)}>{side.toUpperCase()} 方先手</button>)}
              </div>
            </div>
          )}
        </section>
      )}

      {initiative && (
        <section className="sp-ploy" aria-label="战略计谋">
          <div className="sp-status">
            <div><span>本轮先手</span><strong className={initiative}>{initiative.toUpperCase()} 方</strong></div>
            <div><span>当前选择</span><strong className={strategyTurn ?? ''}>{strategyTurn?.toUpperCase()} 方</strong></div>
            <div><span>本轮 CP 增益</span><strong>{cpGain}</strong></div>
            <button className="rollback-btn" disabled={!lastPloy} onClick={strategyUndo}>↶ 回退上一步</button>
          </div>
          <div className="sp-sides">
            {SIDES.map(side => {
              const pack = packForSide(tokens, side)
              const teamWargearIds = tokens.find(item => item.side === side)?.teamWargearIds ?? []
              const isTurn = strategyTurn === side
              const strats = (pack?.stratagems ?? []).filter(s => s.phase === 'STRATEGY')
              const gambits = [
                ...(pack?.factionRules ?? []).filter(rule => rule.description?.includes('战略计划')).map(rule => ({ source: 'factionRule' as const, id: rule.ruleId, name: rule.name, description: rule.description! })),
                ...(pack?.wargear ?? []).filter(item => teamWargearIds.includes(item.id) && item.description?.includes('战略计划')).map(item => ({ source: 'wargear' as const, id: item.id, name: item.name, description: item.description! })),
              ]
              return (
                <article key={side} data-faction={pack?.faction.id} className={`sp-side ${side} ${isTurn ? 'active' : ''}`}>
                  <div className="sp-side-head">
                    <div><span className="sp-side-kicker">{side.toUpperCase()} 方 · {displayZh(pack?.faction.name ?? '小队')}</span><h3>{isTurn ? '轮到你制定战略' : strategyPasses[side] ? '已跳过本次机会' : '等待对方选择'}</h3></div>
                    <div className="sp-cp"><strong>{turn.cp[side]}</strong><span>CP</span></div>
                  </div>
                  <div className="strat-list">
                    {strats.length === 0 && <p className="muted">该阵营暂无可用战略计谋，可以跳过。</p>}
                    {strats.map(strat => {
                      const used = (usedPloys[`${side}:${strat.id}:tp${turn.turningPoint}`] ?? 0) >= (strat.useLimit.perTurningPoint ?? 1)
                      const insufficient = turn.cp[side] < strat.cp
                      return (
                        <button key={strat.id} className={`strat-card ${used ? 'on' : ''}`} disabled={!isTurn || used || insufficient} onClick={() => { const result = usePloy(side, strat.id); if (!result.ok) setPushMsg(result.reason ?? '计谋不可用'); else showPhaseNotice(displayZh(strat.name), `${side.toUpperCase()} 方 · 战略计谋`, pack?.faction.id) }}>
                          <span className="strat-name">{displayZh(strat.name)}<small className="ploy-description">{displayZh(strat.description ?? '')}</small></span>
                          <span className="strat-cost">{used ? '本轮已用' : insufficient ? 'CP 不足' : `${strat.cp} CP`}</span>
                        </button>
                      )
                    })}
                  </div>
                  {gambits.length > 0 && <div className="sp-gambits">
                    <h4>其他战略计划 · 0 CP</h4>
                    {gambits.map(gambit => {
                      const used = Boolean(usedPloys[`${side}:gambit:${gambit.source}:${gambit.id}:tp${turn.turningPoint}`]) || (gambit.description.includes('每场战斗限一次') && Boolean(usedPloys[`${side}:gambit:${gambit.source}:${gambit.id}:battle`]))
                      const unavailable = gambit.description.includes('第一转折点中') && turn.turningPoint !== 1
                      return <div className="sp-gambit" key={`${gambit.source}:${gambit.id}`}>
                        <details><summary>{displayZh(gambit.name)}</summary><p>{displayZh(gambit.description)}</p></details>
                        <button disabled={!isTurn || used || unavailable} onClick={() => { const result = useStrategicGambit(side, gambit.source, gambit.id); if (!result.ok) setPushMsg(result.reason ?? '战略计划不可用'); else showPhaseNotice(displayZh(gambit.name), `${side.toUpperCase()} 方 · 战略计划`, pack?.faction.id) }}>{used ? '已执行' : unavailable ? '仅首轮' : '记录执行'}</button>
                      </div>
                    })}
                  </div>}
                  <div className="sp-actions"><button className={isTurn ? 'primary' : ''} disabled={!isTurn} onClick={() => strategyAct(side, 'pass')}>跳过本次机会</button></div>
                </article>
              )
            })}
          </div>
          <p className="sp-footnote">每项战略计谋每转折点最多使用一次。卡面涉及选目标或特殊效果时，请按规则面对面裁定。</p>
        </section>
      )}

      <div className="team-wargear-pair">{SIDES.map(side => <TeamWargearSummary key={side} side={side} team={tokens.filter(token => token.side === side)} />)}</div>
    </main>
  )
}

function packForSide(tokens: { side: Side; opId: string; alive: boolean }[], side: Side): FactionPack | null {
  const token = tokens.find(item => item.side === side)
  if (!token) return null
  const roster = side === 'a' ? useRosterStore.getState().rosterA : useRosterStore.getState().rosterB
  return roster.factionId ? packOfFaction(roster.factionId) : packOfOp(token.opId)
}

function displayZh(value: string): string {
  if (!value.includes(' / ')) return value
  const parts = value.split(' / ')
  const firstChinese = parts.findIndex(part => /[\u3400-\u9fff]/.test(part))
  if (firstChinese < 0) return value
  return value.length < 80 ? parts[firstChinese]! : parts.slice(firstChinese).join(' / ')
}
