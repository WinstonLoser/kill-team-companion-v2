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
  selectedName,
  selectedSide,
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
}: {
  active: Side
  selectedName: string | null
  selectedSide: Side | null
  activated: boolean
  order: Order | null
  apl: number
  apUsed: number
  canDo: Record<ActionType, boolean>
  pendingMove: ActionType | null
  pendingAttack: 'SHOOT' | 'FIGHT' | null
  hasLastShot: boolean
  canUndoAction: boolean
  onActivate: () => void
  onSelectOrder: (order: Order) => void
  onPickMove: (a: ActionType) => void
  onPickAttack: (k: 'SHOOT' | 'FIGHT') => void
  onUndoAction: () => void
  onEndActivation: () => void
  onEndTP: () => void
  onUndo: () => void
}) {
  const canSelect = selectedSide === active
  const apLeft = apl - apUsed
  const push = !selectedName
    ? `轮到 ${active.toUpperCase()}：点一名己方特工`
    : !canSelect
      ? `选中了${selectedSide === 'a' ? 'A' : 'B'}方特工（仅查看）；请激活 ${active.toUpperCase()} 方`
      : !activated
        ? `${selectedName}：先激活才能行动`
        : pendingMove
          ? `${selectedName} · ${pendingMove === 'MOVE' ? '转移' : pendingMove === 'DASH' ? '冲刺' : pendingMove === 'FALL_BACK' ? '后撤' : '冲锋'} 已选：拖拽特工移动（再点取消）`
          : pendingAttack
            ? `${selectedName} · ${pendingAttack === 'SHOOT' ? '射击' : '近战'} 已选：点敌方目标（再点取消）`
            : `${selectedName} 已激活：选命令 + 选行动`

  return (
    <div className={`action-bar ${active}`}>
      <div className="push-text">{push}</div>
      {!activated ? (
        <div className="action-row">
          <button className={`primary main-btn ${active}`} disabled={!canSelect} onClick={onActivate} title={!canSelect ? '请先选己方特工' : '激活选中特工'}>
            激活选中 ▶
          </button>
          <button className="primary" onClick={onEndTP} title="结束转折点 → 计分 + effect 到期结算">结束转折点</button>
          {hasLastShot && <button onClick={onUndo} className="rollback-btn" title="撤销上次结算">↶ 回滚上次结算</button>}
        </div>
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
            <button className={`main-btn ${active}`} onClick={onEndActivation} title="结束后该特工本回合不能再行动">结束激活</button>
            <button className="primary" onClick={onEndTP} title="结束转折点">结束转折点</button>
            <button className="rollback-btn" disabled={!canUndoAction} onClick={onUndoAction} title="撤销当前特工的上一步行动（恢复 AP/位置）">↶ 回退上步</button>
            {hasLastShot && <button onClick={onUndo} className="rollback-btn">↶ 回滚结算</button>}
          </div>
        </>
      )}
    </div>
  )
}
