import type { DiceRoll } from '../dice'
/** Canonical weapon keyword matching for the current data packs. */
export function ruleValue(rules: string[], name: string, fallback = 0): number {
  const r = rules.find(r => r.toLowerCase().startsWith(name.toLowerCase() + ' '))
  return r ? Number(r.match(/\d+/)?.[0] ?? fallback) : fallback
}
export function successPool(rolls: DiceRoll[], hit: number, rules: string[], finalized = false) {
  let normal = 0, critical = 0
  const lethal = ruleValue(rules, 'Lethal', 6)
  for (const die of rolls) {
    if (finalized) { if(die.grade === 'CRITICAL') critical++;else if(die.grade === 'NORMAL') normal++; continue }
    if(die.nat === 1) continue
    if(die.nat >= lethal) critical++
    else if(die.nat >= hit) normal++
  }
  const has = (name: string) => rules.some(r => r.toLowerCase() === name.toLowerCase())
  if(has('Severe') && critical === 0 && normal > 0) { normal--; critical++ }
  if(has('Rending') && critical > 0 && normal > 0) { normal--; critical++ }
  return {normal,critical}
}
