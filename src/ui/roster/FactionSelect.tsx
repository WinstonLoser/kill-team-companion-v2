import type { FactionPack } from '../../rules'

// T2：阵营选择卡。阵营机制 = 数据；本 Epic 仅死亡天使数据可用（Story 1.3），
// 军团兵/瘟疫战士置灰标 Epic 2/3。阵营可同可异（AC4）。
export interface FactionOption {
  id: string
  name: string
  available: boolean
  epic?: string // 未就绪时标注来源 Epic
  pack?: FactionPack // available=true 时提供已加载的数据包
}

export function FactionSelect({
  factions,
  selectedId,
  sideLabel,
  onSelect,
}: {
  factions: FactionOption[]
  selectedId: string | null
  sideLabel: string
  onSelect: (f: FactionOption) => void
}) {
  return (
    <div className="faction-grid">
      <h3>选阵营 · {sideLabel}</h3>
      <div className="cards">
        {factions.map((f) => (
          <button
            key={f.id}
            className={`faction-card ${selectedId === f.id ? 'sel' : ''}`}
            disabled={!f.available}
            onClick={() => onSelect(f)}
            title={f.available ? f.name : `${f.name}（${f.epic ?? '待定'}）`}
          >
            <strong>{f.name}</strong>
            <span className="muted">{f.available ? (selectedId === f.id ? '✓ 已选' : '可选') : `${f.epic ?? '待定'}`}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
