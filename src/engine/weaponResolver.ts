// 武器解析（W3b：消费 ATTACH_WEAPON_RULE）。纯函数。

import type { Effect, Weapon } from '../rules/types'

/**
 * 解析武器 + 附加规则（W3b：消费 ATTACH_WEAPON_RULE kind）。
 * 把 effect 栈中所有 ATTACH_WEAPON_RULE 的 rule 合并进 profile.weaponRules（去重，附加在后），返回新武器。
 * 无附加则原样返回（引用不变）。
 *
 * 消费边界：本函数让引擎结算用的「有效武器」携带附加规则；这些规则→骰子效果的语义
 * （如 RAPID_FIRE/PIERCING1/TORRENT）属 weaponRule 语义层，留 Epic 3。
 */
export function withAttachedRules(weapon: Weapon, effects: Effect[]): Weapon {
  const attached = effects
    .filter((e) => e.modifier.kind === 'ATTACH_WEAPON_RULE')
    .map((e) => (e.modifier.payload as { rule: string }).rule)
  if (!attached.length) return weapon
  const merged = [...weapon.profile.weaponRules]
  for (const r of attached) if (!merged.includes(r)) merged.push(r)
  return { ...weapon, profile: { ...weapon.profile, weaponRules: merged } }
}

/** 本结算新附加的规则（有效规则 − 武器原规则），供 step 留痕。 */
export function attachedRules(weapon: Weapon, effects: Effect[]): string[] {
  const base = weapon.profile.weaponRules
  return withAttachedRules(weapon, effects).profile.weaponRules.filter((r) => !base.includes(r))
}
