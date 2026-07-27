import type { FactionPack } from '../../rules'

/**
 * 建队的纯逻辑：实例键管理 + 默认阵容。
 *
 * 从原 OperativePicker 原样搬出来（拆分 UI 时逻辑不动）。这里的核心约束是
 * **实例键 `opId#n` 必须连续**：loadout / wargearAssignment / perOperativeMarks
 * 三张表都以它为键，删中间一个实例时后面的编号要往前补，否则装备会错位到
 * 别的特工身上。改动这里务必连带跑一遍建队流程。
 */

/** 该 opId 在队列中的实例数。 */
export function countOf(operativeIds: string[], opId: string): number {
  return operativeIds.filter((x) => x === opId).length
}

/** 默认装备配置：每个 loadout 槽取首个 option 的武器。 */
export function defaultLoadoutFor(pack: FactionPack, opId: string): string[] {
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
export function defaultMarkFor(pack: FactionPack): string | undefined {
  const sel = pack.faction.subFactionSelector
  return sel?.scope === 'perOperative' ? sel.default : undefined
}

export interface RosterPatch {
  operativeIds: string[]
  loadout: Record<string, string[]>
  perOperativeMarks?: Record<string, string>
  wargearAssignment?: Record<string, string[]>
}

export interface RosterState {
  operativeIds: string[]
  loadout: Record<string, string[]>
  perOperativeMarks: Record<string, string>
  wargearAssignment: Record<string, string[]>
}

/** 队列中每个实例的展开形式（含稳定的 `opId#n` 键）。顺序 = 入队顺序。 */
export function listInstances(operativeIds: string[]): { opId: string; instance: number; key: string }[] {
  const seen: Record<string, number> = {}
  return operativeIds.map((opId) => {
    const instance = seen[opId] ?? 0
    seen[opId] = instance + 1
    return { opId, instance, key: `${opId}#${instance}` }
  })
}

/** 加一名特工（末尾追加实例，带默认装备与默认印记）。 */
export function addOperative(pack: FactionPack, state: RosterState, opId: string): RosterPatch {
  const key = `${opId}#${countOf(state.operativeIds, opId)}`
  const mark = defaultMarkFor(pack)
  return {
    operativeIds: [...state.operativeIds, opId],
    loadout: { ...state.loadout, [key]: defaultLoadoutFor(pack, opId) },
    ...(mark ? { perOperativeMarks: { ...state.perOperativeMarks, [key]: mark } } : {}),
  }
}

/**
 * 删除指定实例，并把后续同 opId 的实例编号往前补
 * （保持 loadout / wargear / 印记 三张表的键连续）。
 */
export function removeInstance(state: RosterState, opId: string, instance: number): RosterPatch {
  const rebuildIds: string[] = []
  const rebuildLoadout: Record<string, string[]> = {}
  const rebuildWg: Record<string, string[]> = {}
  const rebuildMarks: Record<string, string> = {}
  let removed = false
  for (let i = 0; i < state.operativeIds.length; i++) {
    const id = state.operativeIds[i]!
    const oldInst = state.operativeIds.slice(0, i).filter((x) => x === id).length
    if (id === opId && oldInst === instance && !removed) { removed = true; continue }
    const oldKey = `${id}#${oldInst}`
    const newKey = `${id}#${rebuildIds.filter((x) => x === id).length}`
    rebuildIds.push(id)
    rebuildLoadout[newKey] = state.loadout[oldKey] ?? []
    if (state.wargearAssignment[oldKey]) rebuildWg[newKey] = state.wargearAssignment[oldKey]!
    if (state.perOperativeMarks[oldKey]) rebuildMarks[newKey] = state.perOperativeMarks[oldKey]!
  }
  return { operativeIds: rebuildIds, loadout: rebuildLoadout, wargearAssignment: rebuildWg, perOperativeMarks: rebuildMarks }
}

/** 换队长：移除所有现任队长，追加选中的那位。 */
export function selectLeader(pack: FactionPack, state: RosterState, opId: string): RosterPatch {
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const kept = state.operativeIds.filter((id) => !leaders.has(id))
  const next = [...kept, opId]
  const newKey = `${opId}#${next.filter((x) => x === opId).length - 1}`
  const mark = defaultMarkFor(pack)
  return {
    operativeIds: next,
    loadout: { ...state.loadout, [newKey]: state.loadout[newKey] ?? defaultLoadoutFor(pack, opId) },
    ...(mark && !state.perOperativeMarks[newKey] ? { perOperativeMarks: { ...state.perOperativeMarks, [newKey]: mark } } : {}),
  }
}

/**
 * 选某 loadout 槽的第 optionIndex 个选项：移除该槽旧武器，加入新选项武器。
 * 存储仍是扁平 weaponId[]。
 */
export function setSlot(
  pack: FactionPack,
  state: RosterState,
  opId: string,
  key: string,
  slotIndex: number,
  optionIndex: number,
): RosterPatch | null {
  const op = pack.operatives.find((o) => o.operativeId === opId)
  const slot = op?.loadouts[slotIndex]
  if (!slot) return null
  const slotWeaponIds = new Set(slot.options.flat())
  const kept = (state.loadout[key] ?? []).filter((wid) => !slotWeaponIds.has(wid))
  const opt = slot.options[optionIndex]
  if (opt) for (const wid of opt) kept.push(wid)
  return { operativeIds: state.operativeIds, loadout: { ...state.loadout, [key]: kept } }
}

/** 阵营装备：传空串即清空该实例的装备。 */
export function setWargear(state: RosterState, key: string, wgId: string): RosterPatch {
  return {
    operativeIds: state.operativeIds,
    loadout: state.loadout,
    wargearAssignment: { ...state.wargearAssignment, [key]: wgId ? [wgId] : [] },
  }
}

/** 已被别的实例占用的阵营装备（同一件装备全队只能有一个人带）。 */
export function takenWargearIds(state: RosterState, excludeKey: string): Set<string> {
  const s = new Set<string>()
  for (const [k, list] of Object.entries(state.wargearAssignment)) {
    if (k !== excludeKey) for (const w of list) s.add(w)
  }
  return s
}

/** 特工类型的展示排序：队长 → 唯一 → 可复选。 */
export function orderedTypes(pack: FactionPack) {
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const except = new Set(pack.buildConstraints?.maxPerTypeExcept ?? [])
  return [
    ...pack.operatives.filter((o) => leaders.has(o.operativeId)),
    ...pack.operatives.filter((o) => !leaders.has(o.operativeId) && !except.has(o.operativeId)),
    ...pack.operatives.filter((o) => !leaders.has(o.operativeId) && except.has(o.operativeId)),
  ]
}

/** 建队默认：首名队长 + 各类型一名（可复选类型补足到上限）。选阵营时调用。 */
export function computeDefaultRoster(pack: FactionPack): { operativeIds: string[]; loadout: Record<string, string[]>; perOperativeMarks: Record<string, string> } {
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const except = new Set(pack.buildConstraints?.maxPerTypeExcept ?? [])
  const maxTotal = pack.buildConstraints?.operatives?.max ?? 99
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

  // 一轮：优先选用非队长且非「除外」（即非普通战士）的特工
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
