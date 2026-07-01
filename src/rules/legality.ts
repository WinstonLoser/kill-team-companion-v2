// 建队合法性判定（纯逻辑，数据驱动，零 UI 依赖）。
// 读 FactionPack 的 buildConstraints + faction.subFactionSelector，逐条算结构性校验。
// KT Lite 无点数（D-30），校验仅三类：特工来源 / 子阵营选择 / 装备限制。

import type { FactionPack } from './types'

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

  // ===== 子阵营选择：选满 max 且选项合法（无选择器则跳过） =====
  const selector = pack.faction.subFactionSelector
  if (selector) {
    const validOptions = new Set(selector.options)
    const invalid = subFactionSelection.filter((s) => !validOptions.has(s))
    let sfStatus: RosterLegalityStatus = 'ok'
    let sfDetail = `${subFactionSelection.length}/${selector.max}（${selector.label}）`
    if (subFactionSelection.length !== selector.max) {
      sfStatus = 'warn'
      sfDetail = `需选 ${selector.max}，已选 ${subFactionSelection.length}`
    } else if (invalid.length > 0) {
      sfStatus = 'warn'
      sfDetail = `无效选项：${invalid.join(', ')}`
    }
    checks.push({ key: 'sub-faction', label: '子阵营选择', status: sfStatus, detail: sfDetail })
  }

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
