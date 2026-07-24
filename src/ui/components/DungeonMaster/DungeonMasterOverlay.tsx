import React, { useState, useEffect } from 'react'
import { useMatchStore, getMatchOperativeData, packOfFaction, type MatchToken } from '../../../state/matchStore'
import { type OperativeStats, type WeaponProfile } from '../../../rules/types'
import { t } from '../../../utils/i18n'
import { useLocaleStore } from '../../../state/localeStore'
import { getAvatarUrl } from '../../../utils/avatars'
import { UnitPortrait } from '../UnitPortrait/UnitPortrait'
import './DungeonMasterOverlay.css'

const COMMON_MARKERS = ['INJURED', 'POISON', 'STUNNED', 'OVERWATCH', 'FLY_CLOUD', 'MARK']

export function DungeonMasterOverlay({ onClose }: { onClose: () => void }) {
  const tokens = useMatchStore(s => s.tokens)
  const setTokenOverrides = useMatchStore(s => s.setTokenOverrides)
  const setTokenState = useMatchStore(s => s.setTokenState)
  const locale = useLocaleStore(s => s.locale)
  
  const [selectedUid, setSelectedUid] = useState<string | null>(tokens[0]?.uid ?? null)
  
  const [statOverrides, setStatOverrides] = useState<Partial<OperativeStats>>({})
  const [weaponOverrides, setWeaponOverrides] = useState<Record<string, Partial<WeaponProfile>>>({})
  const [currentTokenState, setCurrentTokenState] = useState<{ wounds: number, markers: string[] }>({ wounds: 0, markers: [] })

  const selectedData = selectedUid ? getMatchOperativeData(selectedUid) : null

  // Whenever a new operative is selected, pull in their current overrides to the local form state
  useEffect(() => {
    if (selectedData?.token) {
      setStatOverrides(selectedData.token.statOverrides ? { ...selectedData.token.statOverrides } : {})
      setWeaponOverrides(selectedData.token.weaponOverrides ? JSON.parse(JSON.stringify(selectedData.token.weaponOverrides)) : {})
      setCurrentTokenState({ wounds: selectedData.token.wounds, markers: [...selectedData.token.markers] })
    }
  }, [selectedUid])

  if (!selectedData) {
    return (
      <div className="dm-overlay">
        <div className="dm-container" style={{ padding: 24 }}>
          No operatives found on the board.
          <button onClick={onClose} className="dm-btn dm-btn-reset" style={{ marginTop: 24 }}>Close</button>
        </div>
      </div>
    )
  }

  const { operative, weapons, pack } = selectedData

  const move = statOverrides.move ?? operative.stats.move
  const apl = statOverrides.apl ?? operative.stats.apl
  const save = statOverrides.save ?? operative.stats.save
  const maxWounds = statOverrides.wounds ?? operative.stats.wounds

  const themeColor = pack.faction.theme?.ui?.primaryRgb ? `rgb(${pack.faction.theme.ui.primaryRgb})` : '#ff4444'
  const themeBorder = pack.faction.theme?.ui?.primaryRgb ? `rgba(${pack.faction.theme.ui.primaryRgb}, 0.4)` : 'rgba(255, 68, 68, 0.4)'

  function toggleMarker(marker: string) {
    setCurrentTokenState(prev => {
      const markers = prev.markers.includes(marker) 
        ? prev.markers.filter(m => m !== marker)
        : [...prev.markers, marker]
      return { ...prev, markers }
    })
  }

  function handleSave() {
    if (selectedUid) {
      setTokenOverrides(selectedUid, statOverrides, weaponOverrides)
      setTokenState(selectedUid, currentTokenState)
    }
  }

  function handleReset() {
    setStatOverrides({})
    setWeaponOverrides({})
    if (selectedUid) {
      setTokenOverrides(selectedUid, undefined, undefined)
    }
  }

  function updateWeaponProfile(weaponId: string, field: keyof WeaponProfile, value: number) {
    setWeaponOverrides(prev => {
      const currentWeapon = prev[weaponId] || {}
      return {
        ...prev,
        [weaponId]: {
          ...currentWeapon,
          [field]: value
        }
      }
    })
  }

  return (
    <div className="dm-overlay" onClick={onClose}>
      <div className="dm-container" onClick={e => e.stopPropagation()} style={{ borderColor: themeColor, boxShadow: `0 0 20px ${themeBorder}` }}>
        <div className="dm-header" style={{ background: themeColor }}>
          <h2>🎲 DUNGEON MASTER</h2>
          <button className="dm-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="dm-content">
          <div className="dm-sidebar">
            {tokens.map(token => {
              const opAvatar = getAvatarUrl(token.factionId, token.opId)
              const tokenPack = packOfFaction(token.factionId)
              const tColor = tokenPack.faction.theme?.ui?.primaryRgb ? `rgb(${tokenPack.faction.theme.ui.primaryRgb})` : '#ff4444'
              const tColorRgb = tokenPack.faction.theme?.ui?.primaryRgb || '255, 68, 68'
              
              return (
                <UnitPortrait
                  key={token.uid}
                  name={token.name}
                  currentWounds={token.wounds}
                  maxWounds={token.maxWounds}
                  statuses={token.markers}
                  themeColor={tColor}
                  themeColorRgb={tColorRgb}
                  avatarUrl={opAvatar}
                  locale={locale}
                  scale={0.8}
                  selected={selectedUid === token.uid}
                  onClick={() => setSelectedUid(token.uid)}
                />
              )
            })}
          </div>

          <div className="dm-editor">
            <div className="dm-section">
              <h3 style={{ color: themeColor }}>CURRENT STATE</h3>
              <div className="dm-grid">
                <div className="dm-field">
                  <label>Current HP (Wounds)</label>
                  <input type="number" value={currentTokenState.wounds} onChange={e => setCurrentTokenState({ ...currentTokenState, wounds: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="dm-field" style={{ gridColumn: 'span 2' }}>
                  <label>Markers (Toggles)</label>
                  <div className="dm-markers-row">
                    {COMMON_MARKERS.map(m => {
                      const isActive = currentTokenState.markers.includes(m)
                      return (
                        <button 
                          key={m}
                          className={`dm-marker-toggle ${isActive ? 'active' : ''}`}
                          style={isActive ? { background: themeColor, borderColor: themeColor, boxShadow: `0 0 10px ${themeBorder}` } : {}}
                          onClick={() => toggleMarker(m)}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="dm-section">
              <h3 style={{ color: themeColor }}>BASE STATS OVERRIDES</h3>
              <div className="dm-grid">
                <div className="dm-field">
                  <label>M (Movement)</label>
                  <input type="number" value={move} onChange={e => setStatOverrides({ ...statOverrides, move: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="dm-field">
                  <label>APL</label>
                  <input type="number" value={apl} onChange={e => setStatOverrides({ ...statOverrides, apl: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="dm-field">
                  <label>SV (Save)</label>
                  <input type="number" value={save} onChange={e => setStatOverrides({ ...statOverrides, save: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="dm-field">
                  <label>Max W (Wounds)</label>
                  <input type="number" value={maxWounds} onChange={e => setStatOverrides({ ...statOverrides, wounds: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>

            <div className="dm-section">
              <h3 style={{ color: themeColor }}>WEAPONS OVERRIDES</h3>
              {weapons.map(w => {
                const profile = w.profile
                if (!profile) return null
                
                const wId = w.weaponId
                const override = weaponOverrides[wId] || {}
                
                const attacks = override.attacks ?? profile.attacks
                const hit = override.hit ?? profile.hit
                const normalDamage = override.normalDamage ?? profile.normalDamage
                const criticalDamage = override.criticalDamage ?? profile.criticalDamage

                return (
                  <div key={wId} className="dm-weapon-card">
                    <h4>{t(w.name, locale)} ({w.kind})</h4>
                    <div className="dm-grid">
                      <div className="dm-field">
                        <label>A (Attacks)</label>
                        <input type="number" value={attacks} onChange={e => updateWeaponProfile(wId, 'attacks', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="dm-field">
                        <label>WS/BS</label>
                        <input type="number" value={hit} onChange={e => updateWeaponProfile(wId, 'hit', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="dm-field">
                        <label>D (Normal)</label>
                        <input type="number" value={normalDamage} onChange={e => updateWeaponProfile(wId, 'normalDamage', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="dm-field">
                        <label>D (Crit)</label>
                        <input type="number" value={criticalDamage} onChange={e => updateWeaponProfile(wId, 'criticalDamage', parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="dm-actions">
              <button className="dm-btn dm-btn-reset" onClick={handleReset}>Clear Overrides</button>
              <button className="dm-btn dm-btn-save" style={{ background: themeColor }} onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
