import { Fragment } from 'react'
import type { FactionPack } from '../../rules'
import { fmtWeapon } from '../weaponDisplay'

/** 默认装备配置：每个 loadout 槽取首个 option 的武器。 */
function defaultLoadoutFor(pack: FactionPack, opId: string): string[] {
  const op = pack.operatives.find((o) => o.operativeId === opId)
  if (!op) return []
  const out: string[] = []
  for (const slot of op.loadouts) {
    const first = slot.options[0]
    if (first) for (const wid of first) out.push(wid)
  }
  return out
}

/** per-operative 选择器（军团兵混沌印记）的默认选项；非 perOperative 阵营返回 undefined。 */
function defaultMarkFor(pack: FactionPack): string | undefined {
  const sel = pack.faction.subFactionSelector
  return sel?.scope === 'perOperative' ? sel.default : undefined
}

export function OperativePicker({
  pack,
  operativeIds,
  loadout,
  perOperativeMarks,
  wargearAssignment,
  onChange,
}: {
  pack: FactionPack
  operativeIds: string[]
  loadout: Record<string, string[]>
  perOperativeMarks: Record<string, string>
  wargearAssignment: Record<string, string[]>
  onChange: (next: { operativeIds: string[]; loadout: Record<string, string[]>; perOperativeMarks?: Record<string, string>; wargearAssignment?: Record<string, string[]> }) => void
}) {
  const except = new Set(pack.buildConstraints?.maxPerTypeExcept ?? [])
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const maxTotal = pack.buildConstraints?.operatives?.max ?? 99
  const isPerOperativeMarks = pack.faction.subFactionSelector?.id === 'markOfChaos'
  const markOptions = pack.faction.subFactionSelector?.options ?? []
  const wargearList = pack.wargear ?? []
  const maxPerType = (opId: string) => (except.has(opId) ? maxTotal : 1)
  const atCapacity = operativeIds.length >= maxTotal

  // 排序：队长 → 唯一 → 可复选
  const ordered = [
    ...pack.operatives.filter((o) => leaders.has(o.operativeId)),
    ...pack.operatives.filter((o) => !leaders.has(o.operativeId) && !except.has(o.operativeId)),
    ...pack.operatives.filter((o) => !leaders.has(o.operativeId) && except.has(o.operativeId)),
  ]

  function countOf(opId: string): number {
    return operativeIds.filter((x) => x === opId).length
  }

  function getInstances(opId: string): { key: string; instance: number }[] {
    const result: { key: string; instance: number }[] = []
    let inst = 0
    for (const id of operativeIds) {
      if (id === opId) { result.push({ key: `${opId}#${inst}`, instance: inst }); inst++ }
    }
    return result
  }

  function addOp(opId: string) {
    const cnt = countOf(opId)
    const key = `${opId}#${cnt}`
    const mark = defaultMarkFor(pack)
    onChange({
      operativeIds: [...operativeIds, opId],
      loadout: { ...loadout, [key]: defaultLoadoutFor(pack, opId) },
      ...(mark ? { perOperativeMarks: { ...perOperativeMarks, [key]: mark } } : {}),
    })
  }

  // 删除指定 instance，并把后续同 opId 的 instance 编号往前补（保持 loadout/wargear/印记 键连续）
  function removeInstance(opId: string, instance: number) {
    const rebuildIds: string[] = []
    const rebuildLoadout: Record<string, string[]> = {}
    const rebuildWg: Record<string, string[]> = {}
    const rebuildMarks: Record<string, string> = {}
    let removed = false
    for (let i = 0; i < operativeIds.length; i++) {
      const id = operativeIds[i]!
      const oldInst = operativeIds.slice(0, i).filter((x) => x === id).length
      if (id === opId && oldInst === instance && !removed) { removed = true; continue }
      const oldKey = `${id}#${oldInst}`
      const newKey = `${id}#${rebuildIds.filter((x) => x === id).length}`
      rebuildIds.push(id)
      rebuildLoadout[newKey] = loadout[oldKey] ?? []
      if (wargearAssignment[oldKey]) rebuildWg[newKey] = wargearAssignment[oldKey]
      if (perOperativeMarks[oldKey]) rebuildMarks[newKey] = perOperativeMarks[oldKey]
    }
    onChange({ operativeIds: rebuildIds, loadout: rebuildLoadout, wargearAssignment: rebuildWg, perOperativeMarks: rebuildMarks })
  }

  function selectLeader(opId: string) {
    const kept = operativeIds.filter((id) => !leaders.has(id))
    const next = [...kept, opId]
    const newKey = `${opId}#${next.filter((x) => x === opId).length - 1}`
    const mark = defaultMarkFor(pack)
    onChange({
      operativeIds: next,
      loadout: { ...loadout, [newKey]: loadout[newKey] ?? defaultLoadoutFor(pack, opId) },
      ...(mark && !perOperativeMarks[newKey] ? { perOperativeMarks: { ...perOperativeMarks, [newKey]: mark } } : {}),
    })
  }

  // 阵营装备：下拉选「无」即清空（修复 radio 无法取消的问题）
  function setWargear(key: string, wgId: string) {
    onChange({ operativeIds, loadout, wargearAssignment: { ...wargearAssignment, [key]: wgId ? [wgId] : [] } })
  }

  /** 选某 loadout 槽的第 optionIndex 个选项：移除该槽旧武器，加入新选项武器。存储仍是扁平 weaponId[]。 */
  function setSlot(opId: string, key: string, slotIndex: number, optionIndex: number) {
    const op = pack.operatives.find((o) => o.operativeId === opId)
    const slot = op?.loadouts[slotIndex]
    if (!slot) return
    const slotWeaponIds = new Set(slot.options.flat())
    const kept = (loadout[key] ?? []).filter((wid) => !slotWeaponIds.has(wid))
    const opt = slot.options[optionIndex]
    if (opt) for (const wid of opt) kept.push(wid)
    onChange({ operativeIds, loadout: { ...loadout, [key]: kept } })
  }

  function takenWargearIds(excludeKey: string): Set<string> {
    const s = new Set<string>()
    for (const [k, list] of Object.entries(wargearAssignment)) {
      if (k !== excludeKey) for (const w of list) s.add(w)
    }
    return s
  }

  return (
    <div className="operative-picker">
      <h3>特工配置（{operativeIds.length}/{maxTotal} 名）{atCapacity && <span className="op-full"> 已满</span>}</h3>
      <table className="roster-table">
        <thead>
          <tr>
            <th className="rt-name">特工</th>
            <th className="rt-stat">豁免</th>
            <th className="rt-stat">耐伤</th>
            <th className="rt-stat">移动</th>
            <th className="rt-wg">阵营装备</th>
            <th className="rt-wp">装备配置</th>
            <th className="rt-act">操作</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((op) => {
            const isLeader = leaders.has(op.operativeId)
            const isRepeatable = except.has(op.operativeId)
            const count = countOf(op.operativeId)
            const instances = getInstances(op.operativeId)
            const canAdd = !atCapacity && count < maxPerType(op.operativeId)

            return (
              <Fragment key={op.operativeId}>
                {/* 类型头行：名称 + 属性 + 加号 */}
                <tr className={`rt-type-row ${count > 0 ? 'has' : ''}`}>
                  <td className="rt-name">
                    {isLeader ? (
                      <label className="rt-leader-pick">
                        <input type="radio" name="leader" checked={count > 0} onChange={() => selectLeader(op.operativeId)} />
                        {op.name}
                      </label>
                    ) : (
                      <span>{op.name}</span>
                    )}
                    {isLeader && <span className="rt-tag">队长</span>}
                    {isRepeatable && <span className="rt-tag">可复选</span>}
                  </td>
                  <td className="rt-stat">{op.stats.save}+</td>
                  <td className="rt-stat">{op.stats.wounds}</td>
                  <td className="rt-stat">{op.stats.move}"</td>
                  <td className="rt-wg"></td>
                  <td className="rt-wp"></td>
                  <td className="rt-act">
                    {!isLeader && (
                      <button className="op-btn" onClick={() => addOp(op.operativeId)} disabled={!canAdd} title="添加">＋</button>
                    )}
                    {isRepeatable && count > 0 && <span className="rt-cnt">×{count}</span>}
                  </td>
                </tr>
                {/* 每个已入队实例：独立阵营装备 + 装备配置 */}
                {instances.map(({ key, instance }) => {
                  const myLoadout = loadout[key] ?? []
                  const myWg = (wargearAssignment[key] ?? [])[0] ?? ''
                  const taken = takenWargearIds(key)

                  return (
                    <tr key={key} className="rt-instance-row">
                      <td className="rt-name rt-sub">
                        <span className="rt-inst-name">{op.name}{isRepeatable && instance > 0 ? ` #${instance + 1}` : ''}</span>
                        {isPerOperativeMarks && (
                          <select
                            className="rt-mark-select"
                            value={perOperativeMarks[key] ?? ''}
                            onChange={(e) => onChange({ operativeIds, loadout, perOperativeMarks: { ...perOperativeMarks, [key]: e.target.value } })}
                          >
                            <option value="">印记…</option>
                            {markOptions.map((optId) => {
                              const eff = pack.effects.find((x) => x.effectId === optId)
                              return <option key={optId} value={optId}>{eff?.label.split('（')[0] ?? optId}</option>
                            })}
                          </select>
                        )}
                      </td>
                      <td className="rt-stat muted">{op.stats.save}+</td>
                      <td className="rt-stat muted">{op.stats.wounds}</td>
                      <td className="rt-stat muted">{op.stats.move}"</td>
                      <td className="rt-wg">
                        <select value={myWg} onChange={(e) => setWargear(key, e.target.value)}>
                          <option value="">无</option>
                          {wargearList.map((wg) => (
                            <option key={wg.id} value={wg.id} disabled={taken.has(wg.id)}>
                              {wg.name}{taken.has(wg.id) ? '（已占用）' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="rt-wp">
                        {op.loadouts.map((slot, sIdx) => {
                          if (slot.options.length === 0) return null
                          const optLabel = (opt: string[]) =>
                            opt.map((wid) => pack.weapons.find((w) => w.weaponId === wid))
                              .filter(Boolean)
                              .map((w) => `${w!.name} (${fmtWeapon(w!)})`)
                              .join(' + ')
                          if (slot.options.length === 1) {
                            return <div key={sIdx} className="rt-slot-fixed"><span className="rt-slot-desc">{slot.description}：</span>{optLabel(slot.options[0]!)}</div>
                          }
                          const selectedOpt = slot.options.findIndex((opt) => opt.every((wid) => myLoadout.includes(wid)))
                          return (
                            <select key={sIdx} value={selectedOpt >= 0 ? String(selectedOpt) : ''} onChange={(e) => setSlot(op.operativeId, key, sIdx, parseInt(e.target.value, 10))}>
                              <option value="">{slot.description}…</option>
                              {slot.options.map((opt, oIdx) => <option key={oIdx} value={String(oIdx)}>{optLabel(opt)}</option>)}
                            </select>
                          )
                        })}
                      </td>
                      <td className="rt-act">
                        {isLeader ? (
                          <span className="rt-fixed">队长</span>
                        ) : (
                          <button className="op-btn rt-remove" onClick={() => removeInstance(op.operativeId, instance)} title="移除">✕</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** 建队默认：首名队长 + 各类型一名（可复选类型补足到 min）。供 RosterView 选阵营时调用。 */
export function computeDefaultRoster(pack: FactionPack): { operativeIds: string[]; loadout: Record<string, string[]>; perOperativeMarks: Record<string, string> } {
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const except = new Set(pack.buildConstraints?.maxPerTypeExcept ?? [])
  const maxTotal = pack.buildConstraints?.operatives?.max ?? 99
  const minTotal = pack.buildConstraints?.operatives?.min ?? 0
  const markDefault = defaultMarkFor(pack)
  const ids: string[] = []
  const loadout: Record<string, string[]> = {}
  const marks: Record<string, string> = {}
  const add = (opId: string) => {
    if (ids.length >= maxTotal) return
    const key = `${opId}#${ids.filter((x) => x === opId).length}`
    loadout[key] = defaultLoadoutFor(pack, opId)
    if (markDefault) marks[key] = markDefault
    ids.push(opId)
  }
  const cap = (opId: string) => (except.has(opId) ? maxTotal : 1)
  const count = (opId: string) => ids.filter((x) => x === opId).length

  const firstLeader = pack.operatives.find((o) => leaders.has(o.operativeId))
  if (firstLeader) add(firstLeader.operativeId)
  
  // 一轮：优先选用非队长且非“除外”（即非普通战士）的特工
  for (const op of pack.operatives) {
    if (leaders.has(op.operativeId)) continue
    if (except.has(op.operativeId)) continue
    if (count(op.operativeId) < cap(op.operativeId)) add(op.operativeId)
  }
  
  // 填补空位：用可复选类型（普通战士）补足到 maxTotal
  const reps = pack.operatives.filter((o) => except.has(o.operativeId) && !leaders.has(o.operativeId))
  let guard = 0
  while (ids.length < maxTotal && reps.length > 0 && guard < maxTotal * reps.length) {
    for (const op of reps) {
      if (ids.length >= maxTotal) break
      if (count(op.operativeId) < cap(op.operativeId)) add(op.operativeId)
    }
    guard++
  }
  return { operativeIds: ids, loadout, perOperativeMarks: marks }
}
