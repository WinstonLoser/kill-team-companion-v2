import { useState, useEffect } from 'react'
import { useViewStore } from './state/viewStore'
import { useRosterStore } from './state/rosterStore'
import { useMatchStore } from './state/matchStore'
import { useLocaleStore } from './state/localeStore'
import { useSettingsStore } from './state/settingsStore'
import { RosterView } from './ui/RosterView'
import { BattleView } from './ui/BattleView'
import { AnimationEngine } from './ui/components/Animation/AnimationEngine'
import { Button, IconButton, TopBar } from './ui/ds'

export function App() {
  const currentView = useViewStore((s) => s.currentView)
  const setView = useViewStore((s) => s.setView)
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const theme = useSettingsStore((s) => s.theme)
  const toggleTheme = useSettingsStore((s) => s.toggleTheme)

  // 主题落到 <html data-theme>：tokens/colors-light.css 以此选择器翻转配色。
  // dark 不需要该属性也能生效（token 定义在 :root），仍显式写上便于调试与 CSS 断言。
  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = theme
    el.style.colorScheme = theme
  }, [theme])

  function onReset() {
    if (!confirm('确定重置对局？建队和对局状态全部清空。')) return
    useRosterStore.getState().reset()
    useMatchStore.getState().reset()
    setView('roster')
  }

  return (
    <div className="app">
      <AnimationEngine />
      <TopBar
        title="Kill Team 战棋助手"
        eyebrow={currentView === 'roster' ? 'ROSTER' : 'BATTLE'}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}>
              {locale === 'en' ? 'EN | 中文' : '中文 | EN'}
            </Button>
            <IconButton
              icon={theme === 'dark' ? '☀' : '☾'}
              label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
              onClick={toggleTheme}
            />
            <Button variant="ghost" size="sm" onClick={onReset}>
              ⟳ 重置
            </Button>
          </>
        }
      />
      <main className="main-content">
        {currentView === 'roster' ? <RosterView /> : <BattleView />}
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
