import type { FactionPack, SubFactionSelector } from '../../rules'

// T4：子阵营选择器（通用）。读 faction.subFactionSelector（阵营机制 = 数据）。
// 死亡天使=战团战术 8 选 2；军团兵印记 5 选 1 在 Epic 2 复用同组件（按 selector.max dispatch）。
// 多选拦截：超过 max 不再允许加入；选满 max 才该项 ✓（合法性面板据此判定）。
export function SubFactionSelect({
  selector,
  pack,
  selection,
  onChange,
}: {
  selector: SubFactionSelector
  pack: FactionPack
  selection: string[]
  onChange: (next: string[]) => void
}) {
  // option 标签解析：优先用 effect.label / operative.name 等 pack 内可读名，回退到 option id
  function optionLabel(optId: string): string {
    const e = pack.effects.find((x) => x.effectId === optId)
    if (e) return e.label
    const o = pack.operatives.find((x) => x.operativeId === optId)
    if (o) return o.name
    return optId
  }

  function toggle(optId: string) {
    if (selection.includes(optId)) {
      onChange(selection.filter((x) => x !== optId))
    } else if (selection.length < selector.max) {
      onChange([...selection, optId])
    }
    // 超过 max：忽略（多选拦截，由数据约束）
  }

  return (
    <div className="subfaction">
      <h3>{selector.label}（{selection.length}/{selector.max}）</h3>
      <ul className="list">
        {selector.options.map((opt) => (
          <li key={opt}>
            <label className="cover">
              <input
                type="checkbox"
                checked={selection.includes(opt)}
                onChange={() => toggle(opt)}
                disabled={!selection.includes(opt) && selection.length >= selector.max}
              />
              {optionLabel(opt)}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
