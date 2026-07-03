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

  // 从 token 前缀解析阵营包
  const sampleOp = tokens.find((t) => t.side === side && t.alive)
  if (!sampleOp) return null
  const prefix = sampleOp.opId.split('_')[0]
  const packKey = prefix === 'angels' ? 'angels_of_death' : prefix === 'leg' ? 'legionaries' : prefix === 'plg' ? 'plague_marines' : null
  if (!packKey || !PACKS[packKey]) return null
  const pack = PACKS[packKey]
  const stratagems = pack.stratagems ?? []
  if (stratagems.length === 0) return null

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
