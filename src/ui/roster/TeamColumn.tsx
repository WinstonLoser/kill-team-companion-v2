import { useRef, useState } from 'react'
import type { FactionPack, RosterLegalityResult } from '../../rules'
import type { Side } from '../../state/rosterStore'
import { FactionSelect, type FactionOption } from './FactionSelect'
import { FactionOverview } from './FactionOverview'
import { LegalityPanel } from './LegalityPanel'
import { OperativeAddPanel } from './OperativeAddPanel'
import { RosterList } from './RosterList'
import { SubFactionSelect } from './SubFactionSelect'
import { computeDefaultRoster, type RosterPatch, type RosterState } from './rosterOps'

/**
 * 一方阵营的整栏：阵营身份 → 阵容 → 合法性。
 *
 * 两栏并列（A 左 B 右），各自独立滚动 —— 一方阵容长不会把另一方顶出屏幕。
 * 栏内只留建队要做的事；阵营常驻规则那一大坨挪进「资料」弹层。
 */
export function TeamColumn({
  side,
  factions,
  entry,
  pack,
  result,
  onPatch,
}: {
  side: Side
  factions: FactionOption[]
  entry: RosterState & { factionId: string | null; subFactionSelection: string[] }
  pack: FactionPack | null
  result: RosterLegalityResult
  onPatch: (patch: Partial<RosterPatch & { factionId: string | null; subFactionSelection: string[] }>) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [showOverview, setShowOverview] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const locateOffender = () => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const maxTotal = pack?.buildConstraints?.operatives?.max ?? 99
  const leaderIds = new Set(pack?.buildConstraints?.leaderFrom ?? [])
  const repeatableIds = new Set(pack?.buildConstraints?.maxPerTypeExcept ?? [])
  const selector = pack?.faction.subFactionSelector
  // markOfChaos 是 perOperative 作用域，在特工行内选，不在这里出现
  const showTeamSelector = selector && selector.scope !== 'perOperative'

  const state: RosterState = {
    operativeIds: entry.operativeIds,
    loadout: entry.loadout,
    perOperativeMarks: entry.perOperativeMarks,
    wargearAssignment: entry.wargearAssignment,
  }

  function pickFaction(f: FactionOption) {
    if (!f.available || !f.pack) return
    // 换阵营 = 换规则集，旧阵容不再适用；直接铺一套默认阵容让人有的可改
    const defaults = computeDefaultRoster(f.pack)
    onPatch({
      factionId: f.id,
      operativeIds: defaults.operativeIds,
      loadout: defaults.loadout,
      subFactionSelection: [],
      perOperativeMarks: defaults.perOperativeMarks,
      wargearAssignment: {},
    })
  }

  function clearFaction() {
    if (!confirm(`更换 ${side.toUpperCase()} 方阵营会清空当前阵容，继续？`)) return
    onPatch({
      factionId: null,
      operativeIds: [],
      loadout: {},
      subFactionSelection: [],
      perOperativeMarks: {},
      wargearAssignment: {},
    })
  }

  return (
    <section className={`tc-column tc-${side}`} aria-label={`${side.toUpperCase()} 方建队`}>
      <header className="tc-head">
        <div className="tc-title">
          <span className="ds-eyebrow tc-side">{side.toUpperCase()} 方</span>
          {pack && (
            <button
              className="ds-btn ds-btn--sm ds-btn--ghost"
              onClick={() => setShowOverview(true)}
              title="查看该阵营的计谋、装备与常驻规则"
            >
              资料 ▸
            </button>
          )}
        </div>
        <FactionSelect
          factions={factions}
          selectedId={entry.factionId}
          onSelect={pickFaction}
          onClear={clearFaction}
        />
      </header>

      {pack ? (
        <div className="tc-body" ref={listRef}>
          <div className="tc-roster-head">
            <span className="ds-eyebrow">阵容 {entry.operativeIds.length}/{maxTotal}</span>
            <button
              className="ds-btn ds-btn--sm"
              onClick={() => setShowAdd(true)}
              title="添加或替换特工"
            >
              ＋ 添加特工
            </button>
          </div>

          <RosterList
            pack={pack}
            state={state}
            leaderIds={leaderIds}
            repeatableIds={repeatableIds}
            onChange={onPatch}
          />

          {showTeamSelector && (
            <SubFactionSelect
              selector={selector}
              pack={pack}
              selection={entry.subFactionSelection}
              onChange={(next) => onPatch({ subFactionSelection: next })}
            />
          )}
        </div>
      ) : (
        <div className="tc-body tc-body--empty">
          <p className="ds-empty">先为 {side.toUpperCase()} 方选一个阵营</p>
        </div>
      )}

      <footer className="tc-foot">
        <LegalityPanel result={result} onLocate={locateOffender} />
      </footer>

      {showAdd && pack && (
        <OperativeAddPanel
          pack={pack}
          state={state}
          leaderIds={leaderIds}
          repeatableIds={repeatableIds}
          maxTotal={maxTotal}
          onChange={onPatch}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showOverview && pack && (
        <FactionOverview pack={pack} onClose={() => setShowOverview(false)} />
      )}
    </section>
  )
}
