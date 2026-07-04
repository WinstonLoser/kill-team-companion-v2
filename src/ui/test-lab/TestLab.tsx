import { useState, useEffect } from 'react'
import type { FactionPack, Operative } from '../../rules'
import { OperativeCard } from '../components/OperativeCard/OperativeCard'
import './TestLab.css'

/**
 * UI 实验室（移植自 feature/operative-data-card，适配 main）。
 * 顶栏选阵营；左栏选特工 + 选 loadout 槽 + 选阵营规则；右栏 iPad 画布渲染数据卡。
 */
export function TestLab({ packs }: { packs: { id: string; name: string; pack: FactionPack }[] }) {
  const [packId, setPackId] = useState<string>(packs[0]?.id ?? '')
  const pack = packs.find((p) => p.id === packId)?.pack ?? packs[0]?.pack
  const [selectedOpId, setSelectedOpId] = useState<string>(pack?.operatives[0]?.operativeId ?? '')
  const [slotSelections, setSlotSelections] = useState<number[]>([])
  const [factionSel, setFactionSel] = useState<string[]>([])

  const selectedOp: Operative | undefined = pack?.operatives.find((o) => o.operativeId === selectedOpId)
  const selector = pack?.faction.subFactionSelector

  // 切阵营：重置特工选择
  useEffect(() => { if (pack) setSelectedOpId(pack.operatives[0]?.operativeId ?? '') }, [packId])
  // 切特工时重置 loadout 槽选到首个 option + 阵营规则选择
  useEffect(() => {
    if (selectedOp) setSlotSelections(selectedOp.loadouts.map(() => 0))
    setFactionSel([])
  }, [selectedOpId, packId])

  if (!pack) return null

  // 由槽选算出选中武器 id 并集
  let selectedWeaponIds: string[] = []
  if (selectedOp) {
    selectedOp.loadouts.forEach((slot, i) => {
      const opt = slot.options[slotSelections[i] ?? 0]
      if (opt) selectedWeaponIds = [...selectedWeaponIds, ...opt]
    })
  }

  function setSlot(i: number, optionIndex: number) {
    setSlotSelections((prev) => {
      const next = [...prev]
      next[i] = optionIndex
      return next
    })
  }

  return (
    <div className="test-lab-container">
      <div className="sidebar">
        <div className="tl-section">
          <h2 className="sidebar-title">阵营</h2>
          <select className="loadout-select" value={packId} onChange={(e) => setPackId(e.target.value)}>
            {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <h2 className="sidebar-title">特工</h2>
        <ul className="op-list">
          {pack.operatives.map((o) => (
            <li
              key={o.operativeId}
              className={`op-list-item ${selectedOpId === o.operativeId ? 'active' : ''}`}
              onClick={() => setSelectedOpId(o.operativeId)}
            >
              {o.name}
            </li>
          ))}
        </ul>

        {selectedOp && selectedOp.loadouts.length > 0 && (
          <div className="tl-section">
            <h2 className="sidebar-title">装备配置</h2>
            {selectedOp.loadouts.map((slot, sIdx) => {
              const weaponName = (id: string) => pack.weapons.find((w) => w.weaponId === id)?.name ?? id
              if (slot.options.length <= 1) {
                const fixed = slot.options[0] ?? []
                return (
                  <div key={sIdx} className="loadout-group">
                    <div className="loadout-desc">{slot.description}</div>
                    <div className="loadout-fixed">{fixed.map((id) => <div key={id}>• {weaponName(id)}</div>)}</div>
                  </div>
                )
              }
              return (
                <div key={sIdx} className="loadout-group">
                  <div className="loadout-desc">{slot.description}</div>
                  <select
                    className="loadout-select"
                    value={slotSelections[sIdx] ?? 0}
                    onChange={(e) => setSlot(sIdx, parseInt(e.target.value, 10))}
                  >
                    {slot.options.map((opt, oIdx) => (
                      <option key={oIdx} value={oIdx}>{opt.map(weaponName).join(' + ')}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}

        {selector && (selector.id === 'chapterTactic' || selector.id === 'markOfChaos') && (
          <div className="tl-section">
            <h2 className="sidebar-title">{selector.id === 'chapterTactic' ? '战团战术' : '混沌印记'}</h2>
            {selector.options.map((optId) => {
              const eff = pack.effects.find((e) => e.effectId === optId)
              const checked = factionSel.includes(optId)
              const max = selector.max
              return (
                <label key={optId} className="tl-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && factionSel.length >= max}
                    onChange={() => setFactionSel((prev) => checked ? prev.filter((x) => x !== optId) : [...prev, optId])}
                  />
                  {eff?.label.split('（')[0] ?? optId}
                </label>
              )
            })}
          </div>
        )}
      </div>

      <div className="canvas-area">
        <div className="ipad-canvas">
          {selectedOp
            ? <OperativeCard operative={selectedOp} pack={pack} selectedWeaponIds={selectedWeaponIds} selectedFactionRuleIds={factionSel} />
            : <div className="no-selection">选择一名特工</div>}
        </div>
      </div>
    </div>
  )
}
