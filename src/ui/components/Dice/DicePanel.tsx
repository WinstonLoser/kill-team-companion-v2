import { useState, useEffect } from 'react'
import { type DiceRoll } from '../../../dice/source'
import { DiceIcon } from './DiceIcon'
import './DicePanel.css'

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
  // Array of boolean indicating if each die is currently rolling
  const getActiveIndices = () => animatingIndices ?? dice.map((d, i) => d.isRetained ? -1 : i).filter(i => i !== -1);
  const [rollingStates, setRollingStates] = useState<boolean[]>(
    dice.map((d, i) => animate ? getActiveIndices().includes(i) : false)
  )

  // Reveal states for sequential display
  const [showCrits, setShowCrits] = useState(!animate)
  const [showHits, setShowHits] = useState(!animate)
  const [showFails, setShowFails] = useState(!animate)
  const [showConfirm, setShowConfirm] = useState(!animate)

  // Reset sequential reveal states when dice change
  useEffect(() => {
    if (!animate) {
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
  }, [dice, animate])

  useEffect(() => {
    if (animate) {
      const activeIndices = getActiveIndices()
      setRollingStates(dice.map((d, i) => activeIndices.includes(i) ? true : false))
      onSoundEvent?.('roll_start')
      
      const BASE_DELAY = 150
      const INTERVAL = 100
      
      const lastAnimatedIndex = activeIndices.length > 0 ? activeIndices[activeIndices.length - 1] : -1

      if (activeIndices.length === 0) {
        onSoundEvent?.('roll_end')
        setTimeout(() => setShowCrits(true), 200)
        setTimeout(() => setShowHits(true), 350)
        setTimeout(() => setShowFails(true), 500)
        setTimeout(() => setShowConfirm(true), 700)
      } else {
        dice.forEach((d, index) => {
          if (!activeIndices.includes(index)) return
          
          setTimeout(() => {
            setRollingStates(prev => {
              const next = [...prev]
              next[index] = false
              return next
            })
            onSoundEvent?.('dice_stop', index)
            
            if (index === lastAnimatedIndex) {
              onSoundEvent?.('roll_end')
              setTimeout(() => setShowCrits(true), 200)
              setTimeout(() => setShowHits(true), 350)
              setTimeout(() => setShowFails(true), 500)
              setTimeout(() => setShowConfirm(true), 700)
            }
          }, BASE_DELAY + activeIndices.indexOf(index) * INTERVAL)
        })
      }
    } else {
      setRollingStates(new Array(dice.length).fill(false))
    }
  }, [dice, animate])

  const crits = dice.filter(d => d.grade === 'CRITICAL').length
  const hits = dice.filter(d => d.grade === 'NORMAL').length
  const fails = dice.filter(d => d.grade === 'FAIL').length

  return (
    <div className="dice-panel">
      <div className="dice-panel-stats">
        {showCrits && crits > 0 && <div className="stat-badge stat-crit stat-reveal">Crits <span className="stat-badge-val">{crits}</span></div>}
        {showHits && hits > 0 && <div className="stat-badge stat-hit stat-reveal">Hits <span className="stat-badge-val">{hits}</span></div>}
        {showFails && fails > 0 && <div className="stat-badge stat-fail stat-reveal">Fails <span className="stat-badge-val">{fails}</span></div>}
      </div>
      <div className="dice-container">
        {dice.map((d, i) => {
          const activeIndices = getActiveIndices()
          const delayIndex = activeIndices.indexOf(i)
          
          return (
            <div 
              key={`${d.seed || 'dice'}-${i}`} 
              className={`dice-entrance ${animate && activeIndices.includes(i) ? 'animated' : ''}`}
              style={(animate && activeIndices.includes(i)) ? { animationDelay: `${delayIndex * 50}ms`, cursor: onDieClick ? 'pointer' : 'default' } : { cursor: onDieClick ? 'pointer' : 'default' }}
              onClick={() => onDieClick?.(i)}
            >
              <DiceIcon
                dice={d}
                theme={theme}
                status={statuses[i] || (d.isRetained ? 'RETAINED' : undefined)}
                isRolling={rollingStates[i]}
              />
            </div>
          )
        })}
      </div>
      {onConfirm && showConfirm && (
        <div className="dice-action-area button-reveal">
          <button className="dice-confirm-btn" onClick={onConfirm}>
            Confirm Results
          </button>
        </div>
      )}
    </div>
  )
}
