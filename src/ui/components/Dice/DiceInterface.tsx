import { useState, useEffect } from 'react'
import { type DiceRoll, type RollContext, ElectronicDiceSource } from '../../../dice/source'
import { DicePanel } from './DicePanel'
import { useSettingsStore } from '../../../state/settingsStore'
import './DiceInterface.css'

export interface DiceInterfaceProps {
  count: number
  theme?: {
    baseColor: string
    pipColor: string
  }
  statuses?: Record<number, string>
  rollContext?: RollContext
  mode?: 'AUTO' | 'MANUAL'
  onConfirm: (rolls: DiceRoll[]) => void
}

export function DiceInterface({ count, theme, statuses, rollContext, mode, onConfirm }: DiceInterfaceProps) {
  const settingsRollMode = useSettingsStore(s => s.rollMode)
  const rollMode = mode ?? settingsRollMode
  
  // State for AUTO mode
  const [autoRolls, setAutoRolls] = useState<DiceRoll[]>([])
  const [isRolling, setIsRolling] = useState(false)
  
  // State for MANUAL mode
  const [manualRolls, setManualRolls] = useState<DiceRoll[]>([])
  const [manualPhase, setManualPhase] = useState<'INPUT' | 'RESULT'>('INPUT')

  // Reset state when count or mode changes
  useEffect(() => {
    setAutoRolls([])
    setIsRolling(false)
    setManualRolls([])
    setManualPhase('INPUT')
  }, [count, rollMode])

  const handleAutoRoll = () => {
    const source = new ElectronicDiceSource(Math.random() * 100000)
    const newRolls = source.roll(count, rollContext)
    setAutoRolls(newRolls)
    setIsRolling(true)
  }

  const handleManualPadClick = (val: 1|2|3|4|5|6) => {
    if (manualRolls.length >= count) return
    
    let grade: 'FAIL' | 'NORMAL' | 'CRITICAL' = 'FAIL'
    const ctx = rollContext || { hitTarget: 3, critTarget: 6 }
    if (val >= ctx.critTarget) grade = 'CRITICAL'
    else if (val >= ctx.hitTarget) grade = 'NORMAL'
    if (val === 1) grade = 'FAIL'
    
    const nextRolls = [...manualRolls, { nat: val, grade } as DiceRoll]
    setManualRolls(nextRolls)
  }

  const handleManualUndo = () => {
    setManualRolls(prev => prev.slice(0, -1))
  }

  const handleManualShowResult = () => {
    setManualPhase('RESULT')
  }

  const handleConfirm = () => {
    if (rollMode === 'AUTO') {
      onConfirm(autoRolls)
    } else {
      onConfirm(manualRolls)
    }
  }

  return (
    <div className="dice-interface-wrapper">
      {rollMode === 'AUTO' ? (
        <div className="auto-mode-container">
          {autoRolls.length === 0 ? (
            <button className="roll-dice-action-btn" onClick={handleAutoRoll}>
              ROLL {count} DICE
            </button>
          ) : (
            <div className="dice-display">
              <DicePanel 
                dice={autoRolls} 
                theme={theme} 
                animate={isRolling} 
                statuses={statuses} 
                onConfirm={handleConfirm}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="manual-mode-container">
          {manualPhase === 'INPUT' ? (
            <>
              <div className="manual-header">
                <h3>Manual Input: {manualRolls.length} / {count}</h3>
                <button className="undo-btn" onClick={handleManualUndo} disabled={manualRolls.length === 0}>
                  UNDO
                </button>
              </div>
              
              <div className="manual-keypad">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button 
                    key={n} 
                    className="keypad-btn" 
                    onClick={() => handleManualPadClick(n as 1|2|3|4|5|6)}
                    disabled={manualRolls.length >= count}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div className="manual-preview-simple">
                {manualRolls.length > 0 ? (
                  <div className="simple-dice-row">
                    {manualRolls.map((r, i) => (
                      <span key={i} className={`simple-die grade-${r.grade}`}>{r.nat}</span>
                    ))}
                  </div>
                ) : (
                  <div className="manual-empty-state">Select dice values using the keypad above</div>
                )}
              </div>

              {manualRolls.length === count && (
                <button className="roll-dice-action-btn" onClick={handleManualShowResult}>
                  SHOW RESULTS
                </button>
              )}
            </>
          ) : (
            <div className="dice-display">
              <DicePanel 
                dice={manualRolls} 
                theme={theme} 
                animate={true} 
                statuses={statuses} 
                onConfirm={handleConfirm}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
