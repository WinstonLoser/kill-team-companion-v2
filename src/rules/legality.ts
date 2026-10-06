// 建队合法性判定（纯逻辑，数据驱动，零 UI 依赖）。
// 读 FactionPack 的 buildConstraints + faction.subFactionSelector，逐条算结构性校验。
// KT Lite 无点数（D-30），校验仅三类：特工来源 / 子阵营选择 / 装备限制。

import type { FactionPack } from './types'
import { isChapterVeteran, personalAbilities, psychicRangedWeapons } from './rosterOptions'

export type RosterLegalityStatus = 'ok' | 'warn'

export interface RosterLegalityCheck {
  key: string
  label: string
  status: RosterLegalityStatus
  detail: string
}

export interface RosterLegalityInput {
  pack: FactionPack
  operativeIds: string[]
  /** opId → 选中的 weaponId 列表（装备配置） */
  loadout: Record<string, string[]>
  /** 子阵营选择器已选项 id 列表（战团战术/印记） */
  subFactionSelection: string[]
  teamRulesEnabled?: boolean
  /**
   * perOperative 选择器的逐特工选择（键为 `${opId}#${instance}`，值为选项 id）。
   * 校验 requiredPerEligible / uniqueAcrossTeam / eligibleKeywords 时必须提供。
   */
  perOperativeMarks?: Record<string, string>
  personalRulesEnabled?: boolean
  personalAbilityIds?: Record<string, string[]>
  personalTactics?: Record<string, string>
  boonWeaponTargets?: Record<string, string>
  selectedWargearIds?: string[]
  /**
   * 合成武器 keyword 覆盖（测试/扩展用）：weaponId → keywords。
   * 未列出则回退到 pack.weapons 里的 keywords。UI 正常路径留空。
   */
  syntheticWeaponKeywords?: Record<string, string[]>
}

export interface RosterLegalityResult {
  checks: RosterLegalityCheck[]
  legal: boolean
}

function weaponKeywords(pack: FactionPack, synthetic: Record<string, string[]> | undefined) {
  const map = new Map<string, string[]>()
  for (const w of pack.weapons) map.set(w.weaponId, w.keywords)
  if (synthetic) for (const [id, kws] of Object.entries(synthetic)) map.set(id, kws)
  return map
}

