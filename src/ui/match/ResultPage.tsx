import { useMatchStore } from '../../state/matchStore'
import { useViewStore } from '../../state/viewStore'

export function ResultPage({onQueryRule}:{onQueryRule:()=>void}) {
  const s=useMatchStore()
  function exportLog() {
    const text=['# Kill Team 对局记录',`结果：${s.winner}`,`VP A:${s.vp.a} / B:${s.vp.b}`,'',...s.log.slice().reverse().map(l=>`- ${l.text}`)].join('\n')
    const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}))
    const a=document.createElement('a');a.href=url;a.download='kill-team-battle.md';a.click();URL.revokeObjectURL(url)
  }
  return <section className="result-page">
    <span className="eyebrow">MISSION COMPLETE / 战斗结束</span>
    <h2>{s.winner ?? '四个转折点已完成'}</h2>
    <p className="muted">双方完成了这场战斗。查看队伍情况，保存记录，或用当前阵容再来一局。</p>
    <div className="result-teams">{(['a','b'] as const).map(side=><div className={`result-team ${side}`} key={side}><span>{side.toUpperCase()} 方</span><strong>{s.vp[side]}<small> VP</small></strong><p>存活 {s.tokens.filter(t=>t.side===side && t.alive).length} / {s.tokens.filter(t=>t.side===side).length} 名特工</p></div>)}</div>
    <div className="row"><button className="primary" onClick={()=>{s.reset();useViewStore.getState().setView('roster')}}>保留阵容 · 再开一局</button><button onClick={exportLog}>导出战斗记录</button><button onClick={onQueryRule}>查看胜负规则</button></div>
  </section>
}
