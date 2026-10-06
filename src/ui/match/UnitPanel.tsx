import { useMatchStore, packOfFaction } from '../../state/matchStore'
import { ActionBar } from './ActionBar'
import { getAvatarUrl } from '../../utils/avatars'

export function UnitPanel({startWoundsOf,sideFilter,onPortraitClick,actionBarProps}:{startWoundsOf:(uid:string)=>number;sideFilter?:'a'|'b';onPortraitClick?:(uid:string)=>void;actionBarProps?:any}) {
  const s=useMatchStore()
  return <div className="unit-panel">{(sideFilter ? [sideFilter] : ['a','b'] as const).map(side=>{
    const team=s.tokens.filter(t=>t.side===side)
    const ready=team.filter(t=>t.alive && s.turn.operatives[t.uid]?.ready !== false).length
    return <section key={side} className={`team-panel ${side} ${s.turn.activePlayer===side?'taking-turn':''}`}>
      <header className="team-heading"><div><strong>{side.toUpperCase()} 方阵容</strong><small>{ready} 待激活 / {team.filter(t=>t.alive).length} 存活</small></div><div className="team-resources"><span>CP <b>{s.turn.cp[side]}</b></span><span>VP <b>{s.vp[side]}</b></span></div></header>
      <div className="team-list">{team.map(t=>{
        const active=s.turn.activeOpId===t.uid
        const exhausted=s.turn.operatives[t.uid]?.ready===false
        const selected=s.selected===t.uid
        const canActivate=t.alive && t.placed && !exhausted && !s.turn.activeOpId && !s.lastShot && s.turn.activePlayer===side
        const status=!t.alive?'已残废':active?(s.reactionUid===t.uid?'反应中':'行动中'):exhausted?'待机':'就绪'
        const max=startWoundsOf(t.uid)
        return <div key={t.uid} className={`team-unit ${selected?'selected':''} ${!t.alive?'incapacitated':''}`}>
          <button className="unit-select" aria-label={`选择 ${t.name}`} aria-pressed={selected} onClick={()=>{s.setSelected(t.uid);s.setIntercept(null)}}>
            <img alt="" src={getAvatarUrl(t.factionId,t.opId)} />
            <span className="unit-info"><strong>{t.name}</strong><span>{t.order==='CONCEAL'?'隐匿':'交战'} · {status}</span><span className="health-track"><span style={{width:`${Math.max(0,t.wounds)/max*100}%`}} /></span></span>
            <span className="unit-wounds">{t.wounds}<small>/{max}</small></span>
          </button>
          {selected && <div className="unit-controls"><button onClick={()=>onPortraitClick?.(t.uid)}>数据卡</button>{canActivate && <button className="primary" onClick={()=>s.activate(t.uid,t.side)}>激活该特工 ▶</button>}{s.canReact(t.uid) && <button className="primary" onClick={()=>s.react(t.uid)}>反应 · 1 AP</button>}</div>}
          {active && selected && actionBarProps && <ActionBar {...actionBarProps} themeColor={`rgb(${packOfFaction(t.factionId).faction.theme?.ui?.primaryRgb ?? '227,174,98'})`} />}
        </div>
      })}</div>
    </section>
  })}</div>
}
