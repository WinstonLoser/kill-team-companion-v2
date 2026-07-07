import { useState } from 'react'
import { useMatchStore } from '../../state/matchStore'

// 1.13 T8 流水线展开态 + 1.15 T1 单步回滚 + T2 每步依据展开。
// 订阅 currentLog(ResolutionLog)；渲染步骤列表，cursor 之后变灰；
// 每步 [▾依据]（stepId/输入骰/applied/rejected/原文来源 rulesRef 占位 D-29）+ [◀回滚此步]；
// 底部 [确认伤亡 ▶]（唯一强制确认）。骰源就近切换在此区顶栏。
export function PipelineDrawer({
  onConfirm,
  onQueryRule,
}: {
  onConfirm: () => void
  onQueryRule: (hint: string) => void
}) {
  const log = useMatchStore((s) => s.currentLog)
  const rollbackStep = useMatchStore((s) => s.rollbackStep)
  const diceSource = useMatchStore((s) => s.diceSource)
  const setDiceSource = useMatchStore((s) => s.setDiceSource)
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="pipeline-drawer">
      <div className="pipeline-top">
        <strong>流水线{log ? ` · ${log.pipelineKind}` : ''}</strong>
        <button
          className={`dice-toggle ${diceSource}`}
          onClick={() => setDiceSource(diceSource === 'electronic' ? 'manual' : 'electronic')}
          title="就近切换电子骰 / 物理骰（FR-3 两源同后续）"
        >
          {diceSource === 'electronic' ? '电子骰 ⇄ 物理骰' : '物理骰 ⇄ 电子骰'}
        </button>
      </div>

      {!log ? (
        <p className="muted">尚无结算。一击结算后此处展开步骤。</p>
      ) : (
        <ol className="pipeline-steps">
          {log.records.map((tr, i) => {
            const greyed = i >= log.cursor
            return (
              <li key={i} className={`pipe-step ${greyed ? 'greyed' : ''}`}>
                <div className="pipe-head">
                  <span className="pipe-sid">{tr.stepId}</span>
                  <span className="pipe-summary">{tr.summary}</span>
                  <button className="link-btn" onClick={() => setOpen(open === i ? null : i)}>▾依据</button>
                  <button className="rollback-btn" onClick={() => rollbackStep(i)} title="回滚到此步（保留此前，丢弃其后）">◀回滚</button>
                </div>
                {open === i && (
                  <div className="pipe-detail">
                    {tr.dice && tr.dice.length > 0 && (
                      <div>骰：{tr.dice.map((d, j) => <span key={j} className="dice-chip sm">{d.nat}{d.grade === 'CRITICAL' ? '★' : ''}</span>)}</div>
                    )}
                    {tr.appliedEffectIds.length > 0 && <div className="ok">生效 effect：{tr.appliedEffectIds.join(', ')}</div>}
                    {tr.rejectedEffectIds.length > 0 && (
                      <div className="warn">被拒 effect：{tr.rejectedEffectIds.map((r) => `${r.id}(${r.reason})`).join('; ')}</div>
                    )}
                    {tr.rulings && tr.rulings.length > 0 && <div className="warn">人工裁定：{tr.rulings.join(', ')}</div>}
                    <button className="link-btn" onClick={() => onQueryRule(tr.stepId)}>查看规则要点 ▸</button>
                    <span className="muted"> 来源：KT Lite 规则（本地 docs/rules，不显示原文 D-29）</span>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <button className="primary confirm-btn" disabled={!log} onClick={onConfirm}>
        确认伤亡 ▶
      </button>
    </div>
  )
}
