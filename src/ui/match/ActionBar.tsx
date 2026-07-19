import type { Side } from '../../state/matchStore'
import { ACTION_AP, type ActionType, type Order } from '../../state/turnStateMachine'

// 行动指挥区：激活 → 选命令（交战/隐匿）→ 行动菜单（AP 预算）→ 结束激活。
// 纯展示 + 回调：合法性 canDo 由 PlayView 用 checkAction 预算后传入。
const MOVE_ACTIONS: { a: ActionType; label: string }[] = [
  { a: 'MOVE', label: '转移' },
  { a: 'DASH', label: '冲刺' },
  { a: 'FALL_BACK', label: '后撤' },
  { a: 'CHARGE', label: '冲锋' },
]
const ATTACK_ACTIONS: { a: ActionType; label: string; k: 'SHOOT' | 'FIGHT' }[] = [
  { a: 'SHOOT', label: '射击', k: 'SHOOT' },
  { a: 'FIGHT', label: '近战', k: 'FIGHT' },
]

export function ActionBar({
  active,
  activated,
  order,
  apl,
  apUsed,
  canDo,
  pendingMove,
  pendingAttack,
  hasLastShot,
  canUndoAction,
  onActivate,
  onSelectOrder,
  onPickMove,
  onPickAttack,
  onUndoAction,
  onEndActivation,
  onEndTP,
  onUndo,
  movePreview,
  onConfirmMove,
  onCancelMove,
}: {
  active: Side
  activated: boolean
  order: Order | null
  apl: number
  apUsed: number
  canDo: Record<ActionType, boolean>
  pendingMove: ActionType | null
  pendingAttack: 'SHOOT' | 'FIGHT' | null
  hasLastShot: boolean
  canUndoAction: boolean
  movePreview?: boolean
  onActivate: () => void
  onSelectOrder: (order: Order) => void
  onPickMove: (a: ActionType) => void
  onConfirmMove?: () => void
  onCancelMove?: () => void
  onPickAttack: (k: 'SHOOT' | 'FIGHT') => void
  onUndoAction: () => void
  onEndActivation: () => void
  onEndTP: () => void
  onUndo: () => void
}) {
  const apLeft = apl - apUsed

  return (
    <div className={`action-bar ${active}`} style={{ background: 'transparent', padding: 0, boxShadow: 'none' }}>
      {!activated ? (
        hasLastShot && (
          <div className="action-row">
            <button onClick={onUndo} className="rollback-btn" style={{ width: '100%' }} title="撤销上次结算">↶ 回滚上次结算</button>
          </div>
        )
      ) : (
        <>
          <div className="ab-orders">
            <span className="muted ab-label">命令</span>
            <button className={`order-btn eng ${order === 'ENGAGED' ? 'on' : ''}`} onClick={() => onSelectOrder('ENGAGED')}>交战</button>
            <button className={`order-btn con ${order === 'CONCEALED' ? 'on' : ''}`} onClick={() => onSelectOrder('CONCEALED')}>隐匿</button>
            <span className="ap-display">AP <strong>{apUsed}</strong>/{apl}（剩 {apLeft}）</span>
          </div>
          <div className="ab-actions">
            {MOVE_ACTIONS.map(({ a, label }) => (
              <button
                key={a}
                className={`action-chip ${pendingMove === a ? 'armed move' : ''}`}
                disabled={!canDo[a]}
                onClick={() => onPickMove(a)}
                title={`${label}（${ACTION_AP[a]}AP）`}
              >
                {label}<span className="chip-ap">{ACTION_AP[a]}</span>
              </button>
            ))}
            {ATTACK_ACTIONS.map(({ a, label, k }) => (
              <button
                key={a}
                className={`action-chip ${pendingAttack === k ? 'armed atk' : ''}`}
                disabled={!canDo[a]}
                onClick={() => onPickAttack(k)}
                title={`${label}（${ACTION_AP[a]}AP）`}
              >
                {label}<span className="chip-ap">{ACTION_AP[a]}</span>
              </button>
            ))}
          </div>
          <div className="action-row">
            {movePreview ? (
              <>
                <button className="main-btn" style={{ background: '#39d98a', color: '#111' }} onClick={onConfirmMove} title="确认移动到目标位置">确认移动 ▶</button>
                <button className="rollback-btn" onClick={onCancelMove} title="取消移动并恢复位置">取消（回退）</button>
              </>
            ) : (
              <>
                <button className={`main-btn ${active}`} onClick={onEndActivation} title="结束后该特工本回合不能再行动">结束激活</button>
                <button className="rollback-btn" disabled={!canUndoAction} onClick={onUndoAction} title="撤销当前特工的上一步行动（恢复 AP/位置）">↶ 回退上步</button>
                {hasLastShot && <button onClick={onUndo} className="rollback-btn">↶ 回滚结算</button>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
