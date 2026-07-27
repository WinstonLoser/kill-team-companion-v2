import { useState } from 'react'
import type { FactionPack } from '../../rules'
import { fmtWeapon } from '../weaponDisplay'
import {
  listInstances,
  removeInstance,
  setSlot,
  setWargear,
  takenWargearIds,
  type RosterPatch,
  type RosterState,
} from './rosterOps'

/**
 * 已入队特工列表：每个实例一行。
 *
 * 收起态只给「名字 + 徽章 + 一行属性」，装备配置藏在展开区里 —— 武器选项文本
 * 长达 ~80 字（fmtWeapon 已是压缩形式），半屏栏宽塞不下，展开后满栏换行才读得了。
 */
export function RosterList({
  pack,
  state,
  leaderIds,
  repeatableIds,
  onChange,
}: {
  pack: FactionPack
  state: RosterState
  leaderIds: Set<string>
  repeatableIds: Set<string>
  onChange: (patch: RosterPatch) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const instances = listInstances(state.operativeIds)
  const wargearList = pack.wargear ?? []
  const markSelector = pack.faction.subFactionSelector
  const isPerOperativeMarks = markSelector?.id === 'markOfChaos'
  const markOptions = markSelector?.options ?? []

  if (instances.length === 0) {
    return <p className="ds-empty rl-empty">阵容为空 —— 用上面的「添加特工」组队</p>
  }

  return (
    <ul className="rl-list">
      {instances.map(({ opId, instance, key }) => {
        const op = pack.operatives.find((o) => o.operativeId === opId)
        if (!op) return null
        const isLeader = leaderIds.has(opId)
        const isRepeatable = repeatableIds.has(opId)
        const isOpen = expanded === key
        const myLoadout = state.loadout[key] ?? []
        const myWg = (state.wargearAssignment[key] ?? [])[0] ?? ''
        const taken = takenWargearIds(state, key)
        const markId = state.perOperativeMarks[key]
        const markLabel = markId
          ? (pack.effects.find((x) => x.effectId === markId)?.label.split('（')[0] ?? markId)
          : null

        return (
          <li key={key} className={`rl-row ${isOpen ? 'is-open' : ''}`}>
            <button
              className="rl-summary"
              onClick={() => setExpanded(isOpen ? null : key)}
              aria-expanded={isOpen}
              title={isOpen ? '收起装备配置' : '展开装备配置'}
            >
              <span className="rl-head">
                <span className="rl-name">
                  {op.name}{isRepeatable && instance > 0 ? ` #${instance + 1}` : ''}
                </span>
                {isLeader && <span className="ds-badge ds-badge--accent">队长</span>}
                {markLabel && <span className="ds-badge">{markLabel}</span>}
              </span>
              {/* 属性走等宽字：readme「Numbers as data」 */}
              <span className="ds-stat rl-stats">
                M{op.stats.move}" · APL{op.stats.apl} · SV{op.stats.save}+ · W{op.stats.wounds}
              </span>
              <span className="rl-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div className="rl-detail">
                {isPerOperativeMarks && (
                  <label className="ds-field">
                    <span className="ds-label">混沌印记</span>
                    <select
                      className="ds-select"
                      value={markId ?? ''}
                      onChange={(e) => onChange({
                        operativeIds: state.operativeIds,
                        loadout: state.loadout,
                        perOperativeMarks: { ...state.perOperativeMarks, [key]: e.target.value },
                      })}
                    >
                      <option value="">印记…</option>
                      {markOptions.map((optId) => {
                        const eff = pack.effects.find((x) => x.effectId === optId)
                        return <option key={optId} value={optId}>{eff?.label.split('（')[0] ?? optId}</option>
                      })}
                    </select>
                  </label>
                )}

                {wargearList.length > 0 && (
                  <label className="ds-field">
                    <span className="ds-label">阵营装备</span>
                    <select
                      className="ds-select"
                      value={myWg}
                      onChange={(e) => onChange(setWargear(state, key, e.target.value))}
                    >
                      <option value="">无</option>
                      {wargearList.map((wg) => (
                        <option key={wg.id} value={wg.id} disabled={taken.has(wg.id)}>
                          {wg.name}{taken.has(wg.id) ? '（已占用）' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {op.loadouts.map((slot, sIdx) => {
                  if (slot.options.length === 0) return null
                  const optLabel = (opt: string[]) =>
                    opt.map((wid) => pack.weapons.find((w) => w.weaponId === wid))
                      .filter(Boolean)
                      .map((w) => `${w!.name}（${fmtWeapon(w!)}）`)
                      .join(' + ')

                  // 单选项槽位没得选，直接列出来即可
                  if (slot.options.length === 1) {
                    return (
                      <div key={sIdx} className="rl-fixed-slot">
                        <span className="ds-label">{slot.description}</span>
                        <span className="rl-fixed-value">{optLabel(slot.options[0]!)}</span>
                      </div>
                    )
                  }

                  const selectedOpt = slot.options.findIndex((opt) => opt.every((wid) => myLoadout.includes(wid)))
                  return (
                    <label key={sIdx} className="ds-field">
                      <span className="ds-label">{slot.description}</span>
                      <select
                        className="ds-select"
                        value={selectedOpt >= 0 ? String(selectedOpt) : ''}
                        onChange={(e) => {
                          const patch = setSlot(pack, state, opId, key, sIdx, parseInt(e.target.value, 10))
                          if (patch) onChange(patch)
                        }}
                      >
                        <option value="">{slot.description}…</option>
                        {slot.options.map((opt, oIdx) => (
                          <option key={oIdx} value={String(oIdx)}>{optLabel(opt)}</option>
                        ))}
                      </select>
                    </label>
                  )
                })}

                <div className="rl-actions">
                  {isLeader ? (
                    <span className="muted">队长不可移除 —— 在「添加特工」里换人</span>
                  ) : (
                    <button
                      className="ds-btn ds-btn--sm ds-btn--danger"
                      onClick={() => {
                        setExpanded(null)
                        onChange(removeInstance(state, opId, instance))
                      }}
                      title={`把 ${op.name} 移出阵容`}
                    >
                      移除
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
