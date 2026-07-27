import { useState } from 'react'
import type { RosterLegalityResult } from '../../rules'

/**
 * T5：合法性。钉在栏底，默认只给一行判定 —— 逐条清单大多数时候是噪音，
 * 真正要看的是「能不能进对局」。违规时默认展开，并保留点击定位（P13）。
 */
export function LegalityPanel({
  result,
  onLocate,
}: {
  result: RosterLegalityResult
  onLocate?: () => void
}) {
  const warnCount = result.checks.filter((c) => c.status === 'warn').length
  const [open, setOpen] = useState(false)
  // 未选阵营时没有检查项可看，别把面板展开成空壳
  const pending = result.checks.length === 0
  const showDetail = !pending && (open || (!result.legal && warnCount > 0))

  return (
    <div className={`lp-panel ${result.legal ? 'is-ok' : 'is-warn'}`}>
      <button
        className="lp-verdict"
        onClick={() => setOpen(!open)}
        aria-expanded={showDetail}
        disabled={pending}
        title={pending ? '先选阵营' : showDetail ? '收起检查项' : '展开检查项'}
      >
        <span className={`ds-badge ${result.legal ? 'ds-badge--success' : pending ? '' : 'ds-badge--danger'}`}>
          {pending ? '待选阵营' : result.legal ? '合规' : `${warnCount} 项违规`}
        </span>
        <span className="lp-verdict-text">
          {pending ? '选定阵营后开始检查' : result.legal ? '阵容可进入对局' : '解决后才能进入对局'}
        </span>
        {!pending && <span className="lp-chevron" aria-hidden="true">{showDetail ? '▾' : '▸'}</span>}
      </button>

      {showDetail && result.checks.length > 0 && (
        <ul className="lp-list">
          {result.checks.map((c) => (
            <li
              key={c.key}
              className={`lp-item ${c.status === 'warn' ? 'is-warn' : 'is-ok'}`}
              onClick={c.status === 'warn' ? onLocate : undefined}
              title={c.status === 'warn' && onLocate ? '点击定位到特工/装备' : undefined}
            >
              <span className={`ds-badge ${c.status === 'ok' ? 'ds-badge--success' : 'ds-badge--danger'}`}>
                {c.status === 'ok' ? 'OK' : '违规'}
              </span>
              <span className="lp-item-body">
                <strong>{c.label}</strong>
                {c.detail && <span className="muted"> {c.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
