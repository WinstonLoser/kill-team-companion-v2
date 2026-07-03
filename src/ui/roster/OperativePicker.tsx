import type { FactionPack } from '../../rules'

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
  const weaponName = (id: string) => pack.weapons.find((w) => w.weaponId === id)?.name ?? id

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

  function toggleWeapon(opKey: string, weaponId: string) {
    const cur = loadout[opKey] ?? []
    const next = cur.includes(weaponId) ? cur.filter((w) => w !== weaponId) : [...cur, weaponId]
    onChange({ operativeIds, loadout: { ...loadout, [opKey]: next } })
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
              return (
                <li key={key} className="loadout-item">
                  <span>{op.name}{instance > 0 ? ` #${instance + 1}` : ''}</span>
                  <div className="loadout-weapons">
                    {op.weaponRefs.map((wId) => (
                      <label key={wId} className="cover weapon-pick">
                        <input
                          type="checkbox"
                          checked={(loadout[key] ?? []).includes(wId)}
                          onChange={() => toggleWeapon(key, wId)}
                        />
                        {weaponName(wId)}
                      </label>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
