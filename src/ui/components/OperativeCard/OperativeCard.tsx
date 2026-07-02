import React from 'react';
import './OperativeCard.css';

export function OperativeCard({ operative, pack, selectedWeaponIds, factionRuleSelections, avatarUrl }: { operative: any, pack: any, selectedWeaponIds: string[], factionRuleSelections?: Record<string, string[]>, avatarUrl?: string }) {
  if (!operative) return null;

  const weapons = selectedWeaponIds.map((ref: string) => pack.weapons.find((w: any) => w.weaponId === ref)).filter(Boolean);
  const abilities = (operative.abilityRefs || []).map((ref: string) => pack.abilities?.find((a: any) => a.abilityId === ref)).filter(Boolean);
  const factionRules = (operative.factionRuleRefs || []).map((ref: string) => pack.factionRules?.find((r: any) => r.ruleId === ref)).filter(Boolean);

  const rangedWeapons = weapons.filter((w: any) => w.kind === 'RANGED');
  const meleeWeapons = weapons.filter((w: any) => w.kind === 'MELEE');

  return (
    <div className="op-card-container">
      <div className="op-card-header">
        <div className="op-header-left">
          <div className="op-avatar-wrapper" id={`avatar-${operative.operativeId}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={operative.name} className="op-avatar-image" />
            ) : (
              <div className="op-avatar-placeholder">
                <span className="avatar-icon">👤</span>
              </div>
            )}
          </div>
          <div className="op-title-area">
            <h1 className="op-name">{operative.name}</h1>
            <div className="op-keywords">
              {operative.keywords.map((kw: string) => <span key={kw} className="keyword-tag">{kw}</span>)}
            </div>
          </div>
        </div>
        
        <div className="op-stats-panel">
          <div className="stat-hex">
            <span className="stat-value">{operative.stats.move}"</span>
            <span className="stat-label">M</span>
          </div>
          <div className="stat-hex">
            <span className="stat-value">{operative.stats.apl}</span>
            <span className="stat-label">APL</span>
          </div>
          <div className="stat-hex">
            <span className="stat-value">{operative.stats.save}+</span>
            <span className="stat-label">SV</span>
          </div>
          <div className="stat-hex">
            <span className="stat-value">{operative.stats.wounds}</span>
            <span className="stat-label">W</span>
          </div>
        </div>
      </div>

      <div className="op-body">
        <div className="weapons-section">
          <WeaponTable title="RANGED WEAPONS" weapons={rangedWeapons} icon="⌖" />
          <WeaponTable title="MELEE WEAPONS" weapons={meleeWeapons} icon="⚔" />
        </div>

        <div className="rules-section">
          {abilities.length > 0 && (
            <div className="rule-block">
              <h3 className="rule-header">ABILITIES</h3>
              <div className="rule-list">
                {abilities.map((a: any) => (
                  <div key={a.abilityId} className="rule-item">
                    <span className="rule-name">{a.name}</span>
                    <span className="rule-desc">{a.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {factionRules.length > 0 && (
            <div className="rule-block">
              <h3 className="rule-header">FACTION RULES</h3>
              <div className="rule-list">
                {factionRules.map((r: any) => {
                  if (r.options && factionRuleSelections && factionRuleSelections[r.ruleId] && factionRuleSelections[r.ruleId].length > 0) {
                    const selectedOpts = r.options.filter((opt: any) => factionRuleSelections[r.ruleId].includes(opt.id));
                    return selectedOpts.map((opt: any) => (
                      <div key={opt.id} className="rule-item">
                        <span className="rule-name">{opt.name} ({r.name.split(' / ')[0]})</span>
                        <span className="rule-desc">{opt.description}</span>
                      </div>
                    ));
                  }
                  
                  if (!r.options) {
                    return (
                      <div key={r.ruleId} className="rule-item">
                        <span className="rule-name">{r.name}</span>
                        <span className="rule-desc">{r.description}</span>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WeaponTable({ title, weapons, icon }: { title: string, weapons: any[], icon: string }) {
  if (!weapons || weapons.length === 0) return null;
  return (
    <div className="weapon-table-wrapper">
      <div className="weapon-table-header">
        <span className="weapon-icon">{icon}</span> {title}
      </div>
      <table className="weapon-table">
        <thead>
          <tr>
            <th>Name</th>
            <th title="Attacks" className="center">A</th>
            <th title="Hit Skill" className="center">BS/WS</th>
            <th title="Damage" className="center">D</th>
            <th>Special Rules</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map((w, idx) => (
            <tr key={`${w.weaponId}-${idx}`} className="weapon-row">
              <td className="w-name">{w.name}</td>
              <td className="w-stat center">{w.profile.attacks}</td>
              <td className="w-stat center">{w.profile.hit}+</td>
              <td className="w-stat center">{w.profile.normalDamage}/{w.profile.criticalDamage}</td>
              <td className="w-rules">
                {[...(w.profile.weaponRules || []), w.profile.range ? `Rng ${w.profile.range}"` : null].filter(Boolean).join(', ') || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
