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
  modifiers?: string[]
  retainedDice?: DiceRoll[]
  onConfirm: (rolls: DiceRoll[]) => void
}

type Phase = 'PREPARE' | 'ROLLING_MANUAL' | 'MODIFY' | 'MODIFY_MANUAL'

function getGrade(val: number, ctx?: RollContext): 'FAIL' | 'NORMAL' | 'CRITICAL' {
  let grade: 'FAIL' | 'NORMAL' | 'CRITICAL' = 'FAIL'
  const c = ctx || { hitTarget: 3, critTarget: 6 }
  if (val >= c.critTarget) grade = 'CRITICAL'
  else if (val >= c.hitTarget) grade = 'NORMAL'
  if (val === 1) grade = 'FAIL'
  return grade
}

export function DiceInterface({ count: initialCount, theme, statuses, rollContext, mode, modifiers, retainedDice = [], onConfirm }: DiceInterfaceProps) {
  const settingsRollMode = useSettingsStore(s => s.rollMode)
  const rollMode = mode ?? settingsRollMode
  
  const [phase, setPhase] = useState<Phase>('PREPARE')
  const [totalCount, setTotalCount] = useState(initialCount)
  const [slots, setSlots] = useState<(number | null)[]>([])
  const [finalRolls, setFinalRolls] = useState<DiceRoll[]>([])
  
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  // For manual input (rolling missing or rerolling)
  const [manualInputQueue, setManualInputQueue] = useState<number[]>([]) // indices waiting for input
  const [animatingIndices, setAnimatingIndices] = useState<number[] | undefined>(undefined)

  const [localContext, setLocalContext] = useState<RollContext>(rollContext || { hitTarget: 3, critTarget: 6 })

  useEffect(() => {
    if (rollContext) setLocalContext(rollContext)
  }, [rollContext?.hitTarget, rollContext?.critTarget])

  const retainedDiceStr = JSON.stringify(retainedDice)

  useEffect(() => {
    setPhase('PREPARE')
    setTotalCount(initialCount)
    // Initialize slots with retained dice, pad rest with null
    const initSlots: (number | null)[] = Array(initialCount).fill(null)
    retainedDice.forEach((d, i) => {
      if (i < initialCount) initSlots[i] = d.nat
    })
    setSlots(initSlots)
    setFinalRolls([])
    setEditingIndex(null)
    setManualInputQueue([])
    setAnimatingIndices(undefined)
  }, [initialCount, rollMode, retainedDiceStr])

  const handleAdjustCount = (delta: number) => {
    const newCount = Math.max(1, totalCount + delta)
    setTotalCount(newCount)
    setSlots(prev => {
      if (newCount > prev.length) {
        return [...prev, ...Array(newCount - prev.length).fill(null)]
      } else {
        return prev.slice(0, newCount)
      }
    })
  }

  const handleCycleSlot = (index: number) => {
    setSlots(prev => {
      const next = [...prev]
      const cur = next[index]
      if (cur === undefined || cur === null) next[index] = 1
      else if (cur < 6) next[index] = cur + 1
      else next[index] = null
      return next
    })
  }

  const handleRoll = () => {
    const missingIndices = slots.map((val, i) => val === null ? i : -1).filter(i => i !== -1)
    
    if (missingIndices.length === 0) {
      // All slots pre-determined
      const newRolls = slots.map((val) => ({
        nat: val as 1|2|3|4|5|6,
        grade: getGrade(val!, localContext),
        isRetained: true // Pre-set by user means it's retained
      }))
      setFinalRolls(newRolls)
      setPhase('MODIFY')
      return
    }

    if (rollMode === 'AUTO') {
      const source = new ElectronicDiceSource(Math.random() * 100000)
      const randomVals = source.roll(missingIndices.length, localContext)
      
      const newRolls: DiceRoll[] = slots.map((val) => {
        if (val !== null) {
          return { nat: val as 1|2|3|4|5|6, grade: getGrade(val, localContext), isRetained: true }
        } else {
          const r = randomVals.shift()!
          return r
        }
      })
      setFinalRolls(newRolls)
      setAnimatingIndices(undefined) // Will animate all non-retained
      setPhase('MODIFY')
    } else {
      // Manual input for missing slots
      setManualInputQueue(missingIndices)
      const newRolls = slots.map(val => val !== null ? { nat: val, grade: getGrade(val, localContext), isRetained: true } : null) as DiceRoll[]
      setFinalRolls(newRolls)
      setPhase('ROLLING_MANUAL')
    }
  }

  const handleManualPadClick = (val: 1|2|3|4|5|6) => {
    if (phase === 'ROLLING_MANUAL') {
      const queue = [...manualInputQueue]
      const index = queue.shift()
      if (index !== undefined) {
        setFinalRolls(prev => {
          const next = [...prev]
          next[index] = { nat: val, grade: getGrade(val, localContext) }
          return next
        })
        setManualInputQueue(queue)
        if (queue.length === 0) {
          setAnimatingIndices([]) // Manual input doesn't animate
          setPhase('MODIFY')
        }
      }
    } else if (phase === 'MODIFY_MANUAL') {
      if (editingIndex !== null) {
        setFinalRolls(prev => {
          const next = [...prev]
          next[editingIndex] = { ...next[editingIndex], nat: val, grade: getGrade(val, localContext) }
          return next
        })
        setEditingIndex(null)
        setAnimatingIndices([]) // Manual edit, no animation
        setPhase('MODIFY')
      }
    }
  }

  const handleDieClick = (index: number) => {
    if (phase === 'MODIFY') {
      setEditingIndex(index)
    }
  }

  const handleEditVal = (val: number | 'REROLL') => {
    if (editingIndex === null) return
    if (val === 'REROLL') {
      if (rollMode === 'AUTO') {
        const source = new ElectronicDiceSource(Math.random() * 10000)
        const [r] = source.roll(1, localContext)
        setFinalRolls(prev => {
          const next = [...prev]
          next[editingIndex] = { ...r, isRetained: true }
          return next
        })
        setAnimatingIndices([editingIndex])
        setEditingIndex(null)
      } else {
        setPhase('MODIFY_MANUAL')
      }
    } else {
      setFinalRolls(prev => {
        const next = [...prev]
        next[editingIndex] = { ...next[editingIndex], nat: val as 1|2|3|4|5|6, grade: getGrade(val as number, localContext) }
        return next
      })
      setAnimatingIndices([])
      setEditingIndex(null)
    }
  }

  const renderModifiers = () => {
    if (!modifiers || modifiers.length === 0) return null
    return (
      <div style={{ width: '100%', maxWidth: '800px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', borderLeft: `4px solid ${theme?.baseColor || '#fff'}`, marginBottom: '16px', textAlign: 'left' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#ccc', fontSize: '0.9rem' }}>当前生效规则修正 (Modifiers)</h4>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#aaa', fontSize: '0.85rem' }}>
          {modifiers.map((mod, i) => (
            <li key={i} style={{ marginBottom: '4px' }}>{mod}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="dice-interface-wrapper">
      {renderModifiers()}

      <div style={{ textAlign: 'center', marginBottom: '8px', color: '#ffaa77', fontWeight: 'bold' }}>
        【预期阈值】 命中(Hit): {localContext.hitTarget}+ | 暴击(Crit): {localContext.critTarget}+
      </div>

      {phase === 'PREPARE' && (
        <div className="prepare-container">
          <div className="prepare-header">
            <h3 style={{ margin: 0 }}>准备骰子数量: {totalCount}</h3>
            <button className="count-btn" onClick={() => handleAdjustCount(-1)} disabled={totalCount <= 1}>-</button>
            <button className="count-btn" onClick={() => handleAdjustCount(1)}>+</button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-around', margin: '12px 0', background: '#333', padding: '8px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem' }}>命中(Hit)</span>
              <button className="count-btn" style={{ width: '24px', height: '24px', padding: 0 }} onClick={() => setLocalContext(prev => ({...prev, hitTarget: Math.max(2, prev.hitTarget - 1)}))}>-</button>
              <span style={{ width: '20px', textAlign: 'center' }}>{localContext.hitTarget}+</span>
              <button className="count-btn" style={{ width: '24px', height: '24px', padding: 0 }} onClick={() => setLocalContext(prev => ({...prev, hitTarget: Math.min(6, prev.hitTarget + 1)}))}>+</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem' }}>暴击(Crit)</span>
              <button className="count-btn" style={{ width: '24px', height: '24px', padding: 0 }} onClick={() => setLocalContext(prev => ({...prev, critTarget: Math.max(2, prev.critTarget - 1)}))}>-</button>
              <span style={{ width: '20px', textAlign: 'center' }}>{localContext.critTarget}+</span>
              <button className="count-btn" style={{ width: '24px', height: '24px', padding: 0 }} onClick={() => setLocalContext(prev => ({...prev, critTarget: Math.min(6, prev.critTarget + 1)}))}>+</button>
            </div>
          </div>

          <p style={{ color: '#aaa', fontSize: '0.9rem', margin: '4px 0 12px 0' }}>点击下方骰槽以固定点数结果 (针对必中或保留技能)</p>
          <div className="prepare-slots">
            {slots.map((val, i) => (
              <div 
                key={i} 
                className={`prepare-slot ${val !== null ? 'is-set' : ''}`}
                onClick={() => handleCycleSlot(i)}
                style={val !== null ? { borderColor: theme?.baseColor || '#ff9800', color: '#ffffff', backgroundColor: theme?.baseColor ? theme.baseColor.replace('rgb(', 'rgba(').replace(')', ', 0.2)') : 'rgba(255,152,0,0.2)' } : { color: '#ffffff' }}
              >
                {val === null ? '?' : val}
              </div>
            ))}
          </div>
          <button className="roll-dice-action-btn" onClick={handleRoll} style={{ marginTop: '20px' }}>
            {slots.some(s => s === null) ? (rollMode === 'AUTO' ? '自动投掷运气骰' : '进入手动输入') : '应用固定结果'}
          </button>
        </div>
      )}

      {(phase === 'ROLLING_MANUAL' || phase === 'MODIFY_MANUAL') && (
        <div className="manual-mode-container">
          <div className="manual-header">
            <h3>
              {phase === 'ROLLING_MANUAL' 
                ? `Manual Input: ${slots.length - manualInputQueue.length} / ${slots.length}`
                : `Enter new value for die`}
            </h3>
          </div>
          
          <div className="manual-keypad">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button 
                key={n} 
                className="keypad-btn" 
                onClick={() => handleManualPadClick(n as 1|2|3|4|5|6)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'MODIFY' && (
        <div className="modify-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '16px' }}>可以点击骰子修改结算结果 (应对重投技能或修正)</p>
          <div className="dice-display">
            <DicePanel 
              dice={finalRolls} 
              theme={theme} 
              animate={true} 
              statuses={statuses} 
              onDieClick={handleDieClick}
              onConfirm={() => onConfirm(finalRolls)}
              animatingIndices={animatingIndices}
            />
          </div>

          {editingIndex !== null && (
            <div className="edit-popup-overlay" onClick={() => setEditingIndex(null)}>
              <div className="edit-popup" onClick={e => e.stopPropagation()}>
                <h4>修改第 {editingIndex + 1} 颗骰子</h4>
                <div className="edit-popup-options">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <button key={n} className="edit-opt-btn" onClick={() => handleEditVal(n as 1|2|3|4|5|6)}>{n}</button>
                  ))}
                  <button className="edit-opt-btn" onClick={() => handleEditVal('REROLL')} style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                    重投 (Re-roll)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
