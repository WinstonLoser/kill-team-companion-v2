import { create } from 'zustand'

// 建队结果（T1：UI 层 roster store 切片）。UI 只读写 store，不直接调引擎/数据包。
// AC4 双方建队：rosterA / rosterB 各持一队（阵营可同可异）。

export type Side = 'a' | 'b'

/** 单支建队结果（阵营 + 特工 + 装备配置 + 子阵营选择）。 */
export interface RosterEntry {
  factionId: string | null
  /** 此方是否按面对面约定启用全队个性化规则（如死亡天使战团战术）。 */
  teamRulesEnabled: boolean
  /** 此方是否按面对面约定启用逐人个性化规则。 */
  personalRulesEnabled: boolean
  operativeIds: string[]
  /** opKey → 选中的 weaponId 列表（装备配置） */
  loadout: Record<string, string[]>
  /** 阵营级子阵营选择（死亡天使战团战术 8 选 2） */
  subFactionSelection: string[]
  /** 每名特工的子阵营选择（军团兵混沌印记 per-operative：opKey → mark effectId） */
  perOperativeMarks: Record<string, string>
  /** opId#instance → 本方选择启用的特工专属能力 ID。 */
  personalAbilityIds: Record<string, string[]>
  /** 死亡天使军士的战团老兵额外战术。 */
  personalTactics: Record<string, string>
  /** 次元密会星爆术指定的、该巫师实际装备的灵能远程武器。 */
  boonWeaponTargets: Record<string, string>
  /** 本局启用的阵营装备；效果由玩家按规则裁定。 */
  selectedWargearIds: string[]
}

export function emptyRoster(): RosterEntry {
  return { factionId: null, teamRulesEnabled: false, personalRulesEnabled: false, operativeIds: [], loadout: {}, subFactionSelection: [], perOperativeMarks: {}, personalAbilityIds: {}, personalTactics: {}, boonWeaponTargets: {}, selectedWargearIds: [] }
}

interface RosterState {
  rosterA: RosterEntry
  rosterB: RosterEntry
  /** 当前在建哪一方（A/B 交替建队） */
  editing: Side
  /** 全量替换某方建队结果 */
  setRoster: (side: Side, entry: RosterEntry) => void
  /** 局部更新某方（浅合并） */
  patchRoster: (side: Side, patch: Partial<RosterEntry>) => void
  setEditing: (side: Side) => void
  reset: () => void
}

export const useRosterStore = create<RosterState>((set) => ({
  rosterA: emptyRoster(),
  rosterB: emptyRoster(),
  editing: 'a',
  setRoster: (side, entry) => set(side === 'a' ? { rosterA: entry } : { rosterB: entry }),
  patchRoster: (side, patch) =>
    set((s) => {
      const cur = side === 'a' ? s.rosterA : s.rosterB
      const next = { ...cur, ...patch }
      return side === 'a' ? { rosterA: next } : { rosterB: next }
    }),
  setEditing: (editing) => set({ editing }),
  reset: () => set({ rosterA: emptyRoster(), rosterB: emptyRoster(), editing: 'a' }),
}))
