import type { FactionPack } from '../../rules'

/** Faction equipment is chosen for the team, not assigned to individual operatives. */
export function FactionWargearSelect({ pack, selected, onChange }: { pack: FactionPack; selected: string[]; onChange: (ids: string[]) => void }) {
  const wargear = pack.wargear ?? []
  if (!wargear.length) return null
  return <section className="faction-wargear" aria-label="阵营装备">
    <div className="builder-heading"><div><span className="builder-eyebrow">OPTIONAL FACTION EQUIPMENT</span><h3>阵营装备</h3><p>按本局约定勾选；不选也可开局。效果、使用时点及次数由玩家按规则自行裁定。</p></div><span className="faction-wargear-count">已选 {selected.length} / {wargear.length}</span></div>
    <div className="faction-wargear-grid">{wargear.map(item => <label className={`faction-wargear-card ${selected.includes(item.id) ? 'selected' : ''}`} key={item.id}>
      <input type="checkbox" checked={selected.includes(item.id)} onChange={event => onChange(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />
      <span><strong>{item.name.split(' / ').at(-1) ?? item.name}</strong><small>{item.description}</small></span>
    </label>)}</div>
  </section>
}
