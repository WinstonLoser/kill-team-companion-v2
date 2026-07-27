import { loadPack, evaluateLegality, type FactionPack } from '../'
import { useViewStore } from '../state/viewStore'
import { useRosterStore, type Side } from '../state/rosterStore'
import { type FactionOption } from './roster/FactionSelect'
import { TeamColumn } from './roster/TeamColumn'
import './roster/RosterView.css'
import angelsPack from '../data/packs/angels_of_death.v1.json'
import legionariesPack from '../data/packs/legionaries.v1.json'
import plaguePack from '../data/packs/plague_marines.v1.json'
import chaosCultPack from '../data/packs/chaos_cult.v1.json'

// 四阵营全部可用。
const angelsLoaded: FactionPack = loadPack(angelsPack)
const legionariesLoaded: FactionPack = loadPack(legionariesPack)
const plagueLoaded: FactionPack = loadPack(plaguePack)
const chaosCultLoaded: FactionPack = loadPack(chaosCultPack)
const FACTIONS: FactionOption[] = [
  { id: 'angels_of_death', name: '死亡天使', available: true, pack: angelsLoaded },
  { id: 'legionaries', name: '军团兵', available: true, pack: legionariesLoaded },
  { id: 'plague_marines', name: '瘟疫战士', available: true, pack: plagueLoaded },
  { id: 'chaos_cult', name: '混沌教派', available: true, pack: chaosCultLoaded },
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

/**
 * 建队屏：A / B 两栏并列，同时可编辑。
 *
 * 这是一局两方对战，两队要一起摆 —— 原来用页签一次只编一方，
 * 建完一方还得切过去建另一方，且看不到对面。现在两栏各自独立滚动，
 * 底部一条通栏的「进入对局」门禁同时反映两边状态。
 * 窄屏（<1024px，非横屏 iPad）退回单栏 + 页签，见 RosterView.css。
 */
export function RosterView() {
  const setView = useViewStore((s) => s.setView)
  const patchRoster = useRosterStore((s) => s.patchRoster)
  const rosterA = useRosterStore((s) => s.rosterA)
  const rosterB = useRosterStore((s) => s.rosterB)
  // 窄屏下退回单栏时，editing 决定显示哪一栏
  const editing = useRosterStore((s) => s.editing)
  const setEditing = useRosterStore((s) => s.setEditing)

  const resultA = legalityOf('a')
  const resultB = legalityOf('b')
  const bothGreen = resultA.legal && resultB.legal
  const unresolved = (resultA.legal ? 0 : 1) + (resultB.legal ? 0 : 1)

  // T6：进入对局门禁。双方全绿 → commit（已在 store）→ 切对局视图
  function enterMatch() {
    if (!bothGreen) return
    setView('battle')
  }

  const sides: { side: Side; entry: typeof rosterA; result: typeof resultA }[] = [
    { side: 'a', entry: rosterA, result: resultA },
    { side: 'b', entry: rosterB, result: resultB },
  ]

  return (
    <section className="roster">
      {/* 窄屏专用页签：宽屏时 CSS 隐藏（两栏都在，不需要切换） */}
      <div className="ds-tabbar roster-narrow-tabs">
        {sides.map(({ side, result }) => (
          <button
            key={side}
            className={`ds-tab roster-narrow-tab ${side} ${editing === side ? 'on' : ''}`}
            onClick={() => setEditing(side)}
          >
            {side.toUpperCase()} 方
            <span className={`ds-badge ${result.legal ? 'ds-badge--success' : 'ds-badge--danger'}`}>
              {result.legal ? 'OK' : '违规'}
            </span>
          </button>
        ))}
      </div>

      <div className="roster-columns">
        {sides.map(({ side, entry, result }) => (
          <div key={side} className={`roster-col ${editing === side ? 'is-current' : ''}`}>
            <TeamColumn
              side={side}
              factions={FACTIONS}
              entry={entry}
              pack={packFor(entry.factionId)}
              result={result}
              onPatch={(patch) => patchRoster(side, patch)}
            />
          </div>
        ))}
      </div>

      {/* 通栏门禁：两方都合规才解锁 */}
      <footer className="roster-gate">
        <span className="roster-gate-status">
          <span className={`ds-badge ${resultA.legal ? 'ds-badge--success' : 'ds-badge--danger'}`}>
            A {resultA.legal ? '合规' : '违规'}
          </span>
          <span className={`ds-badge ${resultB.legal ? 'ds-badge--success' : 'ds-badge--danger'}`}>
            B {resultB.legal ? '合规' : '违规'}
          </span>
        </span>
        <button
          className="ds-btn ds-btn--lg roster-gate-btn"
          disabled={!bothGreen}
          onClick={enterMatch}
          title={bothGreen ? '双方阵容合规，进入对局' : `先解决 ${unresolved} 方违规`}
        >
          {bothGreen ? '进入对局 ▶' : `待合规（${unresolved} 方）`}
        </button>
      </footer>
    </section>
  )
}
