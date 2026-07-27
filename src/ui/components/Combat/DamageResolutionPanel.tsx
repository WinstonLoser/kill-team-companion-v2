import { useState } from 'react'
import { UnitPortrait, type UnitPortraitProps } from '../UnitPortrait/UnitPortrait'
import { DiceIcon } from '../Dice/DiceIcon'
import { useLocaleStore } from '../../../state/localeStore'

export interface DamageResolutionPanelProps {
  attackerPortrait: UnitPortraitProps
  defenderPortrait: UnitPortraitProps
  atkNats?: number[]
  defNats?: number[]
  atkRolls?: { nat: number, grade: string }[]
  defRolls?: { nat: number, grade: string }[]
  initialAtkDamage: number
  initialDefDamage: number
  onConfirm: (result: {
    atkDamage: number
    defDamage: number
    atkMarkers: string[]
    defMarkers: string[]
  }) => void
  onCancel: () => void
}

const COMMON_MARKERS = ['INJURED', 'APL -1', 'APL +1', 'POISON']

export function DamageResolutionPanel({
  attackerPortrait,
  defenderPortrait,
  atkNats = [],
  defNats = [],
  atkRolls = [],
  defRolls = [],
  initialAtkDamage,
  initialDefDamage,
  onConfirm,
  onCancel
}: DamageResolutionPanelProps) {
  const [atkDamage, setAtkDamage] = useState(initialAtkDamage)
  const [defDamage, setDefDamage] = useState(initialDefDamage)
  
  const [atkMarkers, setAtkMarkers] = useState<string[]>([])
  const [defMarkers, setDefMarkers] = useState<string[]>([])

  const toggleMarker = (side: 'atk' | 'def', marker: string) => {
    if (side === 'atk') {
      setAtkMarkers(prev => prev.includes(marker) ? prev.filter(m => m !== marker) : [...prev, marker])
    } else {
      setDefMarkers(prev => prev.includes(marker) ? prev.filter(m => m !== marker) : [...prev, marker])
    }
  }

  const { locale } = useLocaleStore()
  const t = {
    confirmCasualties: locale === 'zh' ? '确认伤亡' : 'Confirm Casualties',
    attacker: locale === 'zh' ? '攻击方' : 'Attacker',
    defender: locale === 'zh' ? '防守方' : 'Defender',
    damageTaken: locale === 'zh' ? '造成伤害' : 'Damage Taken',
    remainingWounds: locale === 'zh' ? '剩余血量' : 'Remaining Wounds',
    addStatus: locale === 'zh' ? '添加状态' : 'Add Status',
    confirmResult: locale === 'zh' ? '确认结果' : 'Confirm Result',
    undoAction: locale === 'zh' ? '回滚上步' : 'Undo Action',
  }

  const renderSide = (
    portrait: UnitPortraitProps, 
    damage: number, 
    setDamage: (n: number) => void,
    nats: number[],
    rolls: { nat: number, grade: string }[],
    markers: string[],
    side: 'atk' | 'def'
  ) => {
    const finalWounds = Math.max(0, portrait.currentWounds - damage)
    const themeColor = portrait.themeColorRgb ? `rgb(${portrait.themeColorRgb})` : (side === 'atk' ? 'var(--accent-primary)' : 'var(--status-success-hover)')
    return (
      <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: `2px solid ${themeColor}` }}>
        <h3 style={{ margin: 0, color: themeColor, fontSize: 'var(--text-subtitle)' }}>{side === 'atk' ? t.attacker : t.defender}</h3>
        
        <UnitPortrait {...portrait} currentWounds={finalWounds} scale={1.0} />
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', minHeight: '40px' }}>
          {nats.map((n, i) => {
            const grade = rolls[i]?.grade || (n >= 5 ? 'CRITICAL' : (n >= 3 ? 'NORMAL' : 'FAIL'))
            return (
              <div key={i} style={{ width: '40px', height: '40px', position: 'relative' }}>
                <div style={{ transform: 'scale(0.4)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                  <DiceIcon dice={{ nat: n as any, grade: grade as any }} theme={{ baseColor: portrait.themeColorRgb ? `rgb(${portrait.themeColorRgb})` : 'var(--border-default)', pipColor: 'var(--text-primary)' }} />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ background: 'var(--bg-panel-inset)', padding: '12px', borderRadius: 'var(--radius-lg)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)' }}>{t.damageTaken}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="secondary" onClick={() => setDamage(Math.max(0, damage - 1))} style={{ width: '40px', height: '40px', fontSize: 'var(--text-title)', padding: 0 }}>-</button>
            <span style={{ fontSize: 'var(--text-display-lg)', fontWeight: 'bold', color: damage > 0 ? 'var(--kc-blood-3)' : 'var(--text-primary)', minWidth: '40px', textAlign: 'center' }}>{damage}</span>
            <button className="secondary" onClick={() => setDamage(damage + 1)} style={{ width: '40px', height: '40px', fontSize: 'var(--text-title)', padding: 0 }}>+</button>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body-sm)' }}>{t.remainingWounds}: {finalWounds} / {portrait.maxWounds}</div>
        </div>

        <div style={{ width: '100%' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)', marginBottom: '8px', textAlign: 'center' }}>{t.addStatus}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {COMMON_MARKERS.map(m => (
              <button 
                key={m}
                onClick={() => toggleMarker(side, m)}
                style={{ 
                  background: markers.includes(m) ? themeColor : 'var(--bg-surface-raised)', 
                  color: markers.includes(m) ? 'var(--text-on-accent)' : 'var(--text-primary)', 
                  border: 'none', 
                  padding: '4px 12px', 
                  borderRadius: 'var(--radius-lg)', 
                  cursor: 'pointer',
                  fontWeight: markers.includes(m) ? 'bold' : 'normal'
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11, 11, 12, 0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '95vw', maxWidth: '850px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-strong)', borderTop: '3px solid var(--accent-primary)' }}>
        
        <h2 style={{ margin: 0, color: 'var(--text-primary)', textAlign: 'center', fontSize: 'var(--text-display-md)' }}>{t.confirmCasualties}</h2>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'nowrap' }}>
          {renderSide(attackerPortrait, atkDamage, setAtkDamage, atkNats, atkRolls, atkMarkers, 'atk')}
          {renderSide(defenderPortrait, defDamage, setDefDamage, defNats, defRolls, defMarkers, 'def')}
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
          <button className="primary" style={{ flex: 2, padding: '16px', fontSize: 'var(--text-title)', fontWeight: 'bold' }} onClick={() => onConfirm({ atkDamage, defDamage, atkMarkers, defMarkers })}>
            {t.confirmResult}
          </button>
          <button className="secondary" style={{ flex: 1, padding: '16px', fontSize: 'var(--text-title)' }} onClick={onCancel}>
            {t.undoAction}
          </button>
        </div>
        
      </div>
    </div>
  )
}
