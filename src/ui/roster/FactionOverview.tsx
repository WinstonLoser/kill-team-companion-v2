import type { FactionPack } from '../../rules'

/**
 * 阵营概览：计谋（战略/交战）、阵营装备、特工能力、阵营规则。
 *
 * 这些是常驻规则，建队时不需要选，只是查阅材料 —— 原来它常驻在建队栏里，
 * 是整屏最大的一块信息。现在由调用方装进弹层，按需打开。
 */
export function FactionOverview({ pack, onClose }: { pack: FactionPack; onClose: () => void }) {
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
  const isEmpty = stratagems.length === 0 && wargear.length === 0
    && abilityEffects.length === 0 && factionRuleEffects.length === 0

  function renderStratList(title: string, list: typeof stratagems) {
    if (list.length === 0) return null
    return (
      <div className="fo-group">
        <span className="ds-eyebrow fo-group-title">{title}</span>
        {list.map((s) => (
          <div key={s.id} className="fo-item">
            <span className="fo-item-name">{s.name}</span>
            <span className={`ds-badge ${s.phase === 'STRATEGY' ? 'ds-badge--accent' : 'ds-badge--warning'} fo-tag`}>
              {s.phase === 'STRATEGY' ? '战略' : '交战'}
            </span>
            <span className="ds-stat fo-cp">CP{s.cp}</span>
            <span className="fo-desc">{effectLabel('stratagem:' + s.id)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="ds-scrim" onClick={onClose}>
      <div className="ds-modal fo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-head">
          <div>
            <div className="ds-eyebrow">阵营资料</div>
            <h3 className="ds-display ds-display--md">{pack.faction.name}</h3>
          </div>
          <button className="ds-modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>

        <div className="ds-modal-body">
          {isEmpty && <p className="ds-empty">该阵营没有可展示的常驻规则</p>}
          {renderStratList('战略计谋', strategyStrats)}
          {renderStratList('交战计谋', engagementStrats)}

          {wargear.length > 0 && (
            <div className="fo-group">
              <span className="ds-eyebrow fo-group-title">阵营装备</span>
              {wargear.map((w) => (
                <div key={w.id} className="fo-item">
                  <span className="fo-item-name">{w.name}</span>
                  <span className="ds-badge ds-badge--success fo-tag">装备</span>
                  <span className="fo-desc">{effectLabel('wargear:' + w.id)}</span>
                </div>
              ))}
            </div>
          )}

          {abilityEffects.length > 0 && (
            <div className="fo-group">
              <span className="ds-eyebrow fo-group-title">特工能力</span>
              {abilityEffects.map((e) => (
                <div key={e.effectId} className="fo-item">
                  <span className="fo-item-name">{e.label.split('（')[0]}</span>
                  <span className="ds-badge ds-badge--accent fo-tag">能力</span>
                  <span className="fo-desc">{e.label}</span>
                </div>
              ))}
            </div>
          )}

          {factionRuleEffects.length > 0 && (
            <div className="fo-group">
              <span className="ds-eyebrow fo-group-title">阵营规则（常驻）</span>
              {factionRuleEffects.map((e) => (
                <div key={e.effectId} className="fo-item">
                  <span className="fo-item-name">{e.label.split('（')[0]}</span>
                  <span className="ds-badge fo-tag">规则</span>
                  <span className="fo-desc">{e.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
