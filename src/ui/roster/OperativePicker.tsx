import type { FactionPack } from '../../rules'

// 武器规则英文→中文映射
const WEAPON_RULE_ZH: Record<string, string> = {
  PISTOL: '手枪', TORRENT: '洪流', PIERCING1: '穿刺1', PIERCING: '穿刺',
  CONCEAL: '集中', OVERHEAT: '过热', LETHAL5: '致命5+', HEAVY: '重型',
  BLAST1: '爆炸1"', BLAST2: '爆炸2"', DEVASTATING: '严重', DEVASTATING3: '毁灭3',
  SILENT: '安静', BRUTAL: '残暴', STUN: '震荡', CONCUSSIVE: '眩晕',
  RAPID_FIRE: '撕裂', TOXIN: '毒素', VIRULENT: '剧毒', RELENTLESS: '无休',
  SEEKING_LIGHT: '追踪轻型', BALANCED: '平衡', CRITICAL_HIT: '关键命中',
  SUSTAINED: '持续', ASSAULT: '突击', TWIN_LINKED: '双联',
}
function ruleZh(rule: string): string { return WEAPON_RULE_ZH[rule] ?? rule }

// T3：选特工 + 装备配置视图。
// 按角色分组排列：队长 → 唯一特工 → 复选特工。
// [+][-] 按钮；maxPerTypeExcept 内的特工可多选，其余每类限 1。
export function OperativePicker({
  pack,
  operativeIds,
  loadout,
  onChange,
}: {
  pack: FactionPack
  operativeIds: string[]
  loadout: Record<string, string[]>
  onChange: (next: { operativeIds: string[]; loadout: Record<string, string[]> }) => void
}) {
  const except = new Set(pack.buildConstraints?.maxPerTypeExcept ?? [])
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const maxPerType = (opId: string) => except.has(opId) ? 6 : 1

  // 按角色分组：队长 → 唯一 → 复选
  const leaderOps = pack.operatives.filter((o) => leaders.has(o.operativeId))
  const uniqueOps = pack.operatives.filter((o) => !leaders.has(o.operativeId) && !except.has(o.operativeId))
  const repeatableOps = pack.operatives.filter((o) => !leaders.has(o.operativeId) && except.has(o.operativeId))

  function countOf(opId: string): number {
    return operativeIds.filter((x) => x === opId).length
  }

  function addOp(opId: string) {
    onChange({ operativeIds: [...operativeIds, opId], loadout: { ...loadout, [`${opId}#${operativeIds.filter(x=>x===opId).length}`]: [] } })
  }

  function removeOp(opId: string) {
    const lastIdx = operativeIds.lastIndexOf(opId)
    if (lastIdx < 0) return
    const nextIds = [...operativeIds.slice(0, lastIdx), ...operativeIds.slice(lastIdx + 1)]
    const nextLoadout = { ...loadout }
    delete nextLoadout[`${opId}#${operativeIds.filter((x, i) => x === opId && i <= lastIdx).length - 1}`]
    onChange({ operativeIds: nextIds, loadout: nextLoadout })
  }

  function toggleWeapon(opKey: string, weaponId: string, kind: 'RANGED' | 'MELEE') {
    const cur = loadout[opKey] ?? []
    const weapon = pack.weapons.find((w) => w.weaponId === weaponId)
    if (!weapon) return
    // 远程武器单选（radio 语义）：选新远程 → 替换旧远程；近战同理
    if (cur.includes(weaponId)) {
      onChange({ operativeIds, loadout: { ...loadout, [opKey]: cur.filter((w) => w !== weaponId) } })
    } else {
      const filtered = cur.filter((wid) => {
        const w = pack.weapons.find((x) => x.weaponId === wid)
        return w?.kind !== kind
      })
      onChange({ operativeIds, loadout: { ...loadout, [opKey]: [...filtered, weaponId] } })
    }
  }

  const expanded = operativeIds.map((opId, i) => {
    const instance = operativeIds.slice(0, i).filter((x) => x === opId).length
    return { opId, key: `${opId}#${instance}`, instance, idx: i }
  })

  function renderOpRow(o: typeof pack.operatives[0], tag?: string) {
    const count = countOf(o.operativeId)
    return (
      <li key={o.operativeId} className={`op-card ${count > 0 ? 'in' : ''}`}>
        <div className="op-row">
          {tag && <span className="op-tag">{tag}</span>}
          <strong>{o.name}</strong>
          <span className="muted"> — 豁免{o.stats.save}+ 耐伤{o.stats.wounds} 移动{o.stats.move}"</span>
          <span className="op-count">×{count}</span>
          <button className="op-btn" onClick={() => addOp(o.operativeId)} disabled={count >= maxPerType(o.operativeId)}>＋</button>
          <button className="op-btn" onClick={() => removeOp(o.operativeId)} disabled={count === 0}>－</button>
        </div>
      </li>
    )
  }

  return (
    <div className="operative-picker">
      <h3>选特工 + 装备配置（{operativeIds.length} 名）</h3>

      {leaderOps.length > 0 && (
        <>
          <h4 className="op-group-title">队长（选 1 名）</h4>
          <ul className="list">{leaderOps.map((o) => renderOpRow(o, '队长'))}</ul>
        </>
      )}
      {uniqueOps.length > 0 && (
        <>
          <h4 className="op-group-title">唯一特工（每类限 1）</h4>
          <ul className="list">{uniqueOps.map((o) => renderOpRow(o))}</ul>
        </>
      )}
      {repeatableOps.length > 0 && (
        <>
          <h4 className="op-group-title">复选特工（可多名）</h4>
          <ul className="list">{repeatableOps.map((o) => renderOpRow(o))}</ul>
        </>
      )}

      {expanded.length > 0 && (
        <div className="loadout-section">
          <h4>装备配置</h4>
          <ul className="list">
            {expanded.map(({ opId, key, instance }) => {
              const op = pack.operatives.find((o) => o.operativeId === opId)!
              const selected = loadout[key] ?? []
              const ranged = op.weaponRefs.map((wid) => pack.weapons.find((w) => w.weaponId === wid)!).filter((w) => w?.kind === 'RANGED')
              const melee = op.weaponRefs.map((wid) => pack.weapons.find((w) => w.weaponId === wid)!).filter((w) => w?.kind === 'MELEE')
              const fmtStats = (w: typeof pack.weapons[0]) => {
                const p = w.profile
                return `${p.attacks}攻 ${p.hit}+ ${p.normalDamage}/${p.criticalDamage}伤${p.range != null ? ` ${p.range}"` : ''}${p.weaponRules.length ? ` ${p.weaponRules.map(ruleZh).join('/')}` : ''}`
              }
              return (
                <li key={key} className="loadout-item">
                  <span className="loadout-name">{op.name}{instance > 0 ? ` #${instance + 1}` : ''}</span>
                  {ranged.length > 0 && (
                    <div className="loadout-group">
                      <span className="loadout-cat">远程（选 1）</span>
                      {ranged.map((w) => (
                        <label key={w.weaponId} className={`weapon-pick ${selected.includes(w.weaponId) ? 'on' : ''}`}>
                          <input type="radio" name={`${key}-RANGED`} checked={selected.includes(w.weaponId)} onChange={() => toggleWeapon(key, w.weaponId, 'RANGED')} />
                          <span className="weapon-name">{w.name}</span>
                          <span className="weapon-stats">{fmtStats(w)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {melee.length > 0 && (
                    <div className="loadout-group">
                      <span className="loadout-cat">近战（选 1）</span>
                      {melee.map((w) => (
                        <label key={w.weaponId} className={`weapon-pick ${selected.includes(w.weaponId) ? 'on' : ''}`}>
                          <input type="radio" name={`${key}-MELEE`} checked={selected.includes(w.weaponId)} onChange={() => toggleWeapon(key, w.weaponId, 'MELEE')} />
                          <span className="weapon-name">{w.name}</span>
                          <span className="weapon-stats">{fmtStats(w)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
