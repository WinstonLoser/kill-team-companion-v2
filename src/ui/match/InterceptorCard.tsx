// 1.13 T5：拦截卡（非阻塞，不遮棋盘，可一键关）。
// 列每条缺失条件 + 规则要点入口（接 1.17 规则查询）。
// 行动限制类（AP 不足等）用按钮置灰 + tooltip，不走卡片（在 ActionBar 处理）。
export function InterceptorCard({
  title,
  reasons,
  onClose,
  onQueryRule,
}: {
  title: string
  reasons: string[]
  onClose: () => void
  onQueryRule?: () => void
}) {
  return (
    <div className="intercept-card">
      <strong>⚠ {title}</strong>
      <button className="intercept-close" onClick={onClose} title="关闭">✕</button>
      <ul>{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
      {onQueryRule && <button className="link-btn" onClick={onQueryRule}>查看规则要点 ▸</button>}
    </div>
  )
}
