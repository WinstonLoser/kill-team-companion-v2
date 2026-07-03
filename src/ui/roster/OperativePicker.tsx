import type { FactionPack } from '../../rules'

// T3：选特工 + 装备配置视图。
// [+][-] 按钮允许多选同类（KT 火队允许）；maxPerTypeExcept 内的特工不限量，其余每类限 1。
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
  const maxPerType = (opId: string) => except.has(opId) ? 6 : 1
  const weaponName = (id: string) => pack.weapons.find((w) => w.weaponId === id)?.name ?? id

  // 统计每类特工在队中的数量
  function countOf(opId: string): number {
    return operativeIds.filter((x) => x === opId).length
  }

  function addOp(opId: string) {
    onChange({ operativeIds: [...operativeIds, opId], loadout: { ...loadout, [`${opId}#${operativeIds.filter(x=>x===opId).length}`]: [] } })
  }

  function removeOp(opId: string) {
    // 移除最后一个该类型
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

  // 展开为实际队中每名特工（含序号）
  const expanded = operativeIds.map((opId, i) => {
    const instance = operativeIds.slice(0, i).filter((x) => x === opId).length
    return { opId, key: `${opId}#${instance}`, instance, idx: i }
  })

  return (
    <div className="operative-picker">
      <h3>选特工 + 装备配置（{operativeIds.length} 名）</h3>
      <ul className="list">
        {pack.operatives.map((o) => {
          const count = countOf(o.operativeId)
          return (
            <li key={o.operativeId} className={`op-card ${count > 0 ? 'in' : ''}`}>
              <div className="op-row">
                <strong>{o.name}</strong>
                <span className="muted"> — 豁免{o.stats.save}+ 耐伤{o.stats.wounds} 移动{o.stats.move}"</span>
                <span className="op-count">×{count}</span>
                <button className="op-btn" onClick={() => addOp(o.operativeId)} disabled={count >= maxPerType(o.operativeId)}>＋</button>
                <button className="op-btn" onClick={() => removeOp(o.operativeId)} disabled={count === 0}>－</button>
              </div>
            </li>
          )
        })}
      </ul>
      {/* 已选特工的装备配置（展开列表） */}
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
