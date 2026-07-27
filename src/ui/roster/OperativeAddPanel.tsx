import type { FactionPack } from '../../rules'
import {
  addOperative,
  countOf,
  orderedTypes,
  selectLeader,
  type RosterPatch,
  type RosterState,
} from './rosterOps'

/**
 * 「添加特工」弹层：只在这里列出全部可选类型。
 *
 * 原来主界面常驻着「所有可招募类型 + 已入队实例」两层表格，信息量压过了
 * 「这队现在有谁」这个真正要看的东西。现在主列表只显示在队的人，
 * 招募是一个显式动作。
 *
 * 队长单独一组：规则上全队只有一名，选另一位是**替换**而非追加。
 */
export function OperativeAddPanel({
  pack,
  state,
  leaderIds,
  repeatableIds,
  maxTotal,
  onChange,
  onClose,
}: {
  pack: FactionPack
  state: RosterState
  leaderIds: Set<string>
  repeatableIds: Set<string>
  maxTotal: number
  onChange: (patch: RosterPatch) => void
  onClose: () => void
}) {
  const atCapacity = state.operativeIds.length >= maxTotal
  const types = orderedTypes(pack)
  const leaderTypes = types.filter((o) => leaderIds.has(o.operativeId))
  const otherTypes = types.filter((o) => !leaderIds.has(o.operativeId))
  const currentLeader = state.operativeIds.find((id) => leaderIds.has(id))

  const statLine = (op: FactionPack['operatives'][0]) =>
    `M${op.stats.move}" · APL${op.stats.apl} · SV${op.stats.save}+ · W${op.stats.wounds}`

  return (
    <div className="ds-scrim" onClick={onClose}>
      <div className="ds-modal oap-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-head">
          <div>
            <div className="ds-eyebrow">阵容 {state.operativeIds.length}/{maxTotal}</div>
            <h3 className="ds-display ds-display--md">添加特工</h3>
          </div>
          <button className="ds-modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>

        <div className="ds-modal-body oap-body">
          {leaderTypes.length > 0 && (
            <section className="oap-group">
              <h4 className="ds-eyebrow oap-group-title">队长（全队一名，选择即替换）</h4>
              <ul className="oap-list">
                {leaderTypes.map((op) => {
                  const isCurrent = currentLeader === op.operativeId
                  return (
                    <li key={op.operativeId} className={`oap-item ${isCurrent ? 'is-current' : ''}`}>
                      <div className="oap-info">
                        <span className="oap-name">{op.name}</span>
                        <span className="ds-stat oap-stats">{statLine(op)}</span>
                      </div>
                      <button
                        className={`ds-btn ds-btn--sm ${isCurrent ? 'ds-btn--secondary' : ''}`}
                        disabled={isCurrent}
                        onClick={() => onChange(selectLeader(pack, state, op.operativeId))}
                        title={isCurrent ? '已是本队队长' : `让 ${op.name} 担任队长`}
                      >
                        {isCurrent ? '现任' : '任命'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section className="oap-group">
            <h4 className="ds-eyebrow oap-group-title">队员</h4>
            <ul className="oap-list">
              {otherTypes.map((op) => {
                const count = countOf(state.operativeIds, op.operativeId)
                // 可复选类型不限个数（受总人数上限约束），其余每种一名
                const cap = repeatableIds.has(op.operativeId) ? maxTotal : 1
                const canAdd = !atCapacity && count < cap
                return (
                  <li key={op.operativeId} className="oap-item">
                    <div className="oap-info">
                      <span className="oap-name">
                        {op.name}
                        {count > 0 && <span className="ds-badge ds-badge--accent oap-count">已入队 ×{count}</span>}
                      </span>
                      <span className="ds-stat oap-stats">{statLine(op)}</span>
                    </div>
                    <button
                      className="ds-btn ds-btn--sm"
                      disabled={!canAdd}
                      onClick={() => onChange(addOperative(pack, state, op.operativeId))}
                      title={
                        atCapacity ? `阵容已满（上限 ${maxTotal} 名）`
                          : count >= cap ? `${op.name} 每队只能有一名`
                            : `把 ${op.name} 加入阵容`
                      }
                    >
                      添加
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
