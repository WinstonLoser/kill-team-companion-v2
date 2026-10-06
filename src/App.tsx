import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useViewStore, type View } from './state/viewStore'
import { useRosterStore } from './state/rosterStore'
import { useMatchStore } from './state/matchStore'
import { useLocaleStore } from './state/localeStore'
import { MatchView } from './ui/MatchView'
import { SimpleMatchView } from './ui/SimpleMatchView'
import { RosterView } from './ui/RosterView'
const TestLab = lazy(() => import('./ui/test-lab/TestLab').then(m => ({ default: m.TestLab })))
const AbilityLab = lazy(() => import('./ui/test-lab/AbilityLab').then(m => ({ default: m.AbilityLab })))
const AnimationLab = lazy(() => import('./ui/test-lab/AnimationLab').then(m => ({ default: m.AnimationLab })))
import { RulesSearch } from './ui/match/RulesQuery'
import { AnimationEngine } from './ui/components/Animation/AnimationEngine'
import { FACTION_REGISTRY } from './data/packs'

const TESTLAB_PACKS = FACTION_REGISTRY.map((f) => ({ id: f.id, name: f.name, pack: f.pack }))

const VIEWS: { key: View; label: string }[] = [
  { key: 'roster', label: '建队' },
  { key: 'match', label: '对局' },
  { key: 'simpleMatch', label: '简化对局' },
  { key: 'abilityLab', label: '技能实验室' },
  { key: 'testLab', label: 'UI 测试实验室' },
  { key: 'animationLab', label: '动画实验室' },
  { key: 'rules', label: '规则查询' },
]

export function App() {
  const currentView = useViewStore((s) => s.currentView)
  const setView = useViewStore((s) => s.setView)
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  const [showTools, setShowTools] = useState(false)
  const phase = useMatchStore(s => s.phase)
  const mapless = useMatchStore(s => s.maplessMode)
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {mainRef.current?.scrollTo({top:0})},[currentView,phase])
  const steps = ['组建小队', '战场与部署', '战略准备', '交替行动', '战斗结果']
  const step = currentView === 'roster' ? 0 : phase === 'map-select' || phase === 'deploy' ? 1 : phase === 'strategy' ? 2 : phase === 'ended' ? 4 : 3
  function navigate(view: View) {
    if ((view === 'match' || view === 'simpleMatch') && phase !== 'map-select') setView(mapless ? 'simpleMatch' : 'match')
    else setView(view)
  }
  return (
    <div className="app">
      <AnimationEngine />
      <header className="topbar">
        <h1><span className="brand-mark">KT</span><span>战棋助手<small>KILL TEAM COMPANION</small></span></h1>
        <div style={{ marginLeft: '1rem' }}>
          <button 
            onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
            className="lang-switcher"
            style={{ padding: '4px 8px', borderRadius: '4px' }}
          >
            {locale === 'en' ? 'EN | 中文' : '中文 | EN'}
          </button>
        </div>
        <nav>
          {VIEWS.filter(v => ['roster','match','simpleMatch','rules'].includes(v.key)).map((v) => (
            <button key={v.key} className={currentView === v.key ? 'active' : ''} onClick={() => navigate(v.key)}>
              {v.label}
            </button>
          ))}
        </nav>
        <div className="tools-menu"><button aria-expanded={showTools} onClick={() => setShowTools(!showTools)}>更多工具 ▾</button>{showTools && <div className="tools-popover">{VIEWS.filter(v => v.key.endsWith('Lab')).map(v => <button key={v.key} onClick={() => {setView(v.key);setShowTools(false)}}>{v.label}</button>)}</div>}</div>
        <button
          className="reset-btn"
          onClick={() => {
            if (confirm('确定重置对局？建队和对局状态全部清空。')) {
              useRosterStore.getState().reset()
              useMatchStore.getState().reset()
              setView('roster')
            }
          }}
          title="重置：清空建队 + 对局，回到建队首页"
        >
          ⟳ 重置
        </button>
      </header>
      <ol className="journey" aria-label="游玩流程">{steps.map((label,i) => <li key={label} className={i === step ? 'current' : i < step ? 'complete' : ''} aria-current={i === step ? 'step' : undefined}><span>{i < step ? '✓' : String(i + 1).padStart(2, '0')}</span>{label}</li>)}</ol>
      <main ref={mainRef} className="main-content"><Suspense fallback={<div className="empty-state">正在载入工具…</div>}>
        {currentView === 'roster' && <RosterView />}
        {currentView === 'match' && <MatchView />}
        {currentView === 'simpleMatch' && <SimpleMatchView />}
        {currentView === 'abilityLab' && <AbilityLab />}
        {currentView === 'testLab' && <TestLab packs={TESTLAB_PACKS} />}
        {currentView === 'animationLab' && <AnimationLab packs={TESTLAB_PACKS} />}
        {currentView === 'rules' && <RulesSearch />}
      </Suspense></main>
    </div>
  )
}
