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
    const themeColor = portrait.themeColorRgb ? `rgb(${portrait.themeColorRgb})` : (side === 'atk' ? '#ff5a00' : '#4ade80')
    return (
      <div style={{ flex: 1, minWidth: 0, background: '#222', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: `2px solid ${themeColor}` }}>
        <h3 style={{ margin: 0, color: themeColor, fontSize: '1.1rem' }}>{side === 'atk' ? t.attacker : t.defender}</h3>
        
        <UnitPortrait {...portrait} currentWounds={finalWounds} scale={1.0} />
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', minHeight: '40px' }}>
          {nats.map((n, i) => {
            const grade = rolls[i]?.grade || (n >= 5 ? 'CRITICAL' : (n >= 3 ? 'NORMAL' : 'FAIL'))
            return (
              <div key={i} style={{ width: '40px', height: '40px', position: 'relative' }}>
                <div style={{ transform: 'scale(0.4)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                  <DiceIcon dice={{ nat: n as any, grade: grade as any }} theme={{ baseColor: portrait.themeColorRgb ? `rgb(${portrait.themeColorRgb})` : '#555', pipColor: '#fff' }} />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ background: '#111', padding: '12px', borderRadius: '8px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ color: '#aaa', fontSize: '0.9rem' }}>{t.damageTaken}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="secondary" onClick={() => setDamage(Math.max(0, damage - 1))} style={{ width: '40px', height: '40px', fontSize: '1.2rem', padding: 0 }}>-</button>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: damage > 0 ? '#ff5c5c' : '#fff', minWidth: '40px', textAlign: 'center' }}>{damage}</span>
            <button className="secondary" onClick={() => setDamage(damage + 1)} style={{ width: '40px', height: '40px', fontSize: '1.2rem', padding: 0 }}>+</button>
          </div>
          <div style={{ color: '#888', fontSize: '0.8rem' }}>{t.remainingWounds}: {finalWounds} / {portrait.maxWounds}</div>
        </div>

        <div style={{ width: '100%' }}>
          <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px', textAlign: 'center' }}>{t.addStatus}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {COMMON_MARKERS.map(m => (
              <button 
                key={m}
                onClick={() => toggleMarker(side, m)}
                style={{ 
                  background: markers.includes(m) ? themeColor : '#333', 
                  color: markers.includes(m) ? '#000' : '#fff', 
                  border: 'none', 
                  padding: '4px 12px', 
                  borderRadius: '16px', 
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '95vw', maxWidth: '850px', backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #444', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
        
        <h2 style={{ margin: 0, color: '#fff', textAlign: 'center', fontSize: '1.5rem' }}>{t.confirmCasualties}</h2>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'nowrap' }}>
          {renderSide(attackerPortrait, atkDamage, setAtkDamage, atkNats, atkRolls, atkMarkers, 'atk')}
          {renderSide(defenderPortrait, defDamage, setDefDamage, defNats, defRolls, defMarkers, 'def')}
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
          <button className="primary" style={{ flex: 2, padding: '16px', fontSize: '1.2rem', fontWeight: 'bold' }} onClick={() => onConfirm({ atkDamage, defDamage, atkMarkers, defMarkers })}>
            {t.confirmResult}
          </button>
          <button className="secondary" style={{ flex: 1, padding: '16px', fontSize: '1.2rem' }} onClick={onCancel}>
            {t.undoAction}
          </button>
        </div>
        
      </div>
    </div>
  )
}
