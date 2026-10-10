export interface FactionVisual {
  label: string
  iconUrl?: string
  accent: string
  glow: string
}

/** Faction emblems extracted from page 1 of the local team-rule PDFs. */
export const FACTION_VISUALS: Record<string, FactionVisual> = {
  angels_of_death: { label: '死亡天使', iconUrl: '/assets/icons/factions/angels_of_death.png', accent: '#d8bb78', glow: '216,187,120' },
  legionaries: { label: '军团兵', iconUrl: '/assets/icons/factions/legionaries.png', accent: '#da695f', glow: '218,105,95' },
  plague_marines: { label: '瘟疫战士', iconUrl: '/assets/icons/factions/plague_marines.png', accent: '#a7c86e', glow: '167,200,110' },
  chaos_cult: { label: '混沌教派', iconUrl: '/assets/icons/factions/chaos_cult.png', accent: '#df8079', glow: '223,128,121' },
  warpcoven: { label: '次元密会', iconUrl: '/assets/icons/factions/warpcoven.png', accent: '#8ec5db', glow: '142,197,219' },
}

export const DEFAULT_VISUAL: FactionVisual = { label: '杀戮小队', accent: '#d8bb78', glow: '216,187,120' }
export function factionVisual(id?: string): FactionVisual { return (id && FACTION_VISUALS[id]) || DEFAULT_VISUAL }
