import { useMatchStore, type LogKind } from '../../state/matchStore'

// 1.15 T3：日志回放面板。按时间倒序渲染动作日志；筛选(全部/射击/近战/计谋/回合/计分/部署)。
// 结算类条目 [▶回放]（重新展开该 ResolutionLog 流水线）；[↶回滚到此] 回退到该事件前（会话内 D-20）。
// v1：回放重展最近一次 currentLog；全局回退映射到最近一次结算撤销（FR-16）。
const FILTERS: (LogKind | 'all')[] = ['all', 'shoot', 'melee', 'ploy', 'turn', 'score', 'deploy']

export function LogPanel({ onReplay, onRollbackToHere }: { onReplay: () => void; onRollbackToHere: () => void }) {
  const log = useMatchStore((s) => s.log)
  const filter = useMatchStore((s) => s.logFilter)
  const setFilter = useMatchStore((s) => s.setLogFilter)
  const hasLog = useMatchStore((s) => Boolean(s.currentLog))
  const hasLast = useMatchStore((s) => Boolean(s.lastShot))

  const shown = filter === 'all' ? log : log.filter((e) => e.kind === filter)

  return (
    <div className="log-panel">
      <h4>历史</h4>
      <div className="log-filters">
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? '全部' : f}</button>
        ))}
      </div>
      <ul className="log-list">
        {shown.length === 0 && <li className="muted">（无）</li>}
        {shown.map((e) => (
          <li key={e.id} className={`log-entry ${e.kind}`}>
            <span className={`log-kind ${e.kind}`}>{e.kind}</span>
            <span className="log-text">{e.text}</span>
            {(e.kind === 'shoot' || e.kind === 'melee') && (
              <>
                <button className="link-btn" disabled={!hasLog} onClick={onReplay}>▶回放</button>
                <button className="link-btn" disabled={!hasLast} onClick={onRollbackToHere}>↶回滚到此</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
