import { useState, useEffect } from 'react'
import { DiceInterface } from '../Dice/DiceInterface'
import { type DiceRoll, type RollContext } from '../../../dice/source'
import { type Pool } from '../../../engine/parry'
import { MeleeAllocationPanel } from './MeleeAllocationPanel'
import { UnitPortrait, type UnitPortraitProps } from '../UnitPortrait/UnitPortrait'

interface CombatResolverProps {
  mode: 'SHOOT' | 'MELEE'
  attackerName: string
  attackerPortrait?: UnitPortraitProps
  attackerCount: number
  attackerContext: RollContext
  attackerTheme: any
  attackerDamage?: { normal: number, critical: number }
  defenderName: string
  defenderPortrait?: UnitPortraitProps
  defenderCount: number // Melee attacks or Shoot defense base
  defenderContext: RollContext
  defenderTheme: any
  defenderDamage?: { normal: number, critical: number }
  rollMode?: 'AUTO' | 'MANUAL'
  onComplete?: (result: { atkNats: number[]; defNats?: number[]; manualAllocation?: { atkStrike: Pool; defStrike: Pool } }) => void
  onCancel?: () => void
}

type Phase = 'ATTACKER_ROLL' | 'DEFENDER_ROLL' | 'ALLOCATION'

export function CombatResolver({
  mode,
  attackerName,
  attackerPortrait,
  attackerCount,
  attackerContext,
  attackerTheme,
  attackerDamage,
  defenderName,
  defenderPortrait,
  defenderCount,
  defenderContext,
  defenderTheme,
  defenderDamage,
  rollMode,
  onComplete,
}: CombatResolverProps) {
  const [phase, setPhase] = useState<Phase>('ATTACKER_ROLL')
  const [atkRolls, setAtkRolls] = useState<DiceRoll[]>([])
  const [defRolls, setDefRolls] = useState<DiceRoll[]>([])

  // Reset when props change
  useEffect(() => {
    setPhase('ATTACKER_ROLL')
    setAtkRolls([])
    setDefRolls([])
  }, [mode, attackerCount, defenderCount])

  const handleAttackerConfirm = (rolls: DiceRoll[]) => {
    setAtkRolls(rolls)
    setPhase('DEFENDER_ROLL')
  }

  const handleDefenderConfirm = (rolls: DiceRoll[]) => {
    setDefRolls(rolls)
    if (mode === 'SHOOT') {
      // Resolve shooting
      let atkNormal = atkRolls.filter(r => r.grade === 'NORMAL').length
      let atkCrit = atkRolls.filter(r => r.grade === 'CRITICAL').length

      let defNormal = rolls.filter(r => r.grade === 'NORMAL').length
      let defCrit = rolls.filter(r => r.grade === 'CRITICAL').length

      // Simple auto-parry logic for shooting defense
      // Crit def -> blocks crit atk
      // Normal def -> blocks normal atk, 2 normal def -> blocks crit atk
      while (defCrit > 0 && atkCrit > 0) { defCrit--; atkCrit--; }
      while (defCrit > 0 && atkNormal > 0) { defCrit--; atkNormal--; }
      while (defNormal >= 2 && atkCrit > 0) { defNormal -= 2; atkCrit--; }
      while (defNormal > 0 && atkNormal > 0) { defNormal--; atkNormal--; }

      // In shooting, no allocation. Complete immediately!
      if (onComplete) {
        onComplete({ atkNats: atkRolls.map(r => r.nat), defNats: rolls.map(r => r.nat) })
      }
    } else {
      setPhase('ALLOCATION')
    }
  }

  const handleAllocationConfirm = (atkStrike: Pool, defStrike: Pool) => {
    if (onComplete) {
      onComplete({
        atkNats: atkRolls.map(r => r.nat),
        defNats: defRolls.map(r => r.nat),
        manualAllocation: { atkStrike, defStrike }
      })
    }
  }

  const isRolling = phase === 'ATTACKER_ROLL' || phase === 'DEFENDER_ROLL'
  const isAttacker = phase === 'ATTACKER_ROLL'

  const currentPortrait = isAttacker ? attackerPortrait : defenderPortrait
  const currentName = isAttacker ? attackerName : defenderName
  const currentRole = isAttacker ? 'Attacker' : 'Defender'
  const currentCount = isAttacker ? attackerCount : (mode === 'SHOOT' ? 3 : defenderCount)
  const currentTheme = isAttacker ? attackerTheme : defenderTheme
  const currentContext = isAttacker ? attackerContext : defenderContext
  const currentConfirm = isAttacker ? handleAttackerConfirm : handleDefenderConfirm

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '4vh' }}>
      {isRolling && (
        <div key={phase} style={{ 
          width: '100%', maxWidth: '900px', flex: 1, 
          background: '#1e1e1e', padding: '24px', 
          borderRadius: '12px', border: `1px solid ${currentTheme?.baseColor || '#444'}`, 
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
          boxShadow: `0 0 20px ${currentTheme?.baseColor || '#444'}33`
        }}>
          <div style={{ borderBottom: '1px solid #555', paddingBottom: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px', justifyContent: 'center' }}>
            {currentPortrait && (
              <UnitPortrait {...currentPortrait} scale={1.1} />
            )}
            <div style={{ textAlign: 'left' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '2rem' }}>{currentName}</h2>
              <div style={{ color: currentTheme?.baseColor || '#ffaa77', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '4px', fontWeight: 'bold' }}>
                {currentRole} Roll
              </div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <DiceInterface
              count={currentCount}
              theme={currentTheme}
              rollContext={currentContext}
              mode={rollMode}
              onConfirm={currentConfirm}
            />
          </div>
        </div>
      )}

      {phase === 'ALLOCATION' && (
        <div style={{ width: '100%', maxWidth: '900px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MeleeAllocationPanel
            attackerName={attackerName}
            attackerPortrait={attackerPortrait}
            attackerDamage={attackerDamage}
            defenderName={defenderName}
            defenderPortrait={defenderPortrait}
            defenderDamage={defenderDamage}
            attackerPool={{
              normal: atkRolls.filter(r => r.grade === 'NORMAL').length,
              critical: atkRolls.filter(r => r.grade === 'CRITICAL').length
            }}
            defenderPool={{
              normal: defRolls.filter(r => r.grade === 'NORMAL').length,
              critical: defRolls.filter(r => r.grade === 'CRITICAL').length
            }}
            onConfirm={handleAllocationConfirm}
          />
        </div>
      )}
    </div>
  )
}
