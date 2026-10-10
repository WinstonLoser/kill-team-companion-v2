import { useState, useEffect } from 'react'
import { type DiceRoll } from '../../../dice/source'
import { DiceIcon } from './DiceIcon'
import './DicePanel.css'
import { useVisualFxStore } from '../../../state/visualFxStore'
import { useLocaleStore } from '../../../state/localeStore'

export interface DicePanelProps {
  dice: DiceRoll[]
  theme?: {
    baseColor: string
    pipColor: string
  }
  animate?: boolean
  // Optional statuses mapped by index
  statuses?: Record<number, string>
  // Optional sound hook for external audio engines
  onSoundEvent?: (event: 'roll_start' | 'dice_stop' | 'roll_end', diceIndex?: number) => void
  onConfirm?: () => void
  onDieClick?: (index: number) => void
  animatingIndices?: number[]
}

export function DicePanel({ dice, theme, animate = false, statuses = {}, onSoundEvent, onConfirm, onDieClick, animatingIndices }: DicePanelProps) {
  const motionMode = useVisualFxStore(s => s.motionMode)
  const locale = useLocaleStore(s => s.locale)
  const shouldAnimate = animate && motionMode === 'full' && (animatingIndices === undefined ? dice.some(d => !d.isRetained) : animatingIndices.length > 0)
  // Array of boolean indicating if each die is currently rolling
  const getActiveIndices = () => animatingIndices ?? dice.map((d, i) => d.isRetained ? -1 : i).filter(i => i !== -1);
  const [rollingStates, setRollingStates] = useState<boolean[]>(
    dice.map((_d, i) => shouldAnimate ? getActiveIndices().includes(i) : false)
  )

  // Reveal states for sequential display
  const [showCrits, setShowCrits] = useState(!shouldAnimate)
  const [showHits, setShowHits] = useState(!shouldAnimate)
  const [showFails, setShowFails] = useState(!shouldAnimate)
  const [showConfirm, setShowConfirm] = useState(!shouldAnimate)

  // Reset sequential reveal states when dice change
  useEffect(() => {
    if (!shouldAnimate) {
      setShowCrits(true)
      setShowHits(true)
      setShowFails(true)
      setShowConfirm(true)
    } else {
      setShowCrits(false)
      setShowHits(false)
      setShowFails(false)
      setShowConfirm(false)
    }
  }, [dice, shouldAnimate])

  useEffect(() => {
    if (shouldAnimate) {
      const timers: ReturnType<typeof setTimeout>[] = []
      const later = (callback: () => void, delay: number) => { timers.push(setTimeout(callback, delay)) }
      const activeIndices = getActiveIndices()
      setRollingStates(dice.map((_d, i) => activeIndices.includes(i) ? true : false))
      onSoundEvent?.('roll_start')
      
      const BASE_DELAY = 150
      const INTERVAL = 100
      
      const lastAnimatedIndex = activeIndices.length > 0 ? activeIndices[activeIndices.length - 1] : -1

      if (activeIndices.length === 0) {
        onSoundEvent?.('roll_end')
        later(() => setShowCrits(true), 200)
        later(() => setShowHits(true), 350)
        later(() => setShowFails(true), 500)
        later(() => setShowConfirm(true), 700)
      } else {
        dice.forEach((_d, index) => {
          if (!activeIndices.includes(index)) return
          
          later(() => {
            setRollingStates(prev => {
              const next = [...prev]
              next[index] = false
              return next
            })
            onSoundEvent?.('dice_stop', index)
            
            if (index === lastAnimatedIndex) {
              onSoundEvent?.('roll_end')
              later(() => setShowCrits(true), 200)
              later(() => setShowHits(true), 350)
              later(() => setShowFails(true), 500)
              later(() => setShowConfirm(true), 700)
            }
          }, BASE_DELAY + activeIndices.indexOf(index) * INTERVAL)
        })
      }
      return () => { timers.forEach(clearTimeout) }
    } else {
      setRollingStates(new Array(dice.length).fill(false))
    }
  }, [dice, shouldAnimate])

  const crits = dice.filter(d => d.grade === 'CRITICAL').length
  const hits = dice.filter(d => d.grade === 'NORMAL').length
  const fails = dice.filter(d => d.grade === 'FAIL').length

  return (
    <div className={`dice-panel ${shouldAnimate && rollingStates.some(Boolean) ? 'is-rolling' : 'is-settled'}`}>
      <div className="dice-tray-heading"><span>{locale === 'zh' ? '命运骰盘' : 'DICE TRAY'}</span><small>{shouldAnimate && rollingStates.some(Boolean) ? (locale === 'zh' ? '投骰中…' : 'Rolling…') : (locale === 'zh' ? '结果已落定' : 'Results settled')}</small></div>
      <div className="dice-panel-stats">
        {showCrits && crits > 0 && <div className="stat-badge stat-crit stat-reveal">{locale === 'zh' ? '暴击' : 'Crits'} <span className="stat-badge-val">{crits}</span></div>}
        {showHits && hits > 0 && <div className="stat-badge stat-hit stat-reveal">{locale === 'zh' ? '命中' : 'Hits'} <span className="stat-badge-val">{hits}</span></div>}
        {showFails && fails > 0 && <div className="stat-badge stat-fail stat-reveal">{locale === 'zh' ? '失手' : 'Fails'} <span className="stat-badge-val">{fails}</span></div>}
      </div>
      <div className="dice-container">
        {dice.map((d, i) => {
          const activeIndices = getActiveIndices()
          const delayIndex = activeIndices.indexOf(i)
          
          return (
            <div 
              key={`${d.seed || 'dice'}-${i}`} 
              className={`dice-entrance ${shouldAnimate && activeIndices.includes(i) ? 'animated' : ''} ${rollingStates[i] ? 'is-rolling' : 'is-landed'}`}
              data-grade={d.grade}
              style={(shouldAnimate && activeIndices.includes(i)) ? { animationDelay: `${delayIndex * 50}ms`, cursor: onDieClick ? 'pointer' : 'default' } : { cursor: onDieClick ? 'pointer' : 'default' }}
              onClick={() => onDieClick?.(i)}
            >
              <DiceIcon
                dice={d}
                theme={theme}
                status={statuses[i] || (d.isRetained ? 'RETAINED' : undefined)}
                isRolling={rollingStates[i]}
              />
              {!rollingStates[i] && <span className="dice-grade-label">{d.grade === 'CRITICAL' ? (locale === 'zh' ? '暴击' : 'CRIT') : d.grade === 'NORMAL' ? (locale === 'zh' ? '命中' : 'HIT') : (locale === 'zh' ? '失手' : 'MISS')}</span>}
            </div>
          )
        })}
      </div>
      {onConfirm && showConfirm && (
        <div className="dice-action-area button-reveal">
          <button className="dice-confirm-btn" onClick={onConfirm}>
            {locale === 'zh' ? '确认骰面' : 'Confirm Results'}
          </button>
        </div>
      )}
    </div>
  )
}
