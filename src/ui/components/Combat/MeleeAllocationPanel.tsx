import { useState } from 'react'
import { type Pool } from '../../../engine/parry'
import { UnitPortrait, type UnitPortraitProps } from '../UnitPortrait/UnitPortrait'

interface MeleeAllocationPanelProps {
  attackerName: string
  attackerPortrait?: UnitPortraitProps
  attackerDamage?: { normal: number, critical: number }
  defenderName: string
  defenderPortrait?: UnitPortraitProps
  defenderDamage?: { normal: number, critical: number }
  attackerPool: Pool
  defenderPool: Pool
  onConfirm: (attackerStrike: Pool, defenderStrike: Pool) => void
}

export function MeleeAllocationPanel({
  attackerName,
  attackerPortrait,
  attackerDamage = { normal: 3, critical: 4 },
  defenderName,
  defenderPortrait,
  defenderDamage = { normal: 3, critical: 4 },
  attackerPool,
  defenderPool,
  onConfirm
}: MeleeAllocationPanelProps) {
  const [atkRemaining, setAtkRemaining] = useState<Pool>({ ...attackerPool })
  const [defRemaining, setDefRemaining] = useState<Pool>({ ...defenderPool })
  const [atkStrike, setAtkStrike] = useState<Pool>({ normal: 0, critical: 0 })
  const [defStrike, setDefStrike] = useState<Pool>({ normal: 0, critical: 0 })
  
  const [atkCurrentWounds, setAtkCurrentWounds] = useState(attackerPortrait?.currentWounds ?? 10)
  const [defCurrentWounds, setDefCurrentWounds] = useState(defenderPortrait?.currentWounds ?? 10)
  
  const [log, setLog] = useState<string[]>([])
  const [activeTurn, setActiveTurn] = useState<'ATTACKER' | 'DEFENDER'>('ATTACKER')

  // Helper to determine who should go next
  const switchTurn = (current: 'ATTACKER' | 'DEFENDER', newAtkRemaining: Pool, newDefRemaining: Pool) => {
    const atkHasDice = newAtkRemaining.normal > 0 || newAtkRemaining.critical > 0
    const defHasDice = newDefRemaining.normal > 0 || newDefRemaining.critical > 0
    
    if (current === 'ATTACKER' && defHasDice) setActiveTurn('DEFENDER')
    else if (current === 'DEFENDER' && atkHasDice) setActiveTurn('ATTACKER')
    // If the other person has no dice, keep turn on current (or game ends if both empty)
  }

  // Simple parry logic: 
  // 1 Normal parries 1 Normal. 1 Crit parries 1 Crit or 1 Normal. 2 Normals parry 1 Crit.
  const handleAction = (actor: 'ATTACKER' | 'DEFENDER', action: 'STRIKE' | 'PARRY' | 'PARRY_CRIT_WITH_2_NORMALS', grade: 'NORMAL' | 'CRITICAL') => {
    if (activeTurn !== actor) return // Guard against clicking when not active
    if (atkCurrentWounds <= 0 || defCurrentWounds <= 0) return // Dead men don't strike

    const actorPool = actor === 'ATTACKER' ? atkRemaining : defRemaining
    const targetPool = actor === 'ATTACKER' ? defRemaining : atkRemaining
    const setActor = actor === 'ATTACKER' ? setAtkRemaining : setDefRemaining
    const setTarget = actor === 'ATTACKER' ? setDefRemaining : setAtkRemaining
    const setStrike = actor === 'ATTACKER' ? setAtkStrike : setDefStrike

    if (actorPool[grade.toLowerCase() as keyof Pool] <= 0) return

    if (action === 'STRIKE') {
      // Consume 1 die, add to strike pool
      const newActorPool = { ...actorPool, [grade.toLowerCase()]: actorPool[grade.toLowerCase() as keyof Pool] - 1 }
      setActor(newActorPool)
      setStrike(prev => ({ ...prev, [grade.toLowerCase()]: prev[grade.toLowerCase() as keyof Pool] + 1 }))
      
      const dmg = actor === 'ATTACKER' ? attackerDamage[grade.toLowerCase() as keyof Pool] : defenderDamage[grade.toLowerCase() as keyof Pool]
      
      if (actor === 'ATTACKER') {
        setDefCurrentWounds(prev => Math.max(0, prev - dmg))
      } else {
        setAtkCurrentWounds(prev => Math.max(0, prev - dmg))
      }
      
      setLog(prev => [...prev, `${actor === 'ATTACKER' ? attackerName : defenderName} STRIKES with a ${grade} (${dmg} damage)`])
      switchTurn(actor, actor === 'ATTACKER' ? newActorPool : atkRemaining, actor === 'DEFENDER' ? newActorPool : defRemaining)
    } else if (action === 'PARRY_CRIT_WITH_2_NORMALS') {
      // Use 2 Normals to parry 1 Critical
      if (actorPool.normal >= 2 && targetPool.critical >= 1) {
        const newActorPool = { ...actorPool, normal: actorPool.normal - 2 }
        const newTargetPool = { ...targetPool, critical: targetPool.critical - 1 }
        setActor(newActorPool)
        setTarget(newTargetPool)
        setLog(prev => [...prev, `${actor === 'ATTACKER' ? attackerName : defenderName} PARRIES a CRITICAL using 2 NORMALs`])
        switchTurn(actor, actor === 'ATTACKER' ? newActorPool : newTargetPool, actor === 'DEFENDER' ? newActorPool : newTargetPool)
      }
    } else {
      // Parry
      // Need to choose what to parry if there are options, but for this prototype we auto-select the best target
        if (grade === 'CRITICAL') {
        if (targetPool.critical > 0) {
          const newTargetPool = { ...targetPool, critical: targetPool.critical - 1 }
          const newActorPool = { ...actorPool, critical: actorPool.critical - 1 }
          setTarget(newTargetPool)
          setActor(newActorPool)
          setLog(prev => [...prev, `${actor === 'ATTACKER' ? attackerName : defenderName} PARRIES a CRITICAL with a CRITICAL`])
          switchTurn(actor, actor === 'ATTACKER' ? newActorPool : newTargetPool, actor === 'DEFENDER' ? newActorPool : newTargetPool)
        } else if (targetPool.normal > 0) {
          const newTargetPool = { ...targetPool, normal: targetPool.normal - 1 }
          const newActorPool = { ...actorPool, critical: actorPool.critical - 1 }
          setTarget(newTargetPool)
          setActor(newActorPool)
          setLog(prev => [...prev, `${actor === 'ATTACKER' ? attackerName : defenderName} PARRIES a NORMAL with a CRITICAL`])
          switchTurn(actor, actor === 'ATTACKER' ? newActorPool : newTargetPool, actor === 'DEFENDER' ? newActorPool : newTargetPool)
        } else {
          return // Nothing to parry
        }
      } else {
        // grade === 'NORMAL'
        if (targetPool.normal > 0) {
          const newTargetPool = { ...targetPool, normal: targetPool.normal - 1 }
          const newActorPool = { ...actorPool, normal: actorPool.normal - 1 }
          setTarget(newTargetPool)
          setActor(newActorPool)
          setLog(prev => [...prev, `${actor === 'ATTACKER' ? attackerName : defenderName} PARRIES a NORMAL with a NORMAL`])
          switchTurn(actor, actor === 'ATTACKER' ? newActorPool : newTargetPool, actor === 'DEFENDER' ? newActorPool : newTargetPool)
        }
      }
    }
  }

  const isDone = (atkRemaining.normal === 0 && atkRemaining.critical === 0 && 
                  defRemaining.normal === 0 && defRemaining.critical === 0) ||
                 atkCurrentWounds <= 0 || defCurrentWounds <= 0

  return (
    <div style={{ flex: 1, width: '100%', background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <h2 style={{ textAlign: 'center', color: 'var(--text-primary)', marginBottom: '16px' }}>Melee Allocation</h2>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '48px', flex: 1 }}>
        {/* Attacker Column */}
        <div style={{ flex: 1, border: '1px solid var(--bg-surface-raised)', padding: '16px', borderRadius: 'var(--radius-lg)', background: 'var(--accent-primary-muted)', opacity: activeTurn === 'ATTACKER' ? 1 : 0.3, transition: 'opacity 0.3s ease' }}>
          <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {attackerPortrait ? (
              <UnitPortrait {...attackerPortrait} currentWounds={atkCurrentWounds} scale={1.1} />
            ) : (
              <h3 style={{ fontSize: 'var(--text-display-md)', color: 'var(--accent-primary-hover)', margin: 0 }}>{attackerName} (Attacker)</h3>
            )}
            {activeTurn === 'ATTACKER' && <span style={{ fontSize: 'var(--text-subtitle)', background: 'var(--accent-primary)', color: 'var(--text-on-accent)', padding: '4px 12px', borderRadius: 'var(--radius-lg)', fontWeight: 'bold' }}>YOUR TURN</span>}
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', marginBottom: '4px' }}>Available Dice:</p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ background: 'var(--bg-surface-raised)', padding: '12px', borderRadius: 'var(--radius-lg)', textAlign: 'center', flex: 1 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)' }}>NORMAL</div>
                <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-display-lg)', fontWeight: 'bold' }}>{atkRemaining.normal}</div>
              </div>
              <div style={{ background: 'var(--bg-surface-raised)', padding: '12px', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--status-warning-hover)', flex: 1 }}>
                <div style={{ color: 'var(--status-warning-hover)', fontSize: 'var(--text-body)' }}>CRITICAL</div>
                <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-display-lg)', fontWeight: 'bold' }}>{atkRemaining.critical}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              disabled={activeTurn !== 'ATTACKER' || atkRemaining.normal <= 0}
              onClick={() => handleAction('ATTACKER', 'STRIKE', 'NORMAL')}
              style={{ fontSize: 'var(--text-title)', background: 'var(--border-hairline)', color: 'var(--text-primary)', border: 'none', padding: '16px', borderRadius: 'var(--radius-lg)', cursor: (activeTurn === 'ATTACKER' && atkRemaining.normal > 0) ? 'pointer' : 'not-allowed' }}
            >
              Strike (Normal)
            </button>
            <button 
              disabled={activeTurn !== 'ATTACKER' || atkRemaining.critical <= 0}
              onClick={() => handleAction('ATTACKER', 'STRIKE', 'CRITICAL')}
              style={{ fontSize: 'var(--text-title)', background: 'var(--kc-amber-1)', color: 'var(--status-warning-hover)', border: '1px solid var(--status-warning-hover)', padding: '16px', borderRadius: 'var(--radius-lg)', cursor: (activeTurn === 'ATTACKER' && atkRemaining.critical > 0) ? 'pointer' : 'not-allowed' }}
            >
              Strike (Critical)
            </button>
            <button 
              disabled={activeTurn !== 'ATTACKER' || atkRemaining.normal <= 0 || defRemaining.normal <= 0}
              onClick={() => handleAction('ATTACKER', 'PARRY', 'NORMAL')}
              style={{ background: 'var(--bg-surface-raised)', color: 'var(--text-primary)', border: 'none', padding: '8px', borderRadius: 'var(--radius-md)', cursor: (activeTurn === 'ATTACKER' && atkRemaining.normal > 0 && defRemaining.normal > 0) ? 'pointer' : 'not-allowed' }}
            >
              Parry Normal (uses 1 Normal)
            </button>
            <button 
              disabled={activeTurn !== 'ATTACKER' || atkRemaining.normal < 2 || defRemaining.critical < 1}
              onClick={() => handleAction('ATTACKER', 'PARRY_CRIT_WITH_2_NORMALS', 'NORMAL')}
              style={{ fontSize: 'var(--text-title)', background: 'var(--kc-olive-1)', color: 'var(--status-success-hover)', border: '1px dashed var(--status-success-hover)', padding: '16px', borderRadius: 'var(--radius-lg)', cursor: (activeTurn === 'ATTACKER' && atkRemaining.normal >= 2 && defRemaining.critical >= 1) ? 'pointer' : 'not-allowed' }}
            >
              Parry 1 Crit with 2 Normals
            </button>
            <button 
              disabled={activeTurn !== 'ATTACKER' || atkRemaining.normal <= 0 || (defRemaining.normal <= 0 && defRemaining.critical <= 0)}
              onClick={() => handleAction('ATTACKER', 'PARRY', 'NORMAL')}
              style={{ fontSize: 'var(--text-title)', background: 'var(--kc-olive-1)', color: 'var(--status-success-hover)', border: '1px solid var(--status-success-hover)', padding: '16px', borderRadius: 'var(--radius-lg)', cursor: (activeTurn === 'ATTACKER' && atkRemaining.normal > 0 && (defRemaining.normal > 0 || defRemaining.critical > 0)) ? 'pointer' : 'not-allowed' }}
            >
              Parry with Normal
            </button>
          </div>
        </div>

        {/* Defender Column */}
        <div style={{ flex: 1, border: '1px solid var(--bg-surface-raised)', padding: '16px', borderRadius: 'var(--radius-lg)', background: 'var(--tint-success)', opacity: activeTurn === 'DEFENDER' ? 1 : 0.3, transition: 'opacity 0.3s ease' }}>
          <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {defenderPortrait ? (
              <UnitPortrait {...defenderPortrait} currentWounds={defCurrentWounds} scale={1.1} />
            ) : (
              <h3 style={{ fontSize: 'var(--text-display-md)', color: 'var(--status-success-hover)', margin: 0 }}>{defenderName} (Defender)</h3>
            )}
            {activeTurn === 'DEFENDER' && <span style={{ fontSize: 'var(--text-subtitle)', background: 'var(--status-success-hover)', color: 'var(--text-on-accent)', padding: '4px 12px', borderRadius: 'var(--radius-lg)', fontWeight: 'bold' }}>YOUR TURN</span>}
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', marginBottom: '4px' }}>Available Dice:</p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ background: 'var(--bg-surface-raised)', padding: '12px', borderRadius: 'var(--radius-lg)', textAlign: 'center', flex: 1 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)' }}>NORMAL</div>
                <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-display-lg)', fontWeight: 'bold' }}>{defRemaining.normal}</div>
              </div>
              <div style={{ background: 'var(--bg-surface-raised)', padding: '12px', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--status-warning-hover)', flex: 1 }}>
                <div style={{ color: 'var(--status-warning-hover)', fontSize: 'var(--text-body)' }}>CRITICAL</div>
                <div style={{ color: 'var(--text-primary)', fontSize: 'var(--text-display-lg)', fontWeight: 'bold' }}>{defRemaining.critical}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              disabled={activeTurn !== 'DEFENDER' || defRemaining.normal <= 0}
              onClick={() => handleAction('DEFENDER', 'STRIKE', 'NORMAL')}
              style={{ fontSize: 'var(--text-title)', background: 'var(--border-hairline)', color: 'var(--text-primary)', border: 'none', padding: '16px', borderRadius: 'var(--radius-lg)', cursor: (activeTurn === 'DEFENDER' && defRemaining.normal > 0) ? 'pointer' : 'not-allowed' }}
            >
              Strike (Normal)
            </button>
            <button 
              disabled={activeTurn !== 'DEFENDER' || defRemaining.critical <= 0}
              onClick={() => handleAction('DEFENDER', 'STRIKE', 'CRITICAL')}
              style={{ fontSize: 'var(--text-title)', background: 'var(--kc-amber-1)', color: 'var(--status-warning-hover)', border: '1px solid var(--status-warning-hover)', padding: '16px', borderRadius: 'var(--radius-lg)', cursor: (activeTurn === 'DEFENDER' && defRemaining.critical > 0) ? 'pointer' : 'not-allowed' }}
            >
              Strike (Critical)
            </button>
            <button 
              disabled={activeTurn !== 'DEFENDER' || defRemaining.normal <= 0 || atkRemaining.normal <= 0}
              onClick={() => handleAction('DEFENDER', 'PARRY', 'NORMAL')}
              style={{ background: 'var(--bg-surface-raised)', color: 'var(--text-primary)', border: 'none', padding: '8px', borderRadius: 'var(--radius-md)', cursor: (activeTurn === 'DEFENDER' && defRemaining.normal > 0 && atkRemaining.normal > 0) ? 'pointer' : 'not-allowed' }}
            >
              Parry Normal (uses 1 Normal)
            </button>
            <button 
              disabled={activeTurn !== 'DEFENDER' || defRemaining.normal < 2 || atkRemaining.critical < 1}
              onClick={() => handleAction('DEFENDER', 'PARRY_CRIT_WITH_2_NORMALS', 'NORMAL')}
              style={{ fontSize: 'var(--text-title)', background: 'var(--kc-olive-1)', color: 'var(--status-success-hover)', border: '1px dashed var(--status-success-hover)', padding: '16px', borderRadius: 'var(--radius-lg)', cursor: (activeTurn === 'DEFENDER' && defRemaining.normal >= 2 && atkRemaining.critical >= 1) ? 'pointer' : 'not-allowed' }}
            >
              Parry 1 Crit with 2 Normals
            </button>
            <button 
              disabled={activeTurn !== 'DEFENDER' || defRemaining.normal <= 0 || (atkRemaining.normal <= 0 && atkRemaining.critical <= 0)}
              onClick={() => handleAction('DEFENDER', 'PARRY', 'NORMAL')}
              style={{ fontSize: 'var(--text-title)', background: 'var(--kc-olive-1)', color: 'var(--status-success-hover)', border: '1px solid var(--status-success-hover)', padding: '16px', borderRadius: 'var(--radius-lg)', cursor: (activeTurn === 'DEFENDER' && defRemaining.normal > 0 && (atkRemaining.normal > 0 || atkRemaining.critical > 0)) ? 'pointer' : 'not-allowed' }}
            >
              Parry with Normal
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px', background: 'var(--text-on-accent)', padding: '12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-surface-raised)', maxHeight: '120px', overflowY: 'auto' }}>
        <h4 style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: 'var(--text-body-sm)', textTransform: 'uppercase' }}>Combat Log</h4>
        {log.map((l, i) => (
          <div key={i} style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)', marginBottom: '4px' }}>{l}</div>
        ))}
        {log.length === 0 && <div style={{ color: 'var(--border-default)', fontSize: 'var(--text-body)', fontStyle: 'italic' }}>Waiting for actions...</div>}
      </div>

      {isDone && (
        <div style={{ marginTop: '16px', textAlign: 'center', position: 'sticky', bottom: 0, paddingBottom: '8px', background: 'var(--bg-surface)' }}>
          <button 
            onClick={() => onConfirm(atkStrike, defStrike)}
            className="ds-btn ds-btn--lg" style={{ background: 'var(--status-success)', borderColor: 'var(--status-success)' }}
          >
            CONFIRM ALLOCATION
          </button>
        </div>
      )}
    </div>
  )
}
