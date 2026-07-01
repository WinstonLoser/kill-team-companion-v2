import type { Side } from '../../state/matchStore'

// 1.13 T3：行动指挥区。按状态机当前态渲染 push；永远一个主操作大按钮(56px) + 1-3 次操作。
// 主按钮用主动玩家阵营色描边。结束类附内联微提示。纯展示 + 回调，不直接持状态机逻辑。
export function ActionBar({
  active,
  selectedName,
  selectedSide,
  activated,
  hasLastShot,
  onActivate,
  onEndActivation,
  onEndTP,
  onUndo,
}: {
  active: Side
  selectedName: string | null
  selectedSide: Side | null
  activated: boolean
  hasLastShot: boolean
  onActivate: () => void
  onEndActivation: () => void
  onEndTP: () => void
  onUndo: () => void
}) {
  const canSelect = selectedSide === active
  const push = !selectedName
    ? `轮到 ${active.toUpperCase()}：点一名己方特工`
    : !canSelect
      ? `选中了${selectedSide === 'a' ? 'A' : 'B'}方特工（仅查看）；请激活 ${active.toUpperCase()} 方`
      : !activated
        ? `${selectedName}：先激活才能行动`
        : `${selectedName} 已激活：拖动移动 / 点敌方一击结算`

  return (
    <div className={`action-bar ${active}`}>
      <div className="push-text">{push}</div>
      <div className="action-row">
        {!activated ? (
          <button
            className={`primary main-btn ${active}`}
            disabled={!canSelect}
            onClick={onActivate}
            title={!canSelect ? '请先选己方特工' : '激活选中特工'}
          >
            激活选中 ▶
          </button>
        ) : (
          <button
            className={`main-btn ${active}`}
            onClick={onEndActivation}
            title="结束后该特工本回合不能再行动"
          >
            结束激活
          </button>
        )}
        <button
          className="primary"
          onClick={onEndTP}
          title="结束转折点 → 计分 + effect 到期结算"
        >
          结束转折点
        </button>
        {hasLastShot && (
          <button onClick={onUndo} className="rollback-btn" title="撤销上次结算，恢复耐伤（会话内 FR-16）">↶ 回滚上次结算</button>
        )}
      </div>
    </div>
  )
}
