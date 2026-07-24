import { useState, useEffect } from 'react'
import { useViewStore, type View } from './state/viewStore'
import { useRosterStore } from './state/rosterStore'
import { useMatchStore } from './state/matchStore'
import { useLocaleStore } from './state/localeStore'
import { loadPack } from '.'
import { MatchView } from './ui/MatchView'
import { SimpleMatchView } from './ui/SimpleMatchView'
import { RosterView } from './ui/RosterView'
import { TestLab } from './ui/test-lab/TestLab'
import { AbilityLab } from './ui/test-lab/AbilityLab'
import { AnimationLab } from './ui/test-lab/AnimationLab'
import { RulesSearch } from './ui/match/RulesQuery'
import { AnimationEngine } from './ui/components/Animation/AnimationEngine'
import angelsPack from './data/packs/angels_of_death.v1.json'
import legionariesPack from './data/packs/legionaries.v1.json'
import plaguePack from './data/packs/plague_marines.v1.json'
import chaosCultPack from './data/packs/chaos_cult.v1.json'

const TESTLAB_PACKS = [
  { id: 'angels_of_death', name: '死亡天使', pack: loadPack(angelsPack as any) },
  { id: 'legionaries', name: '军团兵', pack: loadPack(legionariesPack as any) },
  { id: 'plague_marines', name: '瘟疫战士', pack: loadPack(plaguePack as any) },
  { id: 'chaos_cult', name: '混沌教派', pack: loadPack(chaosCultPack as any) },
]

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

  return (
    <div className="app">
      <AnimationEngine />
      <header className="topbar">
        <h1>Kill Team 战棋助手</h1>
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
          {VIEWS.map((v) => (
            <button key={v.key} className={currentView === v.key ? 'active' : ''} onClick={() => setView(v.key)}>
              {v.label}
            </button>
          ))}
        </nav>
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
      <main className="main-content">
        {currentView === 'roster' && <RosterView />}
        {currentView === 'match' && <MatchView />}
        {currentView === 'simpleMatch' && <SimpleMatchView />}
        {currentView === 'abilityLab' && <AbilityLab />}
        {currentView === 'testLab' && <TestLab packs={TESTLAB_PACKS} />}
        {currentView === 'animationLab' && <AnimationLab packs={TESTLAB_PACKS} />}
        {currentView === 'rules' && <RulesSearch />}
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
