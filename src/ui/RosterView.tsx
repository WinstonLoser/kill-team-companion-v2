import { useRef } from 'react'
import { loadPack, evaluateLegality, type FactionPack } from '../'
import { useViewStore } from '../state/viewStore'
import { useRosterStore, type Side } from '../state/rosterStore'
import { FactionSelect, type FactionOption } from './roster/FactionSelect'
import { OperativePicker } from './roster/OperativePicker'
import { SubFactionSelect } from './roster/SubFactionSelect'
import { LegalityPanel } from './roster/LegalityPanel'
import { FactionOverview } from './roster/FactionOverview'
import angelsPack from '../data/packs/angels_of_death.v1.json'
import legionariesPack from '../data/packs/legionaries.v1.json'
import plaguePack from '../data/packs/plague_marines.v1.json'

// 三阵营全部可用（Epic 1-3 完成）。
const angelsLoaded: FactionPack = loadPack(angelsPack)
const legionariesLoaded: FactionPack = loadPack(legionariesPack)
const plagueLoaded: FactionPack = loadPack(plaguePack)
const FACTIONS: FactionOption[] = [
  { id: 'angels_of_death', name: '死亡天使', available: true, pack: angelsLoaded },
  { id: 'legionaries', name: '军团兵', available: true, pack: legionariesLoaded },
  { id: 'plague_marines', name: '瘟疫战士', available: true, pack: plagueLoaded },
]

function packFor(factionId: string | null): FactionPack | null {
  if (!factionId) return null
  return FACTIONS.find((f) => f.id === factionId)?.pack ?? null
}

function legalityOf(side: Side) {
  const s = useRosterStore.getState()
  const entry = side === 'a' ? s.rosterA : s.rosterB
  const pack = packFor(entry.factionId)
  if (!pack) return { checks: [], legal: false }
  return evaluateLegality({
    pack,
    operativeIds: entry.operativeIds,
    loadout: entry.loadout,
    subFactionSelection: entry.subFactionSelection,
  })
}

export function RosterView() {
  const setView = useViewStore((s) => s.setView)
  const editing = useRosterStore((s) => s.editing)
  const setEditing = useRosterStore((s) => s.setEditing)
  const patchRoster = useRosterStore((s) => s.patchRoster)
  const rosterA = useRosterStore((s) => s.rosterA)
  const rosterB = useRosterStore((s) => s.rosterB)

  const entry = editing === 'a' ? rosterA : rosterB
  const pack = packFor(entry.factionId)
  const selector = pack?.faction.subFactionSelector
  const result = legalityOf(editing)
  const opListRef = useRef<HTMLDivElement>(null)
  const locateOffender = () => opListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const resultA = legalityOf('a')
  const resultB = legalityOf('b')
  const bothGreen = resultA.legal && resultB.legal
  const unresolved = (resultA.legal ? 0 : 1) + (resultB.legal ? 0 : 1)

  // T6：进入对局门禁。双方全绿 → commit（已在 store）→ 切 setup-map-deploy（当前=match 视图）
  function enterMatch() {
    if (!bothGreen) return
    setView('match')
  }

  const sideLabel = (side: Side) => `${side.toUpperCase()} 方`

  return (
    <section className="roster">
      <h2>建队（无点数 D-30 · 双方各建一队）</h2>

      {/* A/B 双方建队切换 */}
      <div className="row side-toggle">
        {(['a', 'b'] as const).map((side) => {
          const r = side === 'a' ? resultA : resultB
          const e = side === 'a' ? rosterA : rosterB
          return (
            <button
              key={side}
              className={`side-btn ${side} ${editing === side ? 'active' : ''}`}
              onClick={() => setEditing(side)}
            >
              {sideLabel(side)}{e.factionId ? ` · ${e.factionId}` : ' · 未选阵营'}
              <span className={`dot ${r.legal ? 'ok' : 'warn'}`}>{r.legal ? '✓' : '!'}</span>
            </button>
          )
        })}
      </div>

      <div className="roster-layout">
        <div className="roster-main" ref={opListRef}>
          {/* AC1 顺序可达：选阵营 → 选特工+装备 → 子阵营选择器 */}
          <FactionSelect
            factions={FACTIONS}
            selectedId={entry.factionId}
            sideLabel={sideLabel(editing)}
            onSelect={(f) => {
              if (!f.available || !f.pack) return
              // 切阵营：清空特工/装备/子阵营（避免跨阵营脏数据）
              patchRoster(editing, {
                factionId: f.id,
                operativeIds: [],
                loadout: {},
                subFactionSelection: [],
              })
            }}
          />

          {pack && (
            <>
              <OperativePicker
                pack={pack}
                operativeIds={entry.operativeIds}
                loadout={entry.loadout}
                perOperativeMarks={entry.perOperativeMarks}
                wargearAssignment={entry.wargearAssignment}
                onChange={(next) => patchRoster(editing, next)}
              />
              {selector ? (
                <SubFactionSelect
                  selector={selector}
                  pack={pack}
                  selection={entry.subFactionSelection}
                  onChange={(next) => patchRoster(editing, { subFactionSelection: next })}
                />
              ) : (
                <div className="subfaction-none">
                  <h3>阵营能力（常驻）</h3>
                </div>
              )}
              <FactionOverview pack={pack} />
            </>
          )}
        </div>

        {/* T5 合法性面板（实时，P13 违规可定位） */}
        <LegalityPanel result={result} sideLabel={sideLabel(editing)} onLocate={locateOffender} />
      </div>

      {/* T6 进入对局门禁 */}
      <div className="enter-gate">
        <button
          className="primary enter-btn"
          disabled={!bothGreen}
          onClick={enterMatch}
          title={bothGreen ? '双方阵容合规，进入对局' : `先解决 ${unresolved} 方违规`}
        >
          {bothGreen ? '进入对局 ▶' : `先满足合法性（${unresolved} 方未合规）`}
        </button>
        {!bothGreen && <span className="muted"> 先解决 {unresolved} 方违规再进入对局</span>}
      </div>
    </section>
  )
}
