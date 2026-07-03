import { useState } from 'react'
import type { FactionPack } from '../../rules'

// 阵营概览：只读展示计谋（战略/交战）、阵营装备、特工能力。
// 计谋和装备是阵营常驻规则，不需建队时选择——展示让玩家了解。
export function FactionOverview({ pack }: { pack: FactionPack }) {
  const [expanded, setExpanded] = useState(false)

  const stratagems = pack.stratagems ?? []
  const wargear = pack.wargear ?? []
  const abilityEffects = pack.effects.filter((e) => e.source.startsWith('ability:'))
  const factionRuleEffects = pack.effects.filter((e) => e.source.startsWith('factionRule:'))

  function effectLabel(source: string): string {
    const e = pack.effects.find((x) => x.source === source)
    return e?.label ?? source.split(':')[1] ?? source
  }

  const strategyStrats = stratagems.filter((s) => s.phase === 'STRATEGY')
  const engagementStrats = stratagems.filter((s) => s.phase === 'ENGAGEMENT')

  if (stratagems.length === 0 && wargear.length === 0 && abilityEffects.length === 0 && factionRuleEffects.length === 0) return null

  function renderStratList(title: string, list: typeof stratagems) {
    if (list.length === 0) return null
    return (
      <div className="fo-group">
        <span className="fo-group-title">{title}</span>
        {list.map((s) => (
          <div key={s.id} className="fo-item">
            <span className="fo-item-name">{s.name}</span>
            <span className={`fo-tag ${s.phase === 'STRATEGY' ? 'strat' : 'eng'}`}>{s.phase === 'STRATEGY' ? '战略' : '交战'}</span>
            <span className="fo-cp">CP{s.cp}</span>
            <span className="fo-desc">{effectLabel('stratagem:' + s.id)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="faction-overview">
      <button className="fo-toggle" onClick={() => setExpanded(!expanded)}>
        阵营概览{expanded ? '▾' : '▸'}
      </button>
      {expanded && (
        <div className="fo-body">
          {renderStratList('战略计谋', strategyStrats)}
          {renderStratList('交战计谋', engagementStrats)}
          {wargear.length > 0 && (
            <div className="fo-group">
              <span className="fo-group-title">阵营装备</span>
              {wargear.map((w) => (
                <div key={w.id} className="fo-item">
                  <span className="fo-item-name">{w.name}</span>
                  <span className="fo-tag equip">装备</span>
                  <span className="fo-desc">{effectLabel('wargear:' + w.id)}</span>
                </div>
              ))}
            </div>
          )}
          {abilityEffects.length > 0 && (
            <div className="fo-group">
              <span className="fo-group-title">特工能力</span>
              {abilityEffects.map((e) => (
                <div key={e.effectId} className="fo-item">
                  <span className="fo-item-name">{e.label.split('（')[0]}</span>
                  <span className="fo-tag ability">能力</span>
                  <span className="fo-desc">{e.label}</span>
                </div>
              ))}
            </div>
          )}
          {factionRuleEffects.length > 0 && (
            <div className="fo-group">
              <span className="fo-group-title">阵营规则（常驻）</span>
              {factionRuleEffects.map((e) => (
                <div key={e.effectId} className="fo-item">
                  <span className="fo-item-name">{e.label.split('（')[0]}</span>
                  <span className="fo-tag rule">规则</span>
                  <span className="fo-desc">{e.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
