import type { Ability, FactionPack } from './types'

/** The source pack lists card abilities per operative; the roster UI only exposes abilities actually on that card. */
export function personalAbilities(pack: FactionPack, opId: string): Ability[] {
  const refs = pack.operatives.find(op => op.operativeId === opId)?.abilityRefs ?? []
  return refs.flatMap(id => {
    const ability = pack.abilities?.find(item => item.abilityId === id)
    return ability ? [ability] : []
  })
}

export function isChapterVeteran(pack: FactionPack, opId: string): boolean {
  return pack.faction.id === 'angels_of_death' && personalAbilities(pack, opId).some(a => a.abilityId === 'chapter_veteran')
}

export function psychicRangedWeapons(pack: FactionPack, weaponIds: string[]) {
  return weaponIds.flatMap(id => {
    const weapon = pack.weapons.find(w => w.weaponId === id)
    return weapon?.kind === 'RANGED' && weapon.profile.weaponRules.some(rule => /^Psychic$/i.test(rule)) ? [weapon] : []
  })
}

export function rosterOptionLabel(pack: FactionPack, id: string): string {
  const effect = pack.effects.find(e => e.effectId === id)
  if (effect) return effect.label.split('（')[0] ?? effect.label
  return pack.factionRules?.flatMap(rule => rule.options ?? []).find(option => option.id === id)?.name ?? id
}

export function defaultPerOperativeMarks(pack: FactionPack, operativeIds: string[]): Record<string, string> {
  const selector = pack.faction.subFactionSelector
  if (selector?.scope !== 'perOperative') return {}
  const used = new Set<string>()
  const counts = new Map<string, number>()
  const marks: Record<string, string> = {}
  for (const id of operativeIds) {
    const index = counts.get(id) ?? 0
    counts.set(id, index + 1)
    const op = pack.operatives.find(item => item.operativeId === id)
    if (!op || (selector.eligibleKeywords?.length && !op.keywords.some(k => selector.eligibleKeywords!.includes(k)))) continue
    const mark = selector.uniqueAcrossTeam ? selector.options.find(option => !used.has(option)) : (selector.default ?? selector.options[0])
    if (mark) { marks[`${id}#${index}`] = mark; used.add(mark) }
  }
  return marks
}
