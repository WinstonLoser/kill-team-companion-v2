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
  const swapOperativeClass = useMatchStore(s => s.swapOperativeClass)
  const setTokenWeapons = useMatchStore(s => s.setTokenWeapons)
  const locale = useLocaleStore(s => s.locale)
  
  const [selectedUid, setSelectedUid] = useState<string | null>(tokens[0]?.uid ?? null)
  const [customMarker, setCustomMarker] = useState('')
  
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

  const themeColor = pack.faction.theme?.ui?.primaryRgb ? `rgb(${pack.faction.theme.ui.primaryRgb})` : 'var(--accent-primary)'
  const themeBorder = pack.faction.theme?.ui?.primaryRgb ? `rgba(${pack.faction.theme.ui.primaryRgb}, 0.4)` : 'var(--accent-primary-muted)'

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
      <div className="dm-container" onClick={e => e.stopPropagation()} style={{ borderColor: themeColor }}>
        <div className="dm-header" style={{ background: themeColor }}>
          <h2>🎲 DUNGEON MASTER</h2>
          <button className="dm-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="dm-content">
          <div className="dm-sidebar">
            {tokens.map(token => {
              const opAvatar = getAvatarUrl(token.factionId, token.opId)
              const tokenPack = packOfFaction(token.factionId)
              const tColor = tokenPack.faction.theme?.ui?.primaryRgb ? `rgb(${tokenPack.faction.theme.ui.primaryRgb})` : 'var(--accent-primary)'
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
                  <label>Markers (Toggles & Custom)</label>
                  <div className="dm-markers-row">
                    {Array.from(new Set([...COMMON_MARKERS, ...currentTokenState.markers])).map(m => {
                      const isActive = currentTokenState.markers.includes(m)
                      return (
                        <button 
                          key={m}
                          className={`dm-marker-toggle ${isActive ? 'active' : ''}`}
                          style={isActive ? { background: themeColor, borderColor: themeColor } : {}}
                          onClick={() => toggleMarker(m)}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="自定义标签名称..." 
                      value={customMarker} 
                      onChange={(e) => setCustomMarker(e.target.value)} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customMarker.trim()) {
                          const newTag = customMarker.trim().toUpperCase();
                          if (!currentTokenState.markers.includes(newTag)) {
                            toggleMarker(newTag);
                          }
                          setCustomMarker('');
                        }
                      }}
                    />
                    <button 
                      className="dm-btn" 
                      style={{ padding: '8px 12px', background: themeColor, color: 'var(--text-primary)' }}
                      onClick={() => {
                        if (customMarker.trim()) {
                          const newTag = customMarker.trim().toUpperCase();
                          if (!currentTokenState.markers.includes(newTag)) {
                            toggleMarker(newTag);
                          }
                          setCustomMarker('');
                        }
                      }}
                    >添加</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="dm-section">
              <h3 style={{ color: themeColor }}>CLASS & LOADOUT</h3>
              <div className="dm-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="dm-field">
                  <label>Operative Class</label>
                  <select 
                    value={selectedData.token.opId}
                    onChange={(e) => {
                      swapOperativeClass(selectedData.token.uid, e.target.value);
                    }}
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: `1px solid ${themeBorder}`, padding: '8px', borderRadius: 'var(--radius-md)' }}
                  >
                    {selectedData.pack.operatives.map(o => (
                      <option key={o.operativeId} value={o.operativeId}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="dm-field">
                  <label>Equipped Weapons</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {selectedData.pack.weapons.map(w => {
                      const isEquipped = selectedData.token.weapons?.includes(w.weaponId) || (!selectedData.token.weapons?.length && (w.kind === 'RANGED' || w.kind === 'MELEE'));
                      return (
                        <label key={w.weaponId} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isEquipped ? 'var(--border-hairline)' : 'transparent', padding: '4px 8px', borderRadius: 'var(--radius-md)', border: `1px solid ${isEquipped ? themeColor : 'var(--border-hairline)'}`, cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={isEquipped}
                            onChange={(e) => {
                              let newWeapons = selectedData.token.weapons || [];
                              if (e.target.checked) {
                                newWeapons = [...newWeapons, w.weaponId];
                              } else {
                                newWeapons = newWeapons.filter(id => id !== w.weaponId);
                              }
                              setTokenWeapons(selectedData.token.uid, newWeapons);
                            }}
                            style={{ accentColor: themeColor }}
                          />
                          {w.name}
                        </label>
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
