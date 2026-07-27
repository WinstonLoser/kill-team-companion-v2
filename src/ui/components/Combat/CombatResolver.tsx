import { useState, useEffect } from 'react'
import { DiceInterface } from '../Dice/DiceInterface'
import { type DiceRoll, type RollContext } from '../../../dice/source'
import { type Pool } from '../../../engine/parry'
import { MeleeAllocationPanel } from './MeleeAllocationPanel'
import { UnitPortrait, type UnitPortraitProps } from '../UnitPortrait/UnitPortrait'
import { type Stratagem } from '../../../rules/types'

export interface CombatAction {
  id: string
  name: string
  cp: number
  description: string
  sourceType: 'FACTION' | 'OPERATIVE'
}

interface CombatResolverProps {
  mode: 'SHOOT' | 'MELEE'
  attackerName: string
  attackerPortrait?: UnitPortraitProps
  attackerCount: number
  attackerContext: RollContext
  attackerTheme: any
  attackerDamage?: { normal: number, critical: number }
  attackerModifiers?: string[]
  attackerRetainedDice?: DiceRoll[]
  defenderName: string
  defenderPortrait?: UnitPortraitProps
  defenderCount: number
  defenderContext: RollContext
  defenderTheme: any
  defenderDamage?: { normal: number, critical: number }
  defenderModifiers?: string[]
  defenderRetainedDice?: DiceRoll[]
  attackerActions?: CombatAction[]
  defenderActions?: CombatAction[]
  onActionActivated?: (action: CombatAction) => void
  rollMode?: 'AUTO' | 'MANUAL'
  onComplete?: (result: { 
    atkNats: number[]; 
    defNats?: number[]; 
    atkRolls?: {nat: number, grade: string}[]; 
    defRolls?: {nat: number, grade: string}[]; 
    manualAllocation?: { atkStrike: Pool; defStrike: Pool }; 
    damageDealt?: { normal: number, critical: number } 
  }) => void
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
  attackerModifiers,
  attackerRetainedDice,
  defenderName,
  defenderPortrait,
  defenderCount,
  defenderContext,
  defenderTheme,
  defenderDamage,
  defenderModifiers,
  defenderRetainedDice,
  attackerActions,
  defenderActions,
  onActionActivated,
  rollMode,
  onComplete,
  onCancel
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
      let normalDmg = (atkNormal * (attackerDamage?.normal || 3))
      let critDmg = (atkCrit * (attackerDamage?.critical || 4))
      let totalDmg = normalDmg + critDmg

      if (onComplete) {
        onComplete({ 
          atkNats: atkRolls.map(r => r.nat), 
          defNats: rolls.map(r => r.nat),
          atkRolls,
          defRolls: rolls,
          damageDealt: { normal: totalDmg, critical: 0 }
        })
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
        atkRolls,
        defRolls,
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
  const currentRetainedDice = isAttacker ? attackerRetainedDice : defenderRetainedDice
  const currentActions = isAttacker ? attackerActions : defenderActions
  
  // Modifiers like Cover and Vantage are relevant to the whole combat context,
  // so we combine them and show them in both phases.
  const allModifiers = [...(attackerModifiers || []), ...(defenderModifiers || [])]

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '1vh' }}>
      {isRolling && (
        <div key={phase} style={{ 
          width: '100%', maxWidth: '900px', flex: 1, minHeight: 0,
          background: 'var(--bg-surface)', padding: '16px', 
          borderRadius: 'var(--radius-lg)', border: `1px solid ${currentTheme?.baseColor || 'var(--border-hairline)'}`, 
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', paddingLeft: '16px', paddingRight: '16px' }}>
            {/* Left side: Portrait + Role info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {currentPortrait && (
                <UnitPortrait {...currentPortrait} scale={0.85} />
              )}
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: currentTheme?.baseColor || 'var(--accent-primary-hover)', fontSize: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px', fontWeight: 'bold' }}>
                  {currentRole} Roll (Need {currentCount})
                </div>
              </div>
            </div>

            {/* Right side: Firefight Ploys / Abilities */}
            {currentActions && currentActions.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%' }}>
                {currentActions.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onActionActivated && onActionActivated(p)}
                    style={{
                      background: p.sourceType === 'FACTION' ? 'var(--tint-danger)' : 'var(--tint-warning)',
                      color: p.sourceType === 'FACTION' ? 'var(--kc-blood-3)' : 'var(--kc-amber-3)', 
                      padding: '6px 12px', borderRadius: 'var(--radius-md)', 
                      border: `1px solid ${p.sourceType === 'FACTION' ? 'var(--status-danger)' : 'var(--status-warning)'}`, 
                      cursor: 'pointer',
                      fontSize: 'var(--text-body)', display: 'flex', flexDirection: 'column', alignItems: 'center'
                    }}
                    title={p.description}
                  >
                    <span style={{ fontWeight: 'bold' }}>
                      {p.sourceType === 'FACTION' ? '[阵营]' : '[特工]'} ⚡ {p.name} ({p.cp}CP)
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <DiceInterface
              count={currentCount}
              theme={currentTheme}
              rollContext={currentContext}
              mode={rollMode}
              modifiers={allModifiers}
              retainedDice={currentRetainedDice}
              onConfirm={currentConfirm}
            />
          </div>

        </div>
      )}

      {phase === 'ALLOCATION' && (
        <div style={{ width: '100%', maxWidth: '900px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
