import { useState } from 'react'
import { useMatchStore, packOfFaction, type Side } from '../../state/matchStore'

export function StratagemPanel() {
  const state = useMatchStore()
  const [expanded, setExpanded] = useState(false)
  const [side, setSide] = useState<Side>(state.turn.activePlayer)
  const [message, setMessage] = useState('')
  const token = state.tokens.find(t => t.side === side)
  if (!token) return null
  const ploys = packOfFaction(token.factionId).stratagems?.filter(p => p.phase === 'ENGAGEMENT') ?? []
  return <div className="stratagem-panel">
    <button className="strat-toggle-btn" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>交战计谋 · 查看与使用 {expanded ? '▾' : '▸'}</button>
    {expanded && <div className="strat-list">
      <div className="row">{(['a','b'] as const).map(s => <button key={s} className={s === side ? 'active' : ''} onClick={() => {setSide(s);setMessage('')}}>{s.toUpperCase()} 方 · {state.turn.cp[s]} CP</button>)}</div>
      <p className="muted">先核对卡面的触发时机与对象。使用后扣除 CP；特殊效果按规则说明及裁判面板处理。</p>
      {message && <p role="status">{message}</p>}
      {ploys.map(p => {
        const used = (state.usedPloys[`${side}:${p.id}:tp${state.turn.turningPoint}`] ?? 0) >= (p.useLimit.perTurningPoint ?? 1)
        const spent = (state.usedPloys[`${side}:${p.id}:battle`] ?? 0) >= (p.useLimit.perBattle ?? Infinity)
        return <button key={p.id} className={`strat-card ${used ? 'on' : ''}`} disabled={used || spent || state.turn.cp[side] < p.cp} onClick={() => {
          const result = state.usePloy(side,p.id)
          setMessage(result.ok ? `已使用 ${p.name}，支付 ${p.cp} CP。请完成卡面效果。` : result.reason ?? '不可用')
        }}><span className="strat-name">{p.name}<small className="ploy-description">{p.description}</small></span><span className="strat-cp">{used || spent ? '已用' : `${p.cp} CP`}</span></button>
      })}
    </div>}
  </div>
}
