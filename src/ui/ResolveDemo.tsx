import { useState } from 'react'
import { loadPack, runShooting } from '../'
import { ManualDiceSource } from '../dice'
import angelsPack from '../data/packs/angels_of_death.v1.json'
import type { ShootResult } from '../engine'

const pack = loadPack(angelsPack)

export function ResolveDemo() {
  const firstRanged = pack.weapons.find((w) => w.kind === 'RANGED') ?? pack.weapons[0]!
  const [attackerId, setAttackerId] = useState(pack.operatives[0]!.operativeId)
  const [defenderId, setDefenderId] = useState(pack.operatives[0]!.operativeId)
  const [weaponId, setWeaponId] = useState(firstRanged.weaponId)
  const [diceStr, setDiceStr] = useState('4,5,2,6, 2,3,1')
  const [hasCover, setHasCover] = useState(false)
  const [result, setResult] = useState<ShootResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const weapon = pack.weapons.find((w) => w.weaponId === weaponId) ?? firstRanged
  const defender = pack.operatives.find((o) => o.operativeId === defenderId)!

  function resolve() {
    setError(null)
    const seq = diceStr
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((n) => parseInt(n, 10))
    if (seq.some((n) => Number.isNaN(n) || n < 1 || n > 6)) {
      setError('骰值须为 1..6，逗号/空格分隔')
      setResult(null)
      return
    }
    try {
      const dice = new ManualDiceSource()
      dice.provide(seq)
      const r = runShooting({
        attacker: { operativeId: attackerId, weapon },
        defender: { operativeId: defenderId, save: defender.stats.save, wounds: defender.stats.wounds },
        effects: [],
        dice,
        hasCover,
      })
      setResult(r)
    } catch (e) {
      setError((e as Error).message)
      setResult(null)
    }
  }

  return (
    <div className="demo">
      <h2>射击结算演练（接引擎）</h2>
      <div className="row">
        <label>攻击方
          <select value={attackerId} onChange={(e) => setAttackerId(e.target.value)}>
            {pack.operatives.map((o) => <option key={o.operativeId} value={o.operativeId}>{o.name}</option>)}
          </select>
        </label>
        <label>武器
          <select value={weaponId} onChange={(e) => setWeaponId(e.target.value)}>
            {pack.weapons.filter((w) => w.kind === 'RANGED').map((w) => <option key={w.weaponId} value={w.weaponId}>{w.name}</option>)}
          </select>
        </label>
        <label>目标
          <select value={defenderId} onChange={(e) => setDefenderId(e.target.value)}>
            {pack.operatives.map((o) => <option key={o.operativeId} value={o.operativeId}>{o.name}</option>)}
          </select>
        </label>
        <label className="cover">
          <input type="checkbox" checked={hasCover} onChange={(e) => setHasCover(e.target.checked)} /> 目标有掩护
        </label>
      </div>
      <div className="row">
        <label className="dice">物理骰录入（攻击{weapon.profile.attacks} + 防御3）
          <input value={diceStr} onChange={(e) => setDiceStr(e.target.value)} placeholder="如 4,5,2,6,2,3,1" />
        </label>
        <button className="primary" onClick={resolve}>结算 ▶</button>
      </div>
      {error && <p className="error">⚠ {error}</p>}
      {result && (
        <div className="result">
          <p className="outcome">
            造伤 <strong>{result.woundsDealt}</strong>{result.defenderIncapacitated ? ' → 目标残废' : ''}
            （剩余 普通{result.remaining.normalSuccess}/关键{result.remaining.criticalSuccess}）
          </p>
          <ol className="trace">
            {result.traces.map((t, i) => (
              <li key={i}><span className="sid">{t.stepId}</span> <span className="sum">{t.summary}</span></li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
