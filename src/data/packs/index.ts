// 统一阵营注册表：App/RosterView/matchStore/AbilityLab/RulesQuery 等所有消费者从这里读取，
// 新增阵营只改本文件，避免分散 import 导致漏注册。
import { loadPack, type FactionPack } from '../../rules'
import angelsPack from './angels_of_death.v1.json'
import legionariesPack from './legionaries.v1.json'
import plaguePack from './plague_marines.v1.json'
import chaosCultPack from './chaos_cult.v1.json'
import warpcovenPack from './warpcoven.v1.json'

export interface FactionRegistryEntry {
  id: string
  name: string
  pack: FactionPack
}

export const FACTION_REGISTRY: FactionRegistryEntry[] = [
  { id: 'angels_of_death', name: '死亡天使', pack: loadPack(angelsPack) },
  { id: 'legionaries', name: '军团兵', pack: loadPack(legionariesPack) },
  { id: 'plague_marines', name: '瘟疫战士', pack: loadPack(plaguePack) },
  { id: 'chaos_cult', name: '混沌教派', pack: loadPack(chaosCultPack) },
  { id: 'warpcoven', name: '次元密会', pack: loadPack(warpcovenPack) },
]

export const ALL_PACKS: FactionPack[] = FACTION_REGISTRY.map((f) => f.pack)

export function packOfFaction(factionId: string): FactionPack | undefined {
  return FACTION_REGISTRY.find((f) => f.id === factionId)?.pack
}

export function packOfOperative(opId: string): FactionPack | undefined {
  return ALL_PACKS.find((p) => p.operatives.some((o) => o.operativeId === opId))
}
