import { useViewStore, type View } from './state/viewStore'

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
        <p>当前视图：<strong>{currentView}</strong>（占位，后续 story 实现）</p>
      </main>
    </div>
  )
}
