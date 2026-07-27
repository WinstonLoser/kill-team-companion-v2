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
  themeColor = 'var(--accent-primary)',
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
  
  // Color coding the HP bar based on health percentage.
  // DS 的状态色是「脏化/去饱和」的（血红/枯橄榄/暗琥珀），不用亮饱和的通用 UI 色。
  let hpColor = 'var(--status-success)'
  if (hpPercent <= 30) {
    hpColor = 'var(--status-danger-hover)'
  } else if (hpPercent <= 60) {
    hpColor = 'var(--status-warning)'
  }

  const style = {
    '--portrait-theme': themeColor,
    '--portrait-theme-rgb': themeColorRgb,
    '--portrait-hp': hpColor,
    // 本组件内部一律用 em，这里定 1em 的基准。挂在 --text-body 上而非写死
    // 16px，好让整卡跟着全局 --ui-scale 一起缩放；scale 仍是调用方的局部倍率。
    fontSize: `calc(${scale} * var(--text-body))`,
    // DS 是扁平体系（--shadow-* 全部 none）：选中态只换边框色，不加辉光。
    ...(selected ? { borderColor: themeColor } : {})
  } as React.CSSProperties

  return (
    <div className={`unit-portrait-container kc-dossier ${selected ? 'selected' : ''}`} style={style} onClick={onClick}>
      {/* DS「档案卡」角标：虚线边框 + 四角 + 十字定位标记 */}
      <span className="kc-dossier-corner tl" aria-hidden="true" />
      <span className="kc-dossier-corner tr" aria-hidden="true" />
      <span className="kc-dossier-corner bl" aria-hidden="true" />
      <span className="kc-dossier-corner br" aria-hidden="true" />
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
