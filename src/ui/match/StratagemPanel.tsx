import { useState } from 'react'
import { useMatchStore, packOfOp, packOfFaction, type Side } from '../../state/matchStore'
import { loadPack, type FactionPack, type Stratagem } from '../..'
import { useRosterStore } from '../../state/rosterStore'
// 计谋面板：显示当前激活方的阵营计谋（战略/交战），点击激活/取消。
// 激活后 effectId 进 activeStratagems → buildEffectStack 自动包含。

export function StratagemPanel() {
  const turn = useMatchStore((s) => s.turn)
  const activeStratagems = useMatchStore((s) => s.activeStratagems)
  const toggleStratagem = useMatchStore((s) => s.toggleStratagem)
  const tokens = useMatchStore((s) => s.tokens)
  const [expanded, setExpanded] = useState(false)

  const side: Side = turn.activePlayer
  const active = activeStratagems[side]

  // 从 token 解析阵营包
  const sampleOp = tokens.find((t) => t.side === side && t.alive)
  if (!sampleOp) return null
  const roster = side === 'a' ? useRosterStore.getState().rosterA : useRosterStore.getState().rosterB
  const pack = roster.factionId ? packOfFaction(roster.factionId) : packOfOp(sampleOp.opId)
  const stratagems = pack.stratagems ?? []

  // 映射 stratagem id → effectIds
  function effectIdsOf(stratId: string): string[] {
    return pack.effects.filter((e) => e.source === 'stratagem:' + stratId).map((e) => e.effectId)
  }

  function isStratActive(stratId: string): boolean {
    return effectIdsOf(stratId).every((eid) => active.includes(eid))
  }

  function toggle(strat: Stratagem) {
    const eids = effectIdsOf(strat.id)
    const isActive = isStratActive(strat.id)
    eids.forEach((eid) => {
      if (isActive === active.includes(eid)) {
        toggleStratagem(side, eid)
      }
    })
  }

  const strategyStrats = stratagems.filter((s) => s.phase === 'STRATEGY')
  const engagementStrats = stratagems.filter((s) => s.phase === 'ENGAGEMENT')

  function renderGroup(title: string, list: Stratagem[]) {
    if (list.length === 0) return null
    return (
      <>
        <div className="strat-group-title">{title}</div>
        {list.map((s) => {
          const on = isStratActive(s.id)
          return (
            <button
              key={s.id}
              className={`strat-card ${on ? 'on' : ''}`}
              onClick={() => toggle(s)}
              title={`${s.name}（${s.phase === 'STRATEGY' ? '战略' : '交战'}·CP${s.cp}）`}
            >
              <span className="strat-name">{s.name}</span>
              <span className={`strat-phase ${s.phase === 'STRATEGY' ? 'strat' : 'eng'}`}>
                {s.phase === 'STRATEGY' ? '战略' : '交战'}
              </span>
              <span className="strat-cp">CP{s.cp}</span>
              <span className={`strat-dot ${on ? 'on' : ''}`}>{on ? '✓' : '○'}</span>
            </button>
          )
        })}
      </>
    )
  }

  return (
    <div className="stratagem-panel">
      <button className="strat-toggle-btn" onClick={() => setExpanded(!expanded)}>
        计谋（{active.length} 激活）{expanded ? '▾' : '▸'}
      </button>
      {expanded && (
        <div className="strat-list">
          {renderGroup('战略计谋', strategyStrats)}
          {renderGroup('交战计谋', engagementStrats)}
        </div>
      )}
    </div>
  )
}
