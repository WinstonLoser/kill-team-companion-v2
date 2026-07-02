import { useState, useEffect } from 'react'
import { useViewStore, type View } from './state/viewStore'
import { MatchView } from './ui/MatchView'
import { RosterView } from './ui/RosterView'
import { RulesSearch } from './ui/match/RulesQuery'

const VIEWS: { key: View; label: string }[] = [
  { key: 'roster', label: '建队' },
  { key: 'match', label: '对局' },
  { key: 'rules', label: '规则查询' },
]

export function App() {
  const currentView = useViewStore((s) => s.currentView)
  const setView = useViewStore((s) => s.setView)

  return (
    <div className="app">
      <header className="topbar">
        <h1>Kill Team 战棋助手</h1>
        <nav>
          {VIEWS.map((v) => (
            <button key={v.key} className={currentView === v.key ? 'active' : ''} onClick={() => setView(v.key)}>
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
            <h2>规则查询（引擎参数化要点，不显示 GW 原文 D-29）</h2>
            <RulesSearch />
          </section>
        )}
      </main>
      <PortraitLockHint />
    </div>
  )
}

/** P15：竖屏提示「请横屏」（UX-OQ-7）。 */
function PortraitLockHint() {
  const mq = typeof window !== 'undefined' ? window.matchMedia('(orientation: portrait)') : null
  const check = () => Boolean(mq?.matches && window.innerWidth < 900)
  const [portrait, setPortrait] = useState(check)
  useEffect(() => {
    if (!mq) return
    const handler = () => setPortrait(check())
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mq])
  if (!portrait) return null
  return (
    <div className="portrait-hint">
      <strong>请横屏使用</strong>
      <p className="muted">Kill Team 战棋助手为横屏平板优化。</p>
    </div>
  )
}

