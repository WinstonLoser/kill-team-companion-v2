import { type DiceRoll } from '../../../dice/source'
import './DiceIcon.css'

export interface DiceIconProps {
  dice: DiceRoll
  theme?: {
    baseColor: string
    pipColor: string
  }
  status?: string
  isRolling?: boolean
}

export function DiceIcon({ dice, theme, status, isRolling }: DiceIconProps) {
  const { nat, grade } = dice

  const baseColor = theme?.baseColor || '#333333'
  const pipColor = theme?.pipColor || '#ffffff'

  // CSS variables for theming
  const style = {
    '--dice-base': baseColor,
    '--dice-pip': pipColor,
  } as React.CSSProperties

  let gradeClass = ''
  if (grade === 'CRITICAL') {
    gradeClass = 'dice-critical'
  } else if (grade === 'FAIL') {
    gradeClass = 'dice-fail'
  }

  const rollingClass = isRolling ? 'dice-rolling' : ''

  return (
    <div className="dice-wrapper">
      {status && (
        <div className="dice-status" style={{ color: pipColor }}>
          {status}
        </div>
      )}
      <div className={`dice-icon ${gradeClass} ${rollingClass}`} style={style}>
        {/* Render dots or numbers. For simplicity we render the number, but we can do a standard 6-sided dice face using CSS grid. */}
        <div className={`dice-face dice-face-${nat}`}>
          {Array.from({ length: nat }).map((_, i) => (
            <span key={i} className="dice-dot" style={{ backgroundColor: pipColor }}></span>
          ))}
        </div>
      </div>
    </div>
  )
}
