import React, { useState } from 'react';
import { useLocaleStore } from '../../../state/localeStore';
import { t } from '../../../utils/i18n';
import { InfoOverlay } from '../InfoOverlay/InfoOverlay';
import { getWeaponRuleDescription } from '../../../data/universalWeaponRules';
import './OperativeCard.css';

export function OperativeCard({ operative, pack, selectedWeaponIds, factionRuleSelections, avatarUrl }: { operative: any, pack: any, selectedWeaponIds: string[], factionRuleSelections?: Record<string, string[]>, avatarUrl?: string }) {
  const locale = useLocaleStore((s) => s.locale);
  const [activeInfo, setActiveInfo] = useState<{ title: string, content: string } | null>(null);
  
  if (!operative) return null;

  const weapons = selectedWeaponIds.map((ref: string) => pack.weapons.find((w: any) => w.weaponId === ref)).filter(Boolean);
  const abilities = (operative.abilityRefs || []).map((ref: string) => pack.abilities?.find((a: any) => a.abilityId === ref)).filter(Boolean);
  const factionRules = (operative.factionRuleRefs || []).map((ref: string) => pack.factionRules?.find((r: any) => r.ruleId === ref)).filter(Boolean);

  const rangedWeapons = weapons.filter((w: any) => w.kind === 'RANGED');
  const meleeWeapons = weapons.filter((w: any) => w.kind === 'MELEE');

  return (
    <div style={{ position: 'relative', height: '100%' }}>
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
            <h1 className="op-name">{t(operative.name, locale)}</h1>
            <div className="op-keywords">
              {operative.keywords.map((kw: string) => <span key={kw} className="keyword-tag">{t(kw, locale)}</span>)}
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
          <WeaponTable title={locale === 'zh' ? '远程武器' : 'RANGED WEAPONS'} weapons={rangedWeapons} icon="⌖" onShowInfo={(t, c) => setActiveInfo({ title: t, content: c })} />
          <WeaponTable title={locale === 'zh' ? '近战武器' : 'MELEE WEAPONS'} weapons={meleeWeapons} icon="⚔" onShowInfo={(t, c) => setActiveInfo({ title: t, content: c })} />
        </div>

        <div className="rules-section">
          {abilities.length > 0 && (
            <div className="rule-block">
              <h3 className="rule-header">{locale === 'zh' ? '能力' : 'ABILITIES'}</h3>
              <div className="rule-list">
                {abilities.map((a: any) => (
                  <div key={a.abilityId} className="rule-item clickable" onClick={() => setActiveInfo({ title: t(a.name, locale), content: t(a.description, locale) })}>
                    <span className="rule-name">{t(a.name, locale)}</span>
                    <span className="rule-desc">{t(a.description, locale)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {factionRules.length > 0 && (
            <div className="rule-block">
              <h3 className="rule-header">{locale === 'zh' ? '阵营规则' : 'FACTION RULES'}</h3>
              <div className="rule-list">
                {factionRules.map((r: any) => {
                  if (r.options && factionRuleSelections && factionRuleSelections[r.ruleId] && factionRuleSelections[r.ruleId].length > 0) {
                    const selectedOpts = r.options.filter((opt: any) => factionRuleSelections[r.ruleId].includes(opt.id));
                    return selectedOpts.map((opt: any) => (
                      <div key={opt.id} className="rule-item clickable" onClick={() => setActiveInfo({ title: `${t(opt.name, locale)} (${t(r.name, locale)})`, content: t(opt.description, locale) })}>
                        <span className="rule-name">{t(opt.name, locale)} ({t(r.name, locale)})</span>
                        <span className="rule-desc">{t(opt.description, locale)}</span>
                      </div>
                    ));
                  }
                  
                  if (!r.options || r.options.length === 0) {
                    return (
                      <div key={r.ruleId} className="rule-item clickable" onClick={() => setActiveInfo({ title: t(r.name, locale), content: t(r.description, locale) })}>
                        <span className="rule-name">{t(r.name, locale)}</span>
                        <span className="rule-desc">{t(r.description, locale)}</span>
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

      <InfoOverlay 
        isOpen={activeInfo !== null} 
        onClose={() => setActiveInfo(null)} 
        title={activeInfo?.title || ''}
      >
        <p>{activeInfo?.content}</p>
      </InfoOverlay>
    </div>
  );
}

function WeaponTable({ title, weapons, icon, onShowInfo }: { title: string, weapons: any[], icon: string, onShowInfo: (title: string, content: string) => void }) {
  const locale = useLocaleStore((s) => s.locale);
  if (!weapons || weapons.length === 0) return null;
  return (
    <div className="weapon-table-wrapper">
      <div className="weapon-table-header">
        <span className="weapon-icon">{icon}</span> {title}
      </div>
      <table className="weapon-table">
        <thead>
          <tr>
            <th>{locale === 'zh' ? '武器名称' : 'Name'}</th>
            <th title="Attacks" className="center">A</th>
            <th title="Hit Skill" className="center">BS/WS</th>
            <th title="Damage" className="center">D</th>
            <th>{locale === 'zh' ? '特殊规则' : 'Special Rules'}</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map((w, idx) => (
            <tr key={`${w.weaponId}-${idx}`} className="weapon-row">
              <td className="w-name">{t(w.name, locale)}</td>
              <td className="w-stat center">{w.profile.attacks}</td>
              <td className="w-stat center">{w.profile.hit}+</td>
              <td className="w-stat center">{w.profile.normalDamage}/{w.profile.criticalDamage}</td>
              <td className="w-rules">
                {(() => {
                  const rules = [...(w.profile.weaponRules || []), w.profile.range ? `Rng ${w.profile.range}"` : null].filter(Boolean);
                  if (rules.length === 0) return '-';
                  return rules.map((rule, i) => (
                    <React.Fragment key={i}>
                      <span 
                        className="w-rule-clickable" 
                        onClick={() => onShowInfo(t(rule as string, locale), getWeaponRuleDescription(rule as string, locale))}
                      >
                        {t(rule as string, locale)}
                      </span>
                      {i < rules.length - 1 ? ', ' : ''}
                    </React.Fragment>
                  ));
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
