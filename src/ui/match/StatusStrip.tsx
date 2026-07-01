import { useMatchStore } from '../../state/matchStore'

// 1.13 T2 / 1.16 T3：状态带。转折点 X/4 · 阶段 · 主动玩家(阵营色) · CP/AP · VP 常驻。
// 切换主动玩家由色带横扫表达（D-19 不弹模态）。
export function StatusStrip() {
  const turn = useMatchStore((s) => s.turn)
  const vp = useMatchStore((s) => s.vp)
  const active = turn.activePlayer
  return (
    <div className={`status-strip ${active}`}>
      <span className="ss-item">转折点 <strong>{turn.turningPoint}/4</strong></span>
      <span className="ss-item">阶段 <strong>{turn.phase}</strong></span>
      <span className={`ss-item active-player ${active}`}>主动 <strong>{active.toUpperCase()}</strong></span>
      <span className="ss-item vp">VP <strong>A:{vp.a} B:{vp.b}</strong></span>
    </div>
  )
}
