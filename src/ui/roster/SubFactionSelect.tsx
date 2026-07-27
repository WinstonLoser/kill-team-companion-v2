import type { FactionPack, SubFactionSelector } from '../../rules'

/**
 * T4：子阵营选择器（通用）。读 faction.subFactionSelector（阵营机制 = 数据）。
 * 死亡天使 = 战团战术 8 选 2；军团兵印记走 perOperative，在特工行里选。
 *
 * 半屏栏宽下改用可点的 chip 列表：比一列复选框省高度，也更好点（触控目标更大）。
 * 选满 max 后未选项禁用（多选拦截由数据约束）。
 */
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
  // option 标签：优先用 pack 内可读名，回退到 option id
  function optionLabel(optId: string): string {
    const e = pack.effects.find((x) => x.effectId === optId)
    if (e) return e.label.split('（')[0] ?? e.label
    const o = pack.operatives.find((x) => x.operativeId === optId)
    if (o) return o.name
    return optId
  }

  function optionDetail(optId: string): string | null {
    return pack.effects.find((x) => x.effectId === optId)?.label ?? null
  }

  const full = selection.length >= selector.max

  function toggle(optId: string) {
    if (selection.includes(optId)) onChange(selection.filter((x) => x !== optId))
    else if (!full) onChange([...selection, optId])
  }

  return (
    <div className="sf-block">
      <div className="sf-head">
        <span className="ds-eyebrow">{selector.label}</span>
        <span className={`ds-badge ${full ? 'ds-badge--success' : 'ds-badge--warning'}`}>
          {selection.length}/{selector.max}
        </span>
      </div>
      <div className="sf-options">
        {selector.options.map((opt) => {
          const on = selection.includes(opt)
          return (
            <button
              key={opt}
              className={`sf-chip ${on ? 'on' : ''}`}
              disabled={!on && full}
              onClick={() => toggle(opt)}
              title={optionDetail(opt) ?? optionLabel(opt)}
            >
              {optionLabel(opt)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
