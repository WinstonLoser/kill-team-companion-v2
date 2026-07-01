import { useMatchStore } from '../../state/matchStore'

// 1.16 T5：胜负结果页。4 TP 结束 → 全屏结果（VP 总高者胜 / 平局）；
// [再开一局] = window.location.reload()（D-20 刷新重置，无存档清理）。
export function ResultPage({ onQueryRule }: { onQueryRule: () => void }) {
  const winner = useMatchStore((s) => s.winner)
  const vp = useMatchStore((s) => s.vp)

  return (
    <div className="result-page">
      <h2>战斗结束</h2>
      <p className="outcome">胜负：<strong>{winner}</strong> — VP A:{vp.a} B:{vp.b}</p>
      {winner === '平局' && (
        <p className="muted">平局规则要点：<button className="link-btn" onClick={onQueryRule}>查看 ▸</button>（VP 总分相同）</p>
      )}
      <button className="primary main-btn" onClick={() => window.location.reload()}>再开一局</button>
    </div>
  )
}
