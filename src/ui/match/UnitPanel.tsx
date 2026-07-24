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
        <div key={side} className={`unit-side ${side}`} style={{ 
          display: 'flex', flexDirection: 'column', gap: '8px',
          padding: '12px',
          borderRadius: '8px',
          border: `2px solid ${isActiveSide ? `rgb(${sideThemeRgb})` : 'rgba(255,255,255,0.1)'}`,
          boxShadow: isActiveSide ? `0 0 15px rgba(${sideThemeRgb}, 0.5), inset 0 0 10px rgba(${sideThemeRgb}, 0.2)` : 'none',
          backgroundColor: isActiveSide ? `rgba(${sideThemeRgb}, 0.05)` : 'transparent',
          transition: 'all 0.3s ease',
          clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' // High-tech chamfered corners
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: `1px solid ${isActiveSide ? `rgba(${sideThemeRgb}, 0.5)` : 'rgba(255,255,255,0.1)'}` }}>
            <h4 style={{ margin: 0, color: isActiveSide ? `rgb(${sideThemeRgb})` : '#ccc', textShadow: isActiveSide ? `0 0 8px rgba(${sideThemeRgb}, 0.5)` : 'none' }}>
              {side.toUpperCase()} 方阵容
            </h4>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: '#aaa' }}>CP</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button onClick={() => setResource(side, 'cp', -1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}>◀</button>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: `rgb(${sideThemeRgb})`, minWidth: '16px', textAlign: 'center' }}>{turn.cp[side]}</span>
                  <button onClick={() => setResource(side, 'cp', 1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}>▶</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: '#aaa' }}>VP</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button onClick={() => setResource(side, 'vp', -1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}>◀</button>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: `rgb(${sideThemeRgb})`, minWidth: '16px', textAlign: 'center' }}>{vp[side]}</span>
                  <button onClick={() => setResource(side, 'vp', 1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}>▶</button>
                </div>
              </div>
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
                      <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: themeColor, color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        激活中
                      </div>
                    )}
                  </div>
                  
                  {isSelected && isActiveSide && !isFinished && !isActivating && (
                    <div style={{ marginTop: '12px', width: '80%' }}>
                      <button 
                        className="primary" 
                        style={{ width: '100%', padding: '8px', fontSize: '0.9rem', opacity: hasActivating ? 0.5 : 1, backgroundColor: `rgba(${uiTheme.primaryRgb}, 0.8)`, border: `1px solid rgb(${uiTheme.primaryRgb})`, borderRadius: '4px', cursor: hasActivating ? 'not-allowed' : 'pointer', color: '#fff' }}
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
