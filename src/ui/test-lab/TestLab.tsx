import React, { useState, useEffect } from 'react';
import { OperativeCard } from '../components/OperativeCard/OperativeCard';
import { useLocaleStore } from '../../state/localeStore';
import { t } from '../../utils/i18n';
import './TestLab.css';

export function TestLab({ pack }: { pack: any }) {
  const [selectedOpId, setSelectedOpId] = useState(pack.operatives[0]?.operativeId);
  const [loadoutSelections, setLoadoutSelections] = useState<number[]>([]);
  const [factionRuleSelections, setFactionRuleSelections] = useState<Record<string, string[]>>({});
  const locale = useLocaleStore((s) => s.locale);

  const selectedOp = pack.operatives.find((o: any) => o.operativeId === selectedOpId);

  useEffect(() => {
    if (selectedOp && selectedOp.loadouts) {
      setLoadoutSelections(selectedOp.loadouts.map(() => 0)); // default to first option
    } else {
      setLoadoutSelections([]);
    }
  }, [selectedOpId, selectedOp]);

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

  return (
    <div className="test-lab-container">
      <div className="sidebar">
        <h2 className="sidebar-title">OPERATIVES</h2>
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
        <div className="ipad-canvas">
          {selectedOp ? <OperativeCard operative={selectedOp} pack={pack} selectedWeaponIds={selectedWeaponIds} factionRuleSelections={factionRuleSelections} /> : <div className="no-selection">Select an operative</div>}
        </div>
      </div>
    </div>
  );
}
