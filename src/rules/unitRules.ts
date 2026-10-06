import type { Operative, Weapon } from './types'

export function isAstartes(op: Operative): boolean {
  return op.keywords.some(k => /ASTARTES/.test(k))
}

/** Instance-local rules: never modify a faction pack or another model's profile. */
export function applyUnitRules(op: Operative, weapons: Weapon[], selections: string[], wounds: number, maxWounds: number) {
  const has = (id: string) => selections.includes(id)
  const injured = wounds < maxWounds / 2
  if (injured) op.stats.move = Math.max(0, op.stats.move - 2)
  if (has('mark_slaanesh') || has('boon_time_walker') || has('gift_fleet')) op.stats.move++
  if (has('gift_carapace')) op.stats.save = Math.max(2, op.stats.save - 1)
  for (const w of weapons) {
    const add = (rule: string) => { if (!w.profile.weaponRules.includes(rule)) w.profile.weaponRules.push(rule) }
    if (injured && !(has('gift_sinew') && w.kind === 'MELEE')) w.profile.hit = Math.min(6, w.profile.hit + 1)
    if (w.kind === 'MELEE') {
      if (has('chapterTactic_relentless')) add('Rending')
      if (has('mark_khorne')) add('Severe')
      if (has('gift_sinew')) add('Brutal')
      if (has('boon_warp_empowered')) w.profile.normalDamage++
    } else {
      if (has('chapterTactic_siege') || has('boon_sight_beyond')) add('Saturate')
      if (has('mark_tzeentch')) add('Severe')
      if (has('boon_twist_fate') && w.profile.weaponRules.some(r => /psychic/i.test(r))) add('Piercing Crits 1')
    }
  }
}

export function ruleLabel(name: string) { return name.split(' / ').pop() ?? name }
