import { useRef } from 'react'
import { evaluateLegality, type FactionPack } from '../'
import { useViewStore } from '../state/viewStore'
import { useRosterStore, type Side } from '../state/rosterStore'
import { FactionSelect, type FactionOption } from './roster/FactionSelect'
import { OperativePicker, computeDefaultRoster } from './roster/OperativePicker'
import { SubFactionSelect } from './roster/SubFactionSelect'
import { LegalityPanel } from './roster/LegalityPanel'
import { FactionOverview } from './roster/FactionOverview'
import { FactionWargearSelect } from './roster/FactionWargearSelect'
import { FACTION_REGISTRY } from '../data/packs'

// 阵营列表来自统一注册表（src/data/packs/index.ts），全部可用。
const FACTIONS: FactionOption[] = FACTION_REGISTRY.map((f) => ({ id: f.id, name: f.name, available: true, pack: f.pack }))

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
    teamRulesEnabled: entry.teamRulesEnabled,
    perOperativeMarks: entry.perOperativeMarks,
    personalAbilityIds: entry.personalAbilityIds,
    personalTactics: entry.personalTactics,
    boonWeaponTargets: entry.boonWeaponTargets,
    selectedWargearIds: entry.selectedWargearIds,
    personalRulesEnabled: entry.personalRulesEnabled,
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
  const bothLegal = resultA.legal && resultB.legal
  const bothGreen = bothLegal
  const unresolved = (resultA.legal ? 0 : 1) + (resultB.legal ? 0 : 1)

  // T6：进入对局门禁。双方全绿 → commit（已在 store）→ 切 setup-map-deploy（当前=match 视图）
  function enterMatch() {
    if (!bothGreen) return
    setView('match')
  }

  const sideLabel = (side: Side) => `${side.toUpperCase()} 方`

  return (
    <section className="roster">
      <div className="roster-intro"><div><span className="eyebrow">MISSION PREPARATION / 任务准备</span><h2>选择阵营，组建你的小队。</h2><p className="muted">为双方配置特工与武器。完成右侧检查后，即可进入战场。</p></div><span className="rules-badge">LITE RULES · 4 转折点</span></div>

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
              {sideLabel(side)}{e.factionId ? ` · ${FACTIONS.find(f => f.id === e.factionId)?.name ?? e.factionId}` : ' · 未选阵营'}
              <span className={`dot ${r.legal ? 'ok' : 'warn'}`}>{r.legal ? '✓' : '!'}</span>
            </button>
          )
        })}
      </div>

      {/* 顶部进入对局（常驻醒目） */}
      <div className="enter-gate top">
        <span className="eg-status">
          <span className={`dot ${resultA.legal ? 'ok' : 'warn'}`}>A {resultA.legal ? '✓' : '!'}</span>
          <span className={`dot ${resultB.legal ? 'ok' : 'warn'}`}>B {resultB.legal ? '✓' : '!'}</span>
        </span>
        <button
          className="primary enter-btn"
          disabled={!bothGreen}
          onClick={enterMatch}
          title={bothGreen ? '双方阵容合规，进入对局' : `先解决 ${unresolved} 方违规`}
        >
          {bothGreen ? '进入对局 ▶' : `待合规（${unresolved} 方）`}
        </button>
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
              // 切阵营：默认选首名队长 + 各类型一名（方便快速建队），清子阵营
              const defaults = computeDefaultRoster(f.pack)
              patchRoster(editing, {
                factionId: f.id,
                teamRulesEnabled: false,
                personalRulesEnabled: false,
                operativeIds: defaults.operativeIds,
                loadout: defaults.loadout,
                subFactionSelection: [],
                perOperativeMarks: {},
                personalAbilityIds: {},
                personalTactics: {},
                boonWeaponTargets: {},
                selectedWargearIds: [],
              })
            }}
          />

          {pack && (
            <>
              <div className="roster-rule-section"><span className="builder-eyebrow">01 / TEAM</span><h3>全队级别</h3><p>人数、队长等通用建队限制始终生效；下方的整队能力与阵营装备由双方决定是否加入本局。</p></div>
              {selector?.scope === 'team' && <>
                <section className="roster-rule-mode" aria-label="全队个性化规则">
                  <span className="builder-eyebrow">TEAM OPTIONS</span><h3>全队个性化</h3>
                  <label className="roster-personal-toggle"><input type="checkbox" checked={entry.teamRulesEnabled} onChange={e => patchRoster(editing, { teamRulesEnabled: e.target.checked, subFactionSelection: [] })} /><span><strong>启用战团战术（可选）</strong><small>{sideLabel(editing)} · {pack.faction.name}</small></span></label>
                  <p>{entry.teamRulesEnabled ? '按阵营规则为全队选择首要和次要战团战术；选满后才可开局。' : '阵营规则原本要求选择两项；关闭表示双方约定采用不使用战团战术的简化玩法。'}</p>
                </section>
                {entry.teamRulesEnabled && <SubFactionSelect selector={selector} pack={pack} selection={entry.subFactionSelection} onChange={(next) => patchRoster(editing, { subFactionSelection: next })} />}
              </>}
              <FactionWargearSelect pack={pack} selected={entry.selectedWargearIds} onChange={selectedWargearIds => patchRoster(editing, { selectedWargearIds })} />
              <section className="roster-rule-mode" aria-label="特工级别规则">
                <span className="builder-eyebrow">02 / OPERATIVES</span><h3>特工级别</h3>
                <p>特工与武器照常配置。双方若约定使用额外能力，再打开下面的选项。</p>
                <label className="roster-personal-toggle"><input type="checkbox" checked={entry.personalRulesEnabled} onChange={e => patchRoster(editing, { personalRulesEnabled: e.target.checked, perOperativeMarks: {}, personalAbilityIds: {}, personalTactics: {}, boonWeaponTargets: {} })} /><span><strong>允许逐名选用额外能力</strong><small>{sideLabel(editing)} · {pack.faction.name} · 可选</small></span></label>
                <p>{entry.personalRulesEnabled ? '展开特工卡片，只勾选本局要使用的能力；不需要每名特工都选。' : '当前不使用特工额外能力；仍可组队并配置武器。'}</p>
              </section>
              <OperativePicker
                pack={pack}
                operativeIds={entry.operativeIds}
                loadout={entry.loadout}
                perOperativeMarks={entry.perOperativeMarks}
                personalAbilityIds={entry.personalAbilityIds}
                personalTactics={entry.personalTactics}
                boonWeaponTargets={entry.boonWeaponTargets}
                personalRulesEnabled={entry.personalRulesEnabled}
                onChange={(next) => patchRoster(editing, next)}
              />
              <div className="subfaction-none"><h3>阵营规则参考</h3></div>
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
        {!bothLegal && <span className="muted"> 先解决 {unresolved} 方违规再进入对局</span>}
      </div>
    </section>
  )
}
