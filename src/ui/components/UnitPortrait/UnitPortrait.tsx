import React from 'react'
import { t } from '../../../utils/i18n'
import './UnitPortrait.css'

export interface UnitPortraitProps {
  name: string
  currentWounds: number
  maxWounds: number
  statuses?: string[]
  themeColor?: string
  themeColorRgb?: string
  avatarUrl?: string
  locale?: any
  scale?: number
  selected?: boolean
  onClick?: () => void
  onAvatarClick?: () => void
}

export function UnitPortrait({
  name,
  currentWounds,
  maxWounds,
  statuses = [],
  themeColor = '#ff5a00',
  themeColorRgb = '255, 90, 0',
  avatarUrl,
  locale = 'zh',
  scale = 1,
  selected = false,
  onClick,
  onAvatarClick
}: UnitPortraitProps) {
  const [imgError, setImgError] = React.useState(false)
  
  if (!name) return null

  const hpPercent = Math.max(0, Math.min(100, (currentWounds / maxWounds) * 100))
  
  // Color coding the HP bar based on health percentage
  let hpColor = '#4ade80' // Green
  if (hpPercent <= 30) {
    hpColor = '#ef4444' // Red
  } else if (hpPercent <= 60) {
    hpColor = '#facc15' // Yellow
  }

  const style = {
    '--portrait-theme': themeColor,
    '--portrait-theme-rgb': themeColorRgb,
    '--portrait-hp': hpColor,
    'font-size': `${16 * scale}px`,
    ...(selected ? {
      boxShadow: `0 0 15px ${themeColor}, inset 0 0 10px ${themeColor}`,
      borderColor: themeColor
    } : {})
  } as React.CSSProperties

  return (
    <div className={`unit-portrait-container ${selected ? 'selected' : ''}`} style={style} onClick={onClick}>
      <div 
        className="up-avatar-wrapper" 
        onClick={(e) => {
          if (onAvatarClick) {
            e.stopPropagation();
            if (onClick) onClick();
            onAvatarClick();
          }
        }}
        style={{ cursor: onAvatarClick ? 'pointer' : 'inherit' }}
      >
        {avatarUrl && !imgError ? (
          <img src={avatarUrl} alt={name} className="up-avatar-image" onError={() => setImgError(true)} />
        ) : (
          <div className="up-avatar-placeholder">
            <span className="avatar-icon">👤</span>
          </div>
        )}
      </div>

      <div className="up-info-section">
        <div className="up-header-row">
          <h2 className="up-name">{t(name, locale)}</h2>
          <div className="up-tags">
            {statuses.map(s => (
              <span key={s} className="up-status-tag">{t(s, locale)}</span>
            ))}
          </div>
        </div>

        <div className="up-health-section">
          <div className="up-health-bar-bg">
            <div className="up-health-bar-fill" style={{ width: `${hpPercent}%` }}></div>
            <span className="up-health-text">{currentWounds} / {maxWounds} W</span>
          </div>
        </div>
      </div>
    </div>
  )
}
