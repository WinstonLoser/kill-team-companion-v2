import { useState } from 'react'
import { useViewStore, type View } from './state/viewStore'
import { useLocaleStore } from './state/localeStore'
import { ResolveDemo } from './ui/ResolveDemo'
import { TestLab } from './ui/test-lab/TestLab'
import { loadPack } from './'
import angelsPack from './data/packs/angels_of_death.v1.json'
import legionariesPack from './data/packs/legionaries.v1.json'
import plagueMarinesPack from './data/packs/plague_marines.v1.json'

const packs = {
  angels_of_death: loadPack(angelsPack as any),
  legionaries: loadPack(legionariesPack as any),
  plague_marines: loadPack(plagueMarinesPack as any),
}

const VIEWS: { key: View; label: string }[] = [
  { key: 'testLab', label: 'UI 测试实验室' },
  { key: 'roster', label: '建队' },
  { key: 'match', label: '对局' },
  { key: 'rules', label: '规则查询' },
]

export function App() {
  const [activePackId, setActivePackId] = useState<keyof typeof packs>('angels_of_death')
  const pack = packs[activePackId]
  const currentView = useViewStore((s) => s.currentView)
  const setView = useViewStore((s) => s.setView)
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  return (
    <div className="app">
      <header className="topbar">
        <h1>Kill Team 战棋助手</h1>
        <div style={{ marginLeft: '1rem' }}>
          <select value={activePackId} onChange={(e) => setActivePackId(e.target.value as keyof typeof packs)}>
            <option value="angels_of_death">死亡天使 (Angels of Death)</option>
            <option value="legionaries">军团 (Legionaries)</option>
            <option value="plague_marines">瘟疫战士 (Plague Marines)</option>
          </select>
        </div>
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
        {currentView === 'roster' && (
          <section>
            <h2>{pack.faction.name}（阵营：死亡天使）</h2>
            <h3>特工</h3>
            <ul className="list">
              {pack.operatives.map((o) => (
                <li key={o.operativeId}>
                  <strong>{o.name}</strong> — 豁免{o.stats.save}+ 耐伤{o.stats.wounds} 移动{o.stats.move}" APL{o.stats.apl}
                </li>
              ))}
            </ul>
            <h3>武器</h3>
            <ul className="list">
              {pack.weapons.map((w) => (
                <li key={w.weaponId}>
                  <strong>{w.name}</strong>（{w.kind === 'RANGED' ? '射击' : '近战'}）— 攻击{w.profile.attacks} 命中{w.profile.hit}+ 伤{w.profile.normalDamage}/{w.profile.criticalDamage}{w.profile.range ? ` 射程${w.profile.range}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}
        {currentView === 'testLab' && <TestLab pack={pack} />}
        {currentView === 'match' && <ResolveDemo />}
        {currentView === 'rules' && (
          <section>
            <h2>规则查询（引擎参数化，不显示 GW 原文 D-29）</h2>
            <ul className="list">
              {pack.effects.map((e) => (
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
