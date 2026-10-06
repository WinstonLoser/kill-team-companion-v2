export interface FactionVisual {
  label: string
  motif: string
  accent: string
  glow: string
}

/** Original interface motifs inspired by each team's rules and palette. */
export const FACTION_VISUALS: Record<string, FactionVisual> = {
  angels_of_death: { label: '死亡天使', motif: '✠', accent: '#d8bb78', glow: '216,187,120' },
  legionaries: { label: '军团兵', motif: '⛧', accent: '#da695f', glow: '218,105,95' },
  plague_marines: { label: '瘟疫战士', motif: '☣', accent: '#a7c86e', glow: '167,200,110' },
  chaos_cult: { label: '混沌教派', motif: '◇', accent: '#df8079', glow: '223,128,121' },
  warpcoven: { label: '次元密会', motif: '✧', accent: '#8ec5db', glow: '142,197,219' },
}

export const DEFAULT_VISUAL: FactionVisual = { label: '杀戮小队', motif: '◆', accent: '#d8bb78', glow: '216,187,120' }
export function factionVisual(id?: string): FactionVisual { return (id && FACTION_VISUALS[id]) || DEFAULT_VISUAL }
