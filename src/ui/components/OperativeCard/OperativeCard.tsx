import type { FactionPack, Operative, Weapon, Effect } from '../../../rules'
import { ruleZh } from '../../weaponDisplay'
import './OperativeCard.css'

/**
 * 特工数据卡（移植自 feature/operative-data-card，适配 main 数据模型）。
- 武器：selectedWeaponIds → pack.weapons，按 kind 分远程/近战两表
- 能力：operative.abilities → pack.effects（source: ability:）
- 阵营规则：pack.effects（source: factionRule:）+ 调用方传入的已选 effectId（战团战术/印记）
 */
export function OperativeCard({
  operative,
  pack,
  selectedWeaponIds,
  selectedFactionRuleIds = [],
}: {
  operative: Operative
  pack: FactionPack
  selectedWeaponIds: string[]
  selectedFactionRuleIds?: string[]
}) {
  if (!operative) return null

  const weaponOf = (id: string) => pack.weapons.find((w) => w.weaponId === id)
  const weapons = selectedWeaponIds.map(weaponOf).filter((w): w is Weapon => Boolean(w))
  const rangedWeapons = weapons.filter((w) => w.kind === 'RANGED')
  const meleeWeapons = weapons.filter((w) => w.kind === 'MELEE')

  const effectOf = (id: string) => pack.effects.find((e) => e.effectId === id)
  const abilities = (operative.abilities ?? []).map(effectOf).filter((e): e is Effect => Boolean(e))

  // 阵营规则：常驻 factionRule: + 调用方传入的已选（战团战术/印记），按 effectId 去重
  const factionRuleIds = new Set<string>([
    ...pack.effects.filter((e) => e.source.startsWith('factionRule:')).map((e) => e.effectId),
    ...selectedFactionRuleIds,
  ])
  const factionRules = [...factionRuleIds].map(effectOf).filter((e): e is Effect => Boolean(e))

  const stats: { label: string; value: string }[] = [
    { label: 'M', value: `${operative.stats.move}"` },
    { label: 'APL', value: String(operative.stats.apl) },
    { label: 'SV', value: `${operative.stats.save}+` },
    { label: 'W', value: String(operative.stats.wounds) },
  ]

  return (
    <div className="op-card-container">
      <div className="op-card-header">
        <div className="op-header-left">
          <div className="op-avatar-placeholder"><span className="avatar-icon">👤</span></div>
          <div className="op-title-area">
            <h1 className="op-name">{operative.name}</h1>
            <div className="op-keywords">
              {operative.keywords.map((kw) => <span key={kw} className="keyword-tag">{kw}</span>)}
            </div>
          </div>
        </div>
        <div className="op-stats-panel">
          {stats.map((s) => (
            <div key={s.label} className="stat-hex">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="op-body">
        <div className="weapons-section">
          <WeaponTable title="远程武器" weapons={rangedWeapons} icon="⌖" />
          <WeaponTable title="近战武器" weapons={meleeWeapons} icon="⚔" />
        </div>

        {(abilities.length > 0 || factionRules.length > 0) && (
          <div className="rules-section">
            {abilities.length > 0 && (
              <div className="rule-block">
                <h3 className="rule-header">特工能力</h3>
                <div className="rule-list">
                  {abilities.map((a) => (
                    <div key={a.effectId} className="rule-item">
                      <span className="rule-name">{a.label.split('（')[0]}</span>
                      <span className="rule-desc">{effectDesc(a)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {factionRules.length > 0 && (
              <div className="rule-block">
                <h3 className="rule-header">阵营规则</h3>
                <div className="rule-list">
                  {factionRules.map((r) => (
                    <div key={r.effectId} className="rule-item">
                      <span className="rule-name">{r.label.split('（')[0]}</span>
                      <span className="rule-desc">{effectDesc(r)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** effect 描述：优先 label 括号内文本，否则用 modifier.kind 兜底。 */
function effectDesc(e: Effect): string {
  const m = e.label.match(/（(.+)）/)
  if (m) return m[1]!
  return `${e.modifier.kind}${e.rulesRef ? `（§${e.rulesRef.section}）` : ''}`
}

function WeaponTable({ title, weapons, icon }: { title: string; weapons: Weapon[]; icon: string }) {
  if (weapons.length === 0) return null
  return (
    <div className="weapon-table-wrapper">
      <div className="weapon-table-header"><span className="weapon-icon">{icon}</span> {title}</div>
      <table className="weapon-table">
        <thead>
          <tr>
            <th>名称</th>
            <th className="center" title="攻击">A</th>
            <th className="center" title="命中">命中</th>
            <th className="center" title="伤害 普通/关键">D</th>
            <th>特殊规则</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map((w) => (
            <tr key={w.weaponId} className="weapon-row">
              <td className="w-name">{w.name}</td>
              <td className="w-stat center">{w.profile.attacks}</td>
              <td className="w-stat center">{w.profile.hit}+</td>
              <td className="w-stat center">{w.profile.normalDamage}/{w.profile.criticalDamage}</td>
              <td className="w-rules">
                {[...w.profile.weaponRules.map(ruleZh), w.profile.range != null ? `射程 ${w.profile.range}"` : null]
                  .filter(Boolean).join('，') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
