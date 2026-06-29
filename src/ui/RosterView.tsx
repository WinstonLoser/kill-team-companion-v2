import { useState } from 'react'
import { loadPack } from '../'
import { useViewStore } from '../state/viewStore'
import angelsPack from '../data/packs/angels_of_death.v1.json'

const pack = loadPack(angelsPack)
const tactics = pack.effects.filter((e) => e.source.startsWith('chapterTactic:'))

export function RosterView() {
  const setView = useViewStore((s) => s.setView)
  const [picked, setPicked] = useState<string[]>([pack.operatives[0]!.operativeId])
  const [tacticPick, setTacticPick] = useState<string[]>([])

  const toggleOp = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const toggleTactic = (id: string) =>
    setTacticPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 2 ? p : [...p, id]))

  const opOk = picked.length >= 1
  const tacticOk = tacticPick.length === 2
  const legal = opOk && tacticOk

  return (
    <section>
      <h2>建队 · {pack.faction.name}（无点数 D-30）</h2>
      <div className="cols">
        <div>
          <h3>特工（{picked.length}）</h3>
          <ul className="list">
            {pack.operatives.map((o) => (
              <li key={o.operativeId}>
                <label className="cover">
                  <input type="checkbox" checked={picked.includes(o.operativeId)} onChange={() => toggleOp(o.operativeId)} />
                  <strong>{o.name}</strong> — 豁免{o.stats.save}+ 耐伤{o.stats.wounds} 移动{o.stats.move}"
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>战团战术（{tacticPick.length}/2，8 选 2）</h3>
          <ul className="list">
            {tactics.map((e) => (
              <li key={e.effectId}>
                <label className="cover">
                  <input type="checkbox" checked={tacticPick.includes(e.effectId)} onChange={() => toggleTactic(e.effectId)} />
                  {e.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="legality">
        <h3>合法性</h3>
        <ul className="list">
          <li>{opOk ? '✓' : '✗'} 特工来源（{picked.length} 名）</li>
          <li>{tacticOk ? '✓' : '✗'} 战团战术 2/2</li>
          <li>✓ 装备限制（阵营包无限制项）</li>
        </ul>
        <button className="primary" disabled={!legal} onClick={() => setView('match')}>
          {legal ? '进入对局 ▶' : '先满足合法性'}
        </button>
      </div>
    </section>
  )
}
