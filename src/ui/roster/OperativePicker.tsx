import type { FactionPack } from '../../rules'

// T3：选特工 + 装备配置视图。
// 入队/出队特工（来自 faction pack operatives[]），每名入队特工可勾选其 weaponRefs 装备配置。
// UI 只消费 state（AR-9）：所有变更通过 onChange 回调上抛，不在组件内自持引擎调用。
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
  const weaponName = (id: string) => pack.weapons.find((w) => w.weaponId === id)?.name ?? id

  function toggleOp(opId: string) {
    if (operativeIds.includes(opId)) {
      // 出队：同时清掉其 loadout
      const nextLoadout = { ...loadout }
      delete nextLoadout[opId]
      onChange({ operativeIds: operativeIds.filter((x) => x !== opId), loadout: nextLoadout })
    } else {
      // 入队：默认勾选其全部 weaponRefs（玩家可再手动取消）
      const op = pack.operatives.find((o) => o.operativeId === opId)
      const nextLoadout = { ...loadout, [opId]: op ? [...op.weaponRefs] : [] }
      onChange({ operativeIds: [...operativeIds, opId], loadout: nextLoadout })
    }
  }

  function toggleWeapon(opId: string, weaponId: string) {
    const cur = loadout[opId] ?? []
    const next = cur.includes(weaponId) ? cur.filter((w) => w !== weaponId) : [...cur, weaponId]
    onChange({ operativeIds, loadout: { ...loadout, [opId]: next } })
  }

  return (
    <div className="operative-picker">
      <h3>选特工 + 装备配置（{operativeIds.length} 名）</h3>
      <ul className="list">
        {pack.operatives.map((o) => {
          const inTeam = operativeIds.includes(o.operativeId)
          return (
            <li key={o.operativeId} className={`op-card ${inTeam ? 'in' : ''}`}>
              <label className="cover">
                <input type="checkbox" checked={inTeam} onChange={() => toggleOp(o.operativeId)} />
                <strong>{o.name}</strong>
                <span className="muted">
                  {' '}— 豁免{o.stats.save}+ 耐伤{o.stats.wounds} 移动{o.stats.move}"
                </span>
              </label>
              {inTeam && (
                <div className="loadout">
                  {o.weaponRefs.map((wId) => (
                    <label key={wId} className="cover weapon-pick">
                      <input
                        type="checkbox"
                        checked={(loadout[o.operativeId] ?? []).includes(wId)}
                        onChange={() => toggleWeapon(o.operativeId, wId)}
                      />
                      {weaponName(wId)}
                    </label>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
