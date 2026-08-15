import { Fragment } from 'react'
import type { FactionPack } from '../../rules'
import { fmtWeapon } from '../weaponDisplay'

/** 默认装备配置：每个 loadout 槽取首个 option 的武器。 */

// 阵营装备选择暂不启用（所有阵营）：wargear 数据保留在包内供规则查询/展示，
// 建队阶段不提供分配入口。启用时改为 true 即可恢复下拉。
const WARGEAR_SELECTION_ENABLED = false

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
  const typeLimits = pack.buildConstraints?.operativeTypeLimits ?? {}
  const ineligible = new Set(pack.buildConstraints?.initialRosterIneligible ?? [])
  const maxTotal = pack.buildConstraints?.operatives?.max ?? 99
  const selector = pack.faction.subFactionSelector
  const isPerOperativeSelector = selector?.scope === 'perOperative'
  const markOptions = selector?.options ?? []
  const wargearList = pack.wargear ?? []
  // 类型数量上限：精确约束优先（固定组成），其次可复选例外，缺省每类 1
  const maxPerType = (opId: string) => {
    const lim = typeLimits[opId]
    if (lim?.max !== undefined) return lim.max
    return except.has(opId) ? maxTotal : 1
  }
  const atCapacity = operativeIds.length >= maxTotal
  // perOperative 选择器资格（通用化：按关键词而非 selector.id 特判）
  const markEligible = (keywords: string[]) =>
    !selector?.eligibleKeywords || selector.eligibleKeywords.length === 0 ||
    keywords.some((k) => selector.eligibleKeywords!.includes(k))
  const takenMarks = new Set(
    Object.entries(perOperativeMarks).filter(([, v]) => v).map(([, v]) => v as string),
  )
  // 选择器选项展示名：effect 优先，其次阵营规则选项（如诅咒之礼）
  const markLabel = (optId: string): string => {
    const eff = pack.effects.find((x) => x.effectId === optId)
    if (eff) return eff.label.split('（')[0] ?? eff.label
    for (const fr of pack.factionRules ?? []) {
      const opt = (fr.options ?? []).find((o) => o.id === optId)
      if (opt) return opt.name
    }
    return optId
  }

  // 排序：队长 → 唯一 → 可复选；初始不可选（变异者/受难者）不进入建队列表
  const selectable = pack.operatives.filter((o) => !ineligible.has(o.operativeId))
  const ordered = [
    ...selectable.filter((o) => leaders.has(o.operativeId)),
    ...selectable.filter((o) => !leaders.has(o.operativeId) && maxPerType(o.operativeId) <= 1),
    ...selectable.filter((o) => !leaders.has(o.operativeId) && maxPerType(o.operativeId) > 1),
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
    const opDef = pack.operatives.find((o) => o.operativeId === opId)
    const mark = nextDefaultMark(pack, takenMarks, opDef?.keywords)
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
    const opDef = pack.operatives.find((o) => o.operativeId === opId)
    const mark = nextDefaultMark(pack, takenMarks, opDef?.keywords)
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

  // 点数制建队（次元密会）：显示已用点数
  const sp = pack.buildConstraints?.selectionPoints
  const costs = pack.buildConstraints?.operativeCosts ?? {}
  const totalPoints = operativeIds.reduce((sum, id) => sum + (costs[id] ?? 1), 0)
  const pointsCap = sp?.exact ?? sp?.max ?? sp?.min

  return (
    <div className="operative-picker">
      <h3>
        特工配置（{operativeIds.length}/{maxTotal} 名）
        {sp && pointsCap !== undefined && <span className={totalPoints === pointsCap ? 'op-full ok' : 'op-full'}> · 点数 {totalPoints}/{pointsCap}</span>}
        {atCapacity && <span className="op-full"> 已满</span>}
      </h3>
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
            const isRepeatable = maxPerType(op.operativeId) > 1
            const lim = typeLimits[op.operativeId]
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
                    {isRepeatable && <span className="rt-tag">{lim ? `×${lim.max ?? maxTotal}` : '可复选'}</span>}
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
                        {isPerOperativeSelector && markEligible(op.keywords) && (
                          <select
                            className="rt-mark-select"
                            value={perOperativeMarks[key] ?? ''}
                            onChange={(e) => onChange({ operativeIds, loadout, perOperativeMarks: { ...perOperativeMarks, [key]: e.target.value } })}
                          >
                            <option value="">{selector!.label.split('（')[0]}…</option>
                            {markOptions.map((optId) => {
                              const takenByOther = selector!.uniqueAcrossTeam
                                && takenMarks.has(optId)
                                && perOperativeMarks[key] !== optId
                              return <option key={optId} value={optId} disabled={takenByOther}>{markLabel(optId)}{takenByOther ? '（已选）' : ''}</option>
                            })}
                          </select>
                        )}
                      </td>
                      <td className="rt-stat muted">{op.stats.save}+</td>
                      <td className="rt-stat muted">{op.stats.wounds}</td>
                      <td className="rt-stat muted">{op.stats.move}"</td>
                      <td className="rt-wg">
                        {WARGEAR_SELECTION_ENABLED ? (
                          <select value={myWg} onChange={(e) => setWargear(key, e.target.value)}>
                            <option value="">无</option>
                            {wargearList.map((wg) => (
                              <option key={wg.id} value={wg.id} disabled={taken.has(wg.id)}>
                                {wg.name}{taken.has(wg.id) ? '（已占用）' : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="muted" title="阵营装备功能未启用，规则可在阵营概览中查看">—</span>
                        )}
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
                            <select key={sIdx} value={selectedOpt >= 0 ? String(selectedOpt) : ''} onChange={(e) => { if (e.target.value !== '') setSlot(op.operativeId, key, sIdx, parseInt(e.target.value, 10)) }}>
                              <option value="" disabled>{slot.description}…</option>
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

/** 建队默认：按通用约束生成合法默认阵容。固定组成（operativeTypeLimits）精确补满；
 *  点数制（selectionPoints）下按点数截断并优先满足 minimumByKeyword；
 *  其余沿用“首名队长 + 各类型一名 + 可复选补足”策略；跳过 initialRosterIneligible。 */
export function computeDefaultRoster(pack: FactionPack): { operativeIds: string[]; loadout: Record<string, string[]>; perOperativeMarks: Record<string, string> } {
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const except = new Set(pack.buildConstraints?.maxPerTypeExcept ?? [])
  const typeLimits = pack.buildConstraints?.operativeTypeLimits ?? {}
  const ineligible = new Set(pack.buildConstraints?.initialRosterIneligible ?? [])
  const costs = pack.buildConstraints?.operativeCosts ?? {}
  const sp = pack.buildConstraints?.selectionPoints
  const kwMin = pack.buildConstraints?.minimumByKeyword ?? {}
  const maxTotal = pack.buildConstraints?.operatives?.max ?? 99
  const minTotal = pack.buildConstraints?.operatives?.min ?? 0
  const pointsTarget = sp?.exact ?? sp?.max
  const ids: string[] = []
  const loadout: Record<string, string[]> = {}
  const marks: Record<string, string> = {}
  const usedMarks = new Set<string>()
  const add = (opId: string) => {
    if (ids.length >= maxTotal) return
    const key = `${opId}#${ids.filter((x) => x === opId).length}`
    loadout[key] = defaultLoadoutFor(pack, opId)
    const opDef = pack.operatives.find((o) => o.operativeId === opId)
    const mark = nextDefaultMark(pack, usedMarks, opDef?.keywords)
    if (mark) { marks[key] = mark; usedMarks.add(mark) }
    ids.push(opId)
  }
  const cost = (opId: string) => costs[opId] ?? 1
  const totalCost = () => ids.reduce((sum, id) => sum + cost(id), 0)
  /** 点数制下还能否再容纳该特工 */
  const pointsAllow = (opId: string) => pointsTarget === undefined || totalCost() + cost(opId) <= pointsTarget
  const cap = (opId: string) => {
    const lim = typeLimits[opId]
    if (lim?.max !== undefined) return lim.max
    return except.has(opId) ? maxTotal : 1
  }
  const need = (opId: string) => typeLimits[opId]?.min ?? 0
  const count = (opId: string) => ids.filter((x) => x === opId).length
  const opById = new Map(pack.operatives.map((o) => [o.operativeId, o]))
  const selectable = pack.operatives.filter((o) => !ineligible.has(o.operativeId))

  const firstLeader = selectable.find((o) => leaders.has(o.operativeId))
  if (firstLeader) add(firstLeader.operativeId)

  // 固定组成：精确补满各类型 min（如混沌教派 2 祝福战刃 + 9 虔信者）
  for (const op of selectable) {
    while (count(op.operativeId) < need(op.operativeId) && count(op.operativeId) < cap(op.operativeId) && ids.length < maxTotal) {
      add(op.operativeId)
    }
  }

  // 关键词下限（如次元密会至少 1 名巫师）：点数允许时优先补足
  for (const [kw, needKw] of Object.entries(kwMin)) {
    let have = ids.filter((id) => opById.get(id)?.keywords.includes(kw)).length
    for (const op of selectable) {
      if (have >= needKw) break
      if (!op.keywords.includes(kw)) continue
      while (have < needKw && count(op.operativeId) < cap(op.operativeId) && pointsAllow(op.operativeId)) {
        add(op.operativeId)
        have++
      }
    }
  }

  // 一轮：无精确约束的唯一类型（原 AC3 行为；点数制下按点数截断）
  for (const op of selectable) {
    if (leaders.has(op.operativeId) || typeLimits[op.operativeId]) continue
    if (except.has(op.operativeId)) continue
    if (count(op.operativeId) < cap(op.operativeId) && pointsAllow(op.operativeId)) add(op.operativeId)
  }

  // 填补空位：可复选类型补足（固定组成类型优先，其次 except 列表）
  const reps = selectable.filter((o) => cap(o.operativeId) > 1 && !leaders.has(o.operativeId))
  const target = sp ? Math.ceil(pointsTarget ?? 0) : (maxTotal <= 20 ? maxTotal : minTotal)
  const reachedTarget = () => (sp ? totalCost() >= (pointsTarget ?? 0) : ids.length >= target)
  let guard = 0
  while (!reachedTarget() && reps.length > 0 && guard < target * reps.length + 20) {
    for (const op of reps) {
      if (reachedTarget()) break
      if (count(op.operativeId) < cap(op.operativeId) && pointsAllow(op.operativeId)) add(op.operativeId)
    }
    guard++
  }
  return { operativeIds: ids, loadout, perOperativeMarks: marks }
}

/** perOperative 选择器的默认选项：仅合格特工分配；uniqueAcrossTeam 时取首个未占用选项，否则取 default。 */
function nextDefaultMark(pack: FactionPack, used: Set<string>, opKeywords?: string[]): string | undefined {
  const sel = pack.faction.subFactionSelector
  if (!sel || sel.scope !== 'perOperative') return undefined
  if (opKeywords && sel.eligibleKeywords && sel.eligibleKeywords.length > 0) {
    const eligible = opKeywords.some((k) => sel.eligibleKeywords!.includes(k))
    if (!eligible) return undefined
  }
  if (sel.uniqueAcrossTeam) {
    return sel.options.find((o) => !used.has(o))
  }
  return sel.default
}
