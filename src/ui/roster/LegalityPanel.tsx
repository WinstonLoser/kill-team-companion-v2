import type { RosterLegalityResult } from '../../rules'

// T5：合法性面板。读 buildConstraints 经 evaluateLegality 算出的 checks，逐条渲染。
// 桌面右侧固定、平板底部抽屉（index.css 响应式）。违规红字 + 定位（detail 含特工/武器名）。
// 全绿才解锁「进入对局」（门禁逻辑在 RosterView，本组件纯展示）。
export function LegalityPanel({ result, sideLabel }: { result: RosterLegalityResult; sideLabel: string }) {
  return (
    <aside className={`legality ${result.legal ? '' : 'has-warn'}`}>
      <h3>合法性 · {sideLabel}</h3>
      <ul className="list">
        {result.checks.map((c) => (
          <li key={c.key} className={c.status === 'warn' ? 'warn' : 'ok'}>
            <strong>{c.status === 'ok' ? '✓' : '✗'} {c.label}</strong>
            <span className="muted"> {c.detail}</span>
          </li>
        ))}
        {result.checks.length === 0 && <li className="muted">未选阵营</li>}
      </ul>
      <p className={`verdict ${result.legal ? 'ok' : 'warn'}`}>
        {result.legal ? '阵容合规' : '存在违规，先解决再进入对局'}
      </p>
    </aside>
  )
}
