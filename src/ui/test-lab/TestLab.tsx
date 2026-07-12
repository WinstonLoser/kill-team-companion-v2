import { useState, useEffect } from 'react';
import { OperativeCard } from '../components/OperativeCard/OperativeCard';
import { useLocaleStore } from '../../state/localeStore';
import { t } from '../../utils/i18n';
import './TestLab.css';
import { useSettingsStore } from '../../state/settingsStore';
import { CombatResolver } from '../components/Combat/CombatResolver';

export function TestLab({ packs }: { packs: { id: string; name: string; pack: any }[] }) {
  const [packId, setPackId] = useState<string>(packs[0]?.id ?? '')
  const pack = packs.find((p) => p.id === packId)?.pack ?? packs[0]?.pack
  const [selectedOpId, setSelectedOpId] = useState(pack?.operatives[0]?.operativeId);
  const [loadoutSelections, setLoadoutSelections] = useState<number[]>([]);
  const [factionRuleSelections, setFactionRuleSelections] = useState<Record<string, string[]>>({});
  const locale = useLocaleStore((s) => s.locale);

  // Dice Test State
  const [diceTheme, setDiceTheme] = useState({ baseColor: '#1e1e1e', pipColor: '#e0e0e0' })
  const [testRollCount, setTestRollCount] = useState(4)
  const [testRollContext, setTestRollContext] = useState<any | undefined>()
  const [activeWeaponId, setActiveWeaponId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'card' | 'dice'>('card')
  const [combatMode, setCombatMode] = useState<'SHOOT' | 'MELEE'>('SHOOT')
  const [defenderState, setDefenderState] = useState({ save: 3, wounds: 10 })
  const { rollMode, setRollMode } = useSettingsStore()

  const selectedOp = pack?.operatives.find((o: any) => o.operativeId === selectedOpId);

  // 切阵营：重置特工选择和骰子主题
  useEffect(() => {
    if (pack) {
      setSelectedOpId(pack.operatives[0]?.operativeId ?? '')
      if (pack.faction.theme?.dice) {
        setDiceTheme(pack.faction.theme.dice)
      } else {
        setDiceTheme({ baseColor: '#1e1e1e', pipColor: '#e0e0e0' })
      }
    }
  }, [packId, pack])
  
  useEffect(() => {
    if (selectedOp && selectedOp.loadouts) {
      setLoadoutSelections(selectedOp.loadouts.map(() => 0)); // default to first option
    } else {
      setLoadoutSelections([]);
    }
  }, [selectedOpId, selectedOp, packId]);

  if (!pack) return null;

  const handleSelectionChange = (loadoutIndex: number, optionIndex: number) => {
    const newSelections = [...loadoutSelections];
    newSelections[loadoutIndex] = optionIndex;
    setLoadoutSelections(newSelections);
  };

  let selectedWeaponIds: string[] = [];
  if (selectedOp && selectedOp.loadouts) {
    selectedOp.loadouts.forEach((loadout: any, index: number) => {
      const selectedOptionIndex = loadoutSelections[index] || 0;
      const optionWeapons = loadout.options[selectedOptionIndex] || [];
      selectedWeaponIds = [...selectedWeaponIds, ...optionWeapons];
    });
  }

  const activeWeapons = pack.weapons.filter((w: any) => selectedWeaponIds.includes(w.weaponId))

  const handleWeaponClick = (w: any) => {
    const lethalRule = w.profile.weaponRules?.find((r: string) => r.startsWith('Lethal '))
    const critTarget = lethalRule ? parseInt(lethalRule.replace('Lethal ', '')) || 6 : 6;
    setTestRollCount(w.profile.attacks)
    setTestRollContext({ hitTarget: w.profile.hit, critTarget })
    setActiveWeaponId(w.weaponId)
  }

  // Auto-select the first weapon when active weapons change
  useEffect(() => {
    if (activeWeapons.length > 0 && (!activeWeaponId || !selectedWeaponIds.includes(activeWeaponId))) {
      handleWeaponClick(activeWeapons[0])
    } else if (activeWeapons.length === 0) {
      setActiveWeaponId(null)
      setTestRollContext(undefined)
    }
  }, [selectedWeaponIds.join(',')])

  const uiTheme = pack.faction.theme?.ui || { primaryRgb: '255, 90, 0', textHighlight: '#ffaa77' }

  return (
    <div 
      className="test-lab-container"
      style={{
        '--theme-primary-rgb': uiTheme.primaryRgb,
        '--theme-text-highlight': uiTheme.textHighlight,
      } as React.CSSProperties}
    >
      <div className="sidebar">
        <div className="tl-section">
          <h2 className="sidebar-title">FACTIONS</h2>
          <select className="loadout-select" value={packId} onChange={(e) => setPackId(e.target.value)}>
            {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <h2 className="sidebar-title" style={{ marginTop: '8px' }}>OPERATIVES</h2>
        <ul className="op-list">
          {pack.operatives.map((o: any) => (
            <li 
              key={o.operativeId} 
              className={`op-list-item ${selectedOpId === o.operativeId ? 'active' : ''}`}
              onClick={() => setSelectedOpId(o.operativeId)}
            >
              {t(o.name, locale)}
            </li>
          ))}
        </ul>

        {selectedOp && selectedOp.loadouts && (
          <div className="loadout-section">
            <h2 className="sidebar-title" style={{ marginTop: '8px' }}>LOADOUT</h2>
            {selectedOp.loadouts.map((loadout: any, lIndex: number) => (
              <div key={lIndex} className="loadout-group">
                <div className="loadout-desc">{t(loadout.description, locale)}</div>
                {loadout.options.length > 1 ? (
                  <div className="loadout-options">
                    <select 
                      className="loadout-select"
                      value={loadoutSelections[lIndex]}
                      onChange={(e) => handleSelectionChange(lIndex, parseInt(e.target.value))}
                    >
                      {loadout.options.map((optWeapons: string[], oIndex: number) => {
                        const primaryWeapon = pack.weapons.find((w: any) => w.weaponId === optWeapons[0]);
                        return (
                          <option key={oIndex} value={oIndex}>
                            {primaryWeapon ? t(primaryWeapon.name, locale) : 'Option ' + (oIndex + 1)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <div className="loadout-fixed">
                    {loadout.options[0].map((wid: string) => {
                      const w = pack.weapons.find((wx: any) => wx.weaponId === wid);
                      return w ? <div key={wid} className="fixed-weapon">• {t(w.name, locale)}</div> : null;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {pack.factionRules && pack.factionRules.length > 0 && (
          <div className="loadout-section">
            <h2 className="sidebar-title" style={{ marginTop: '8px' }}>FACTION RULES</h2>
            {pack.factionRules.map((rule: any) => {
              if (!rule.options || rule.options.length === 0) return null;
              const limit = rule.selectionLimit || 1;
              const selectedIds = factionRuleSelections[rule.ruleId] || [];

              const handleRuleSelect = (slotIndex: number, optId: string) => {
                setFactionRuleSelections(prev => {
                  const current = [...(prev[rule.ruleId] || [])];
                  while (current.length < limit) current.push('');
                  current[slotIndex] = optId;
                  return { ...prev, [rule.ruleId]: current.filter(Boolean) };
                });
              };

              const slots = Array.from({ length: limit }, (_, i) => i);

              return (
                <div key={rule.ruleId} className="loadout-group">
                  <div className="loadout-desc">{t(rule.name, locale)} (Select {limit})</div>
                  <div className="loadout-options">
                    {slots.map(slotIndex => (
                      <select 
                        key={slotIndex}
                        className="loadout-select"
                        value={selectedIds[slotIndex] || ''}
                        onChange={(e) => handleRuleSelect(slotIndex, e.target.value)}
                      >
                        <option value="">-- Select Option --</option>
                        {rule.options.map((opt: any) => (
                          <option key={opt.id} value={opt.id}>{t(opt.name, locale)}</option>
                        ))}
                      </select>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="canvas-area">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
          <button 
            onClick={() => setActiveTab('card')}
            style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: activeTab === 'card' ? '#333' : 'transparent', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Operative Card
          </button>
          <button 
            onClick={() => setActiveTab('dice')}
            style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: activeTab === 'dice' ? '#333' : 'transparent', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Dice Interface
          </button>
        </div>

        {activeTab === 'card' && (
          <div className="ipad-canvas">
            {selectedOp ? <OperativeCard operative={selectedOp} pack={pack} selectedWeaponIds={selectedWeaponIds} factionRuleSelections={factionRuleSelections} /> : <div className="no-selection">Select an operative</div>}
          </div>
        )}

        {activeTab === 'dice' && (
          <div className="dice-test-section" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="test-controls" style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid #444', marginBottom: '24px' }}>
              
              <h3 style={{ color: '#aaa', marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Operative Weapons (Click to load stats)</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {activeWeapons.length > 0 ? activeWeapons.map((w: any) => {
                  const isActive = activeWeaponId === w.weaponId;
                  return (
                  <button 
                    key={w.weaponId}
                    onClick={() => handleWeaponClick(w)}
                    style={{ 
                      background: isActive ? 'rgba(var(--theme-primary-rgb, 255, 255, 255), 0.2)' : '#222', 
                      border: `1px solid ${isActive ? 'rgba(var(--theme-primary-rgb, 255, 255, 255), 0.8)' : '#666'}`, 
                      color: isActive ? '#fff' : '#eee', 
                      padding: '8px 12px', 
                      borderRadius: '4px', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      transition: 'all 0.2s',
                      boxShadow: isActive ? '0 0 10px rgba(var(--theme-primary-rgb, 255, 255, 255), 0.3)' : 'none'
                    }}
                    onMouseOver={(e) => !isActive && (e.currentTarget.style.borderColor = '#aaa')}
                    onMouseOut={(e) => !isActive && (e.currentTarget.style.borderColor = '#666')}
                  >
                    <span style={{ fontWeight: 'bold' }}>{t(w.name, locale)}</span>
                    <span style={{ fontSize: '0.8rem', color: isActive ? '#ccc' : '#aaa', marginTop: '4px' }}>A:{w.profile.attacks} BS:{w.profile.hit}+ {w.profile.weaponRules?.includes('Lethal 5+') ? '(Lethal 5+)' : ''}</span>
                  </button>
                )}) : <span style={{ color: '#666' }}>No weapons available</span>}
              </div>

              <h3 style={{ color: '#aaa', marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', borderTop: '1px solid #444', paddingTop: '16px' }}>Global Settings & Mocks</h3>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'white' }}>
                  <label>Roll Mode:</label>
                  <select 
                    value={rollMode} 
                    onChange={(e) => setRollMode(e.target.value as any)}
                    style={{ background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '4px' }}
                  >
                    <option value="AUTO">Automatic (Animated)</option>
                    <option value="MANUAL">Manual (Keypad)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'white' }}>
                  <label>Test Dice Count:</label>
                  <input type="number" min="1" max="20" value={testRollCount} onChange={e => setTestRollCount(parseInt(e.target.value) || 1)} style={{ width: '50px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '4px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'white' }}>
                  <label>Context:</label>
                  <span style={{ background: '#333', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                    Hit: {testRollContext?.hitTarget ?? 3}+ | Crit: {testRollContext?.critTarget ?? 6}+
                  </span>
                </div>
                
                {/* Defender Settings */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#39d98a', marginLeft: '16px', paddingLeft: '16px', borderLeft: '1px solid #444' }}>
                  <label>Def Save:</label>
                  <input type="number" min="2" max="6" value={defenderState.save} onChange={e => setDefenderState({...defenderState, save: parseInt(e.target.value) || 3})} style={{ width: '40px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '4px' }} />
                  <span style={{ fontSize: '0.8rem' }}>+</span>
                  <label style={{ marginLeft: '8px' }}>Wounds:</label>
                  <input type="number" min="1" max="25" value={defenderState.wounds} onChange={e => setDefenderState({...defenderState, wounds: parseInt(e.target.value) || 10})} style={{ width: '50px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '4px' }} />
                </div>

                {/* Combat Mode */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'white', marginLeft: '16px' }}>
                  <label>Mode:</label>
                  <select 
                    value={combatMode} 
                    onChange={(e) => setCombatMode(e.target.value as 'SHOOT' | 'MELEE')}
                    style={{ background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '4px' }}
                  >
                    <option value="SHOOT">Shoot</option>
                    <option value="MELEE">Melee</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#ccc', fontSize: '0.85rem', marginLeft: 'auto' }}>
                  <label>Theme Override:</label>
                  <input type="color" value={diceTheme.baseColor} onChange={(e) => setDiceTheme({...diceTheme, baseColor: e.target.value})} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} />
                  <input type="color" value={diceTheme.pipColor} onChange={(e) => setDiceTheme({...diceTheme, pipColor: e.target.value})} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} />
                </div>
              </div>
            </div>
            
            <div className="dice-display-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <CombatResolver 
                mode={combatMode}
                attackerName={selectedOp ? t(selectedOp.name, locale) : 'Attacker'}
                attackerCount={testRollCount}
                attackerContext={testRollContext ?? { hitTarget: 3, critTarget: 6 }}
                attackerTheme={diceTheme}
                defenderName="Target Dummy"
                defenderCount={combatMode === 'MELEE' ? testRollCount : 3} 
                defenderContext={{ hitTarget: defenderState.save, critTarget: 6 }}
                defenderTheme={{ baseColor: '#5cff8c', pipColor: '#1e1e1e' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
