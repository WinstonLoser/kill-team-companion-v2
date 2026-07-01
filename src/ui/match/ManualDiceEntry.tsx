import { useState } from 'react'

// 1.13 T7：物理骰录入浮层（非全屏模态，可关）。6 面网格点选累加，再点减一；
// 显示「已录: [...] 总数 N/M ✓」；总数达标才确认。规避键盘输入（平板触控）。
// 确认 → 产出 number[]（每枚骰的面值）给流水线（FR-3 两源同后续）。
export function ManualDiceEntry({
  needed,
  label,
  onConfirm,
  onClose,
}: {
  needed: number
  label: string
  onConfirm: (rolls: number[]) => void
  onClose: () => void
}) {
  const [rolls, setRolls] = useState<number[]>([])
  const add = (face: number) =>
    setRolls((r) => (r.length < needed ? [...r, face] : r))
  const removeAt = (i: number) => setRolls((r) => r.filter((_, idx) => idx !== i))
  const ready = rolls.length === needed

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="manual-dice" onClick={(e) => e.stopPropagation()}>
        <div className="manual-dice-head">
          <strong>物理骰录入 · {label}</strong>
          <button className="intercept-close" onClick={onClose}>✕</button>
        </div>
        <div className="dice-faces">
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <button key={f} className="dice-face" onClick={() => add(f)} disabled={rolls.length >= needed}>
              {f}
            </button>
          ))}
        </div>
        <div className="dice-record">
          已录：
          {rolls.length === 0 ? <span className="muted">（点面值累加，需 {needed} 枚）</span> : (
            rolls.map((r, i) => (
              <button key={i} className="dice-chip" onClick={() => removeAt(i)} title="点击移除">{r}</button>
            ))
          )}
          <span className={ready ? 'ok' : 'warn'}> 总数 {rolls.length}/{needed} {ready ? '✓' : ''}</span>
        </div>
        <button className="primary" disabled={!ready} onClick={() => onConfirm(rolls)}>
          确认 ▶
        </button>
      </div>
    </div>
  )
}
