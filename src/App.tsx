import { useState } from 'react'
import { useViewStore, type View } from './state/viewStore'
import { MatchView } from './ui/MatchView'
import { RosterView } from './ui/RosterView'
import { loadPack } from './'
import angelsPack from './data/packs/angels_of_death.v1.json'

const pack = loadPack(angelsPack)

const VIEWS: { key: View; label: string }[] = [
  { key: 'roster', label: '建队' },
  { key: 'match', label: '对局' },
  { key: 'rules', label: '规则查询' },
]

export function App() {
  const currentView = useViewStore((s) => s.currentView)
  const setView = useViewStore((s) => s.setView)
  const [q, setQ] = useState('')

  return (
    <div className="app">
      <header className="topbar">
        <h1>Kill Team 战棋助手</h1>
        <nav>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              className={currentView === v.key ? 'active' : ''}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="content">
        {currentView === 'roster' && <RosterView />}
        {currentView === 'match' && <MatchView />}
        {currentView === 'rules' && (
          <section>
            <h2>规则查询（引擎参数化，不显示 GW 原文 D-29）</h2>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索 effect / 关键词…" />
            <ul className="list">
              {pack.effects
                .filter((e) => !q || `${e.label} ${e.modifier.kind} ${e.trigger.point}`.toLowerCase().includes(q.toLowerCase()))
                .map((e) => (
                  <li key={e.effectId}>
                    <strong>{e.label}</strong> — {e.modifier.kind} @ {e.trigger.point}
                    {e.rulesRef && <em>（见 {e.rulesRef.doc}#{e.rulesRef.section}）</em>}
                  </li>
                ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
