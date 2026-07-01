import { useMatchStore, type MatchToken } from '../../state/matchStore'

// 1.13 单位面板 + 1.15 T4 状态反馈。
// 特工卡：耐伤阈值视觉（黄<起始 / 橙<一半=受创 / 灰阶=残废）+ 激活态。
// effect 剩余 TP / 受创自动修正由引擎两层属性模型产出（FR-2），本面板读引擎结果（v1 显示耐伤态）。
function woundClass(t: MatchToken, startWounds: number): string {
  if (!t.alive) return 'dead'
  if (t.wounds < startWounds / 2) return 'injured'
  if (t.wounds < startWounds) return 'hurt'
  return 'fresh'
}

export function UnitPanel({ startWoundsOf }: { startWoundsOf: (uid: string) => number }) {
  const tokens = useMatchStore((s) => s.tokens)
  const turn = useMatchStore((s) => s.turn)
  const selected = useMatchStore((s) => s.selected)
  const setSelected = useMatchStore((s) => s.setSelected)
  const setIntercept = useMatchStore((s) => s.setIntercept)

  const sides: ('a' | 'b')[] = ['a', 'b']
  return (
    <div className="unit-panel">
      {sides.map((side) => (
        <div key={side} className={`unit-side ${side}`}>
          <h4>{side.toUpperCase()} 方</h4>
          <ul className="unit-list">
            {tokens.filter((t) => t.side === side).map((t) => {
              const cls = woundClass(t, startWoundsOf(t.uid))
              const ready = Boolean(turn.operatives[t.uid]?.ready)
              return (
                <li
                  key={t.uid}
                  className={`unit-card ${cls} ${selected === t.uid ? 'sel' : ''} ${ready ? 'ready' : ''}`}
                  onClick={() => { setSelected(t.uid); setIntercept(null) }}
                >
                  <span className="uc-name">{t.name}</span>
                  <span className="uc-wounds">耐伤 {t.wounds}{!t.alive && ' ✕'}</span>
                  {ready && <span className="uc-tag">激活中</span>}
                  {cls === 'injured' && <span className="uc-tag warn">受创</span>}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
