import { useMatchStore } from '../../state/matchStore'

// 1.13 T2 / 1.16 T3：状态带。转折点 X/4 · 阶段 · 主动玩家(阵营色) · CP/AP · VP 常驻。
// 选中特工显示有效 APL/移动（effectiveApl/effectiveMove 接线）。
export function StatusStrip() {
  const turn = useMatchStore((s) => s.turn)
  const vp = useMatchStore((s) => s.vp)
  const selected = useMatchStore((s) => s.selected)
  const effectiveAplOf = useMatchStore((s) => s.effectiveAplOf)
  const effectiveMoveOf = useMatchStore((s) => s.effectiveMoveOf)
  const active = turn.activePlayer
  const selApl = selected ? effectiveAplOf(selected) : null
  const selMove = selected ? effectiveMoveOf(selected) : null
  return (
    <div className={`status-strip ${active}`}>
      <span className="ss-item">转折点 <strong>{turn.turningPoint}/4</strong></span>
      <span className="ss-item">阶段 <strong>{turn.phase}</strong></span>
      <span className={`ss-item active-player ${active}`}>主动 <strong>{active.toUpperCase()}</strong></span>
      {selApl !== null && <span className="ss-item">APL <strong>{selApl}</strong></span>}
      {selMove !== null && <span className="ss-item">移动 <strong>{selMove}"</strong></span>}
      <span className="ss-item vp">VP <strong>A:{vp.a} B:{vp.b}</strong></span>
    </div>
  )
}
