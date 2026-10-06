import type { FactionPack } from '../../rules'
import { factionVisual } from '../visual/factionVisuals'

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
            data-faction={f.id}
            data-motif={factionVisual(f.id).motif}
            aria-pressed={selectedId === f.id} disabled={!f.available}
            onClick={() => onSelect(f)}
            title={f.available ? f.name : `${f.name}（${f.epic ?? '待定'}）`}
          >
            <span className="faction-number">0{factions.indexOf(f) + 1} / KILL TEAM</span><strong>{f.name}</strong><span className="faction-description">{({angels_of_death:'精锐战士 · 战团战术',legionaries:'混沌印记 · 近战突击',plague_marines:'坚韧防线 · 瘟疫毒素',chaos_cult:'群体行动 · 战场变异',warpcoven:'灵能法术 · 诅咒之礼'} as Record<string,string>)[f.id]}</span>
            <span className="muted">{f.available ? (selectedId === f.id ? '✓ 已选' : '可选') : `${f.epic ?? '待定'}`}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
