import type { FactionPack } from '../../rules'

// T2：阵营选择卡。阵营机制 = 数据；四阵营均已就绪。阵营可同可异（AC4）。
export interface FactionOption {
  id: string
  name: string
  available: boolean
  epic?: string // 未就绪时标注来源 Epic
  pack?: FactionPack // available=true 时提供已加载的数据包
}

/**
 * 未选阵营时：2×2 卡片网格（半屏栏宽正好放得下四张）。
 * 已选阵营时：折叠成一条身份栏 + 「更换」—— 阵营只选一次，
 * 不该常驻占掉半栏高度。
 */
export function FactionSelect({
  factions,
  selectedId,
  onSelect,
  onClear,
}: {
  factions: FactionOption[]
  selectedId: string | null
  onSelect: (f: FactionOption) => void
  onClear?: () => void
}) {
  const selected = selectedId ? factions.find((f) => f.id === selectedId) : null

  if (selected) {
    return (
      <div className="fs-identity">
        <div className="fs-identity-text">
          <span className="ds-eyebrow">阵营</span>
          <span className="ds-display ds-display--sm fs-identity-name">{selected.name}</span>
        </div>
        {onClear && (
          <button
            className="ds-btn ds-btn--sm ds-btn--secondary"
            onClick={onClear}
            title="改选阵营会清空当前阵容"
          >
            更换
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="fs-grid">
      {factions.map((f) => (
        <button
          key={f.id}
          className="fs-card ds-chamfer-tr"
          disabled={!f.available}
          onClick={() => onSelect(f)}
          title={f.available ? `选择 ${f.name}` : `${f.name}（${f.epic ?? '待定'}）`}
        >
          <span className="ds-display ds-display--sm fs-card-name">{f.name}</span>
          {!f.available && <span className="ds-badge">{f.epic ?? '待定'}</span>}
        </button>
      ))}
    </div>
  )
}
