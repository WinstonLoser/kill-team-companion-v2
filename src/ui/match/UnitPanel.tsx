import type React from 'react'
import { useMatchStore, type MatchToken, packOfFaction } from '../../state/matchStore'
import { UnitPortrait } from '../components/UnitPortrait/UnitPortrait'
import { ActionBar } from './ActionBar'
import { getAvatarUrl } from '../../utils/avatars'

// 1.13 单位面板 + 1.15 T4 状态反馈。
export function UnitPanel({ startWoundsOf, sideFilter, onPortraitClick, actionBarProps }: { startWoundsOf: (uid: string) => number, sideFilter?: 'a' | 'b', onPortraitClick?: (uid: string) => void, actionBarProps?: any }) {
  const tokens = useMatchStore((s) => s.tokens)
  const turn = useMatchStore((s) => s.turn)
  const selected = useMatchStore((s) => s.selected)
  const setSelected = useMatchStore((s) => s.setSelected)
  const setIntercept = useMatchStore((s) => s.setIntercept)
  const vp = useMatchStore((s) => s.vp)
  const setResource = useMatchStore((s) => s.setResource)

  const sides: ('a' | 'b')[] = sideFilter ? [sideFilter] : ['a', 'b']
  return (
    <div className="unit-panel" style={sideFilter ? { flexDirection: 'column' } : {}}>
      {sides.map((side) => {
        const sideTokens = tokens.filter((t) => t.side === side)
        const hasActivating = Boolean(turn.activeOpId && tokens.find(t => t.uid === turn.activeOpId)?.side === side)
        
        // Sorting: Activating (activeOpId) -> Unactivated/Ready -> Finished (ready:false)
        const sortedTokens = [...sideTokens].sort((a, b) => {
          const aOp = turn.operatives[a.uid]
          const bOp = turn.operatives[b.uid]
          const aState = turn.activeOpId === a.uid ? 0 : (!aOp || aOp.ready === true ? 1 : 2)
          const bState = turn.activeOpId === b.uid ? 0 : (!bOp || bOp.ready === true ? 1 : 2)
          return aState - bState
        })

        const selOp = selected ? turn.operatives[selected] : undefined
        const isSelFinished = selOp && !selOp.ready
        
        const firstToken = sideTokens[0]
        const sidePack = firstToken ? packOfFaction(firstToken.factionId) : null
        const sideThemeRgb = sidePack?.faction.theme?.ui?.primaryRgb || '255, 255, 255'
        const isActiveSide = side === turn.activePlayer

        return (
        <div
          key={side}
          className={`unit-side ds-chamfer ${side} ${isActiveSide ? 'is-active' : ''}`}
          style={{ '--side-theme': `rgb(${sideThemeRgb})` } as React.CSSProperties}
        >
          {/* 阵容标题带：走 DS 卡片的 chrome header 语汇 */}
          <div className="us-head">
            <h4 className="ds-display ds-display--sm us-title">{side.toUpperCase()} 方阵容</h4>
            <div className="us-resources">
              {(['cp', 'vp'] as const).map((res) => (
                <div key={res} className="us-res">
                  <span className="ds-label us-res-label">{res.toUpperCase()}</span>
                  <div className="ds-stepper">
                    <button className="ds-stepper-btn" onClick={() => setResource(side, res, -1)} title={`${res.toUpperCase()} -1`}>−</button>
                    <span className="ds-stepper-value us-res-value">{res === 'cp' ? turn.cp[side] : vp[side]}</span>
                    <button className="ds-stepper-btn" onClick={() => setResource(side, res, 1)} title={`${res.toUpperCase()} +1`}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="unit-list" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
            {sortedTokens.map((t) => {
              const maxWounds = startWoundsOf(t.uid)
              const isActivating = turn.activeOpId === t.uid
              const isFinished = turn.operatives[t.uid] && !turn.operatives[t.uid].ready
              const pack = packOfFaction(t.factionId)
              const uiTheme = pack?.faction.theme?.ui || { primaryRgb: '255, 90, 0' }
              const themeColor = `rgb(${uiTheme.primaryRgb})`
              const isSelected = selected === t.uid
              
              let filterStyle = 'none'
              if (!t.alive || isFinished) {
                filterStyle = 'grayscale(1) opacity(0.4)'
              } else if (!isActiveSide) {
                filterStyle = 'brightness(0.5) saturate(0.6)'
              } else if (hasActivating && !isActivating) {
                filterStyle = 'brightness(0.7)'
              }

              const avatarUrl = getAvatarUrl(t.factionId, t.opId)

              return (
                <div 
                  key={t.uid} 
                  style={{ 
                    transform: 'scale(0.9)', 
                    transformOrigin: 'top center',
                    marginBottom: '-8px',
                    filter: filterStyle,
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <UnitPortrait
                      name={t.name}
                      maxWounds={maxWounds}
                      currentWounds={t.wounds}
                      statuses={t.markers}
                      themeColor={themeColor}
                      themeColorRgb={uiTheme.primaryRgb}
                      avatarUrl={avatarUrl}
                      selected={isSelected}
                      onClick={() => { 
                        setSelected(t.uid)
                        setIntercept(null)
                      }}
                      onAvatarClick={() => {
                        if (onPortraitClick) onPortraitClick(t.uid)
                      }}
                    />
                    {isActivating && (
                      <span
                        className="ds-badge uc-activating"
                        style={{ background: themeColor, borderColor: themeColor, color: 'var(--text-on-accent)' }}
                      >
                        激活中
                      </span>
                    )}
                  </div>
                  
                  {isSelected && isActiveSide && !isFinished && !isActivating && (
                    <div style={{ marginTop: '12px', width: '80%' }}>
                      <button
                        className="ds-btn ds-btn--sm uc-activate"
                        style={{ width: '100%', background: themeColor, borderColor: themeColor }}
                        disabled={hasActivating}
                        title={hasActivating ? "请先结束当前特工的激活" : "激活该特工"}
                        onClick={() => {
                          useMatchStore.getState().activate(t.uid, t.side)
                          useMatchStore.getState().pushLog('turn', `${t.name} 激活（APL ${useMatchStore.getState().effectiveAplOf(t.uid)}）`)
                        }}
                      >
                        激活该特工 ▶
                      </button>
                    </div>
                  )}
                  {isActivating && actionBarProps && (
                    <div style={{ marginTop: '12px' }}>
                      <ActionBar {...actionBarProps} themeColor={themeColor} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )})}
    </div>
  )
}