/** 计算建队合法性。纯函数：相同输入恒定输出，便于单测与回放。 */
export function evaluateLegality(input: RosterLegalityInput): RosterLegalityResult {
  const { pack, operativeIds, loadout, subFactionSelection, syntheticWeaponKeywords } = input
  const personalRulesEnabled = input.personalRulesEnabled ?? false
  const constraints = pack.buildConstraints
  const checks: RosterLegalityCheck[] = []

  // ===== 特工来源：operativeId 全部须存在于阵营列表；数量在 [min,max] =====
  const knownIds = new Set(pack.operatives.map((o) => o.operativeId))
  const unknown = operativeIds.filter((id) => !knownIds.has(id))
  const min = constraints?.operatives?.min
  const max = constraints?.operatives?.max
  let srcDetail = `${operativeIds.length} 名`
  let srcStatus: RosterLegalityStatus = 'ok'
  if (unknown.length > 0) {
    srcStatus = 'warn'
    srcDetail += `；未知特工：${unknown.join(', ')}`
  }
  if (min !== undefined && operativeIds.length < min) {
    srcStatus = 'warn'
    srcDetail += `；至少 ${min} 名`
  }
  if (max !== undefined && operativeIds.length > max) {
    srcStatus = 'warn'
    srcDetail += `；上限 ${max} 名`
  }
  checks.push({ key: 'operatives-source', label: '特工来源', status: srcStatus, detail: srcDetail })

  // Each selected operative needs exactly one legal bundle from every card slot.
  const instances = operativeIds.map((id, index) => ({ id, key: `${id}#${operativeIds.slice(0, index).filter(x => x === id).length}` }))
  const invalidLoadouts: string[] = []
  for (const { id, key } of instances) {
    const op = pack.operatives.find(o => o.operativeId === id)
    if (!op) continue
    const selected = [...(loadout[key] ?? [])].sort().join('|')
    let combinations: string[][] = [[]]
    for (const slot of op.loadouts) {
      const options = slot.options.length ? slot.options : [[]]
      combinations = combinations.flatMap(before => options.map(option => [...before, ...option]))
    }
    if (!combinations.some(option => [...option].sort().join('|') === selected)) invalidLoadouts.push(key)
  }
  checks.push({ key: 'loadout', label: '卡面武器组合', status: invalidLoadouts.length ? 'warn' : 'ok', detail: invalidLoadouts.length ? `需重新配置：${invalidLoadouts.join('、')}` : '所有已选特工的武器组合有效' })

  // ===== AC3 队长规则：≥1 名来自 leaderFrom =====
  const leaderFrom = constraints?.leaderFrom
  if (leaderFrom && leaderFrom.length > 0) {
    const leadSet = new Set(leaderFrom)
    const leaderCount = operativeIds.filter((id) => leadSet.has(id)).length
    const hasLeader = leaderCount === 1
    checks.push({
      key: 'leader',
      label: '队长',
      status: hasLeader ? 'ok' : 'warn',
      detail: hasLeader ? '已选择 1 名队长' : `必须恰好 1 名队长，当前 ${leaderCount} 名`,
    })
  }

  // ===== AC3 每类限 1（除例外）：operativeId 计数 =====
  const except = constraints?.maxPerTypeExcept
  if (except) {
    const exceptSet = new Set(except)
    const counts = new Map<string, number>()
    for (const id of operativeIds) if (!exceptSet.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
    const overs = [...counts.entries()].filter(([, n]) => n > 1)
    checks.push({
      key: 'per-type',
      label: '每类限 1',
      status: overs.length === 0 ? 'ok' : 'warn',
      detail: overs.length === 0 ? `每类 ≤1（除 ${except.join('/')})` : `超限：${overs.map(([id, n]) => `${id}×${n}`).join(', ')}`,
    })
  }

  // ===== 按 operativeId 的数量区间（固定组成，如混沌教派 14 人结构） =====
  const typeLimits = constraints?.operativeTypeLimits
  if (typeLimits && Object.keys(typeLimits).length > 0) {
    const counts2 = new Map<string, number>()
    for (const id of operativeIds) counts2.set(id, (counts2.get(id) ?? 0) + 1)
    const bad: string[] = []
    for (const [id, lim] of Object.entries(typeLimits)) {
      const n = counts2.get(id) ?? 0
      if (lim.min !== undefined && n < lim.min) bad.push(`${id}: ${n}<${lim.min}`)
      else if (lim.max !== undefined && n > lim.max) bad.push(`${id}: ${n}>${lim.max}`)
    }
    checks.push({
      key: 'type-limits',
      label: '固定组成',
      status: bad.length === 0 ? 'ok' : 'warn',
      detail: bad.length === 0 ? '符合各类型数量要求' : `不符：${bad.join('; ')}`,
    })
  }

  // ===== 初始建队不可选（变异者/受难者仅由对局中变异产生） =====
  const ineligible = constraints?.initialRosterIneligible
  if (ineligible && ineligible.length > 0) {
    const badSet = new Set(ineligible)
    const picked = operativeIds.filter((id) => badSet.has(id))
    checks.push({
      key: 'initial-ineligible',
      label: '初始可选',
      status: picked.length === 0 ? 'ok' : 'warn',
      detail: picked.length === 0 ? `初始不可选（${ineligible.join('/')}）未入队` : `初始建队含不可选特工：${picked.join(', ')}`,
    })
  }

  // ===== 点数制建队（次元密会：恰好 5 点；奸角兽 0.5） =====
  const points = constraints?.selectionPoints
  if (points) {
    const costs = constraints?.operativeCosts ?? {}
    const total = operativeIds.reduce((sum, id) => sum + (costs[id] ?? 1), 0)
    let pStatus: RosterLegalityStatus = 'ok'
    const bad: string[] = []
    if (points.exact !== undefined && total !== points.exact) bad.push(`须恰好 ${points.exact}`)
    if (points.min !== undefined && total < points.min) bad.push(`至少 ${points.min}`)
    if (points.max !== undefined && total > points.max) bad.push(`至多 ${points.max}`)
    if (bad.length > 0) pStatus = 'warn'
    checks.push({
      key: 'selection-points',
      label: '选择点数',
      status: pStatus,
      detail: bad.length === 0 ? `${total}/${points.exact ?? points.max ?? points.min} 点` : `${total} 点（${bad.join('、')}）`,
    })
  }

  // ===== 关键词最低数量（如至少 1 名 SORCERER） =====
  const minByKw = constraints?.minimumByKeyword
  if (minByKw && Object.keys(minByKw).length > 0) {
    const opById = new Map(pack.operatives.map((o) => [o.operativeId, o]))
    const kwBad: string[] = []
    for (const [kw, need] of Object.entries(minByKw)) {
      const n = operativeIds.filter((id) => opById.get(id)?.keywords.includes(kw)).length
      if (n < need) kwBad.push(`${kw}: ${n}/${need}`)
    }
    checks.push({
      key: 'keyword-min',
      label: '关键词下限',
      status: kwBad.length === 0 ? 'ok' : 'warn',
      detail: kwBad.length === 0 ? '满足关键词数量要求' : `不足：${kwBad.join('; ')}`,
    })
  }

  // ===== 子阵营选择 =====
  const selector = pack.faction.subFactionSelector
  if (selector) {
    if (selector.scope === 'perOperative') {
      // 每特工各选（军团兵混沌印记 / 次元密会奸奇恩惠）：按 selector 元数据通用校验，
      // 不再依赖 selector.id === 'markOfChaos' 之类的阵营特判。
      const eligibleKws = selector.eligibleKeywords
      const opById = new Map(pack.operatives.map((o) => [o.operativeId, o]))
      const marks = input.perOperativeMarks ?? {}
      const validOptions = new Set(selector.options)
      const problems: string[] = []
      const taken = new Map<string, number>()
      operativeIds.forEach((id, position) => {
        const op = opById.get(id)
        if (!op) return
        const eligible = !eligibleKws || eligibleKws.length === 0 || op.keywords.some((k) => eligibleKws.includes(k))
        const instance = operativeIds.slice(0, position).filter((x) => x === id).length
        const key = `${id}#${instance}`
        const mark = marks[key]
        if (pack.faction.id === 'legionaries' && id === 'balefire_acolyte' && mark === 'mark_khorne') problems.push('邪火使徒不能选择恐虐印记')
        if (eligible) {
          if (mark && !validOptions.has(mark)) problems.push(`${op.name}选项无效`)
        } else if (mark) {
          problems.push(`${op.name}不符合选择资格`)
        }
        if (mark && validOptions.has(mark)) taken.set(mark, (taken.get(mark) ?? 0) + 1)
      })
      if (selector.uniqueAcrossTeam) {
        for (const [opt, n] of taken) if (n > 1) problems.push(`${opt} 被选 ${n} 次`)
      }
      const eligibleCount = operativeIds.filter((id) => {
        const op = opById.get(id)
        return op && (!eligibleKws || eligibleKws.length === 0 || op.keywords.some((k) => eligibleKws.includes(k)))
      }).length
      checks.push({
        key: 'sub-faction',
        label: selector.label.split('（')[0] ?? selector.label,
        status: problems.length === 0 ? 'ok' : 'warn',
        detail: problems.length === 0
          ? `${eligibleCount} 名合格特工已配置（${selector.label}）`
          : problems.slice(0, 4).join('；'),
      })
    } else {
      // 整队个性化规则启用后，选满 max 项；关闭时无需选择。
      const validOptions = new Set(selector.options)
      const invalid = subFactionSelection.filter((s) => !validOptions.has(s))
      let sfStatus: RosterLegalityStatus = 'ok'
      let sfDetail = input.teamRulesEnabled ? `${subFactionSelection.length}/${selector.max}（${selector.label}）` : '未启用全队个性化规则'
      if (input.teamRulesEnabled && (subFactionSelection.length !== selector.max || new Set(subFactionSelection).size !== selector.max)) {
        sfStatus = 'warn'
        sfDetail = `需选 ${selector.max}，已选 ${subFactionSelection.length}`
      } else if (input.teamRulesEnabled && invalid.length > 0) {
        sfStatus = 'warn'
        sfDetail = `无效选项：${invalid.join(', ')}`
      }
      checks.push({ key: 'sub-faction', label: '子阵营选择', status: sfStatus, detail: sfDetail })
    }
  }

  const personalProblems: string[] = []
  const validInstances = new Set(instances.map(item => item.key))
  for (const [key, ids] of Object.entries(input.personalAbilityIds ?? {})) {
    const opId = instances.find(item => item.key === key)?.id
    const valid = new Set(opId ? personalAbilities(pack, opId).map(ability => ability.abilityId) : [])
    if (!validInstances.has(key) || new Set(ids).size !== ids.length || ids.some(id => !valid.has(id))) personalProblems.push(`${key} 的能力选择无效`)
  }
  const tacticOptions = new Set(pack.faction.subFactionSelector?.id === 'chapterTactic' ? pack.faction.subFactionSelector.options : [])
  for (const { id, key } of instances) {
    const abilities = personalRulesEnabled ? (input.personalAbilityIds?.[key] ?? []) : []
    const veteran = isChapterVeteran(pack, id) && abilities.includes('chapter_veteran')
    const tactic = input.personalTactics?.[key]
    if (veteran && !tactic) personalProblems.push(`${key} 需选战团老兵战术`)
    if (tactic && (!veteran || !tacticOptions.has(tactic))) personalProblems.push(`${key} 的战团老兵战术无效`)
    const mark = input.perOperativeMarks?.[key]
    const target = input.boonWeaponTargets?.[key]
    if (mark === 'boon_starburst') {
      const possible = psychicRangedWeapons(pack, loadout[key] ?? []).map(w => w.weaponId)
      if (!target || !possible.includes(target)) personalProblems.push(`${key} 的星爆术需指定已装备的灵能远程武器`)
    } else if (target) personalProblems.push(`${key} 不需要星爆术武器目标`)
  }
  for (const key of Object.keys(input.personalTactics ?? {})) if (!validInstances.has(key)) personalProblems.push(`${key} 已不在阵容中`)
  for (const key of Object.keys(input.boonWeaponTargets ?? {})) if (!validInstances.has(key)) personalProblems.push(`${key} 已不在阵容中`)
  checks.push({ key: 'personal-options', label: '个性化选择', status: personalProblems.length ? 'warn' : 'ok', detail: personalProblems.length ? personalProblems.slice(0, 3).join('；') : personalRulesEnabled ? '已启用的能力选择有效' : '未启用个性化规则' })

  const selectedWargear = input.selectedWargearIds ?? []
  const availableWargear = new Set((pack.wargear ?? []).map(item => item.id))
  const wargearValid = new Set(selectedWargear).size === selectedWargear.length && selectedWargear.every(id => availableWargear.has(id))
  checks.push({ key: 'faction-wargear', label: '阵营装备', status: wargearValid ? 'ok' : 'warn', detail: wargearValid ? `已选 ${selectedWargear.length} 项，效果由玩家裁定` : '所选阵营装备无效或重复' })

  // ===== 装备限制：按 scope（weaponId|keyword）聚合计数，超限 → 违规 =====
  const limits = constraints?.equipmentLimits
  if (limits && Object.keys(limits).length > 0) {
    const scope = constraints?.equipmentLimitScope ?? 'weaponId'
    const kwMap = weaponKeywords(pack, syntheticWeaponKeywords)
    // 把全队所有选中武器按 limit key 维度计数
    const allSelected: string[] = []
    for (const opId of Object.keys(loadout)) {
      const arr = loadout[opId]
      if (Array.isArray(arr)) allSelected.push(...arr)
    }
    let eqStatus: RosterLegalityStatus = 'ok'
    const overs: string[] = []
    for (const [key, cap] of Object.entries(limits)) {
      let count = 0
      for (const wId of allSelected) {
        if (scope === 'weaponId') {
          if (wId === key) count++
        } else {
          const kws = kwMap.get(wId) ?? []
          if (kws.includes(key)) count++
        }
      }
      if (count > cap) {
        eqStatus = 'warn'
        overs.push(`${key}: ${count}/${cap}`)
      }
    }
    const eqDetail = overs.length ? `超限 ${overs.join('; ')}` : '符合装备限制'
    checks.push({ key: 'equipment', label: '装备限制', status: eqStatus, detail: eqDetail })
  }

  const legal = checks.every((c) => c.status === 'ok')
  return { checks, legal }
}
