import { create } from 'zustand'

// 建队结果（T1：UI 层 roster store 切片）。UI 只读写 store，不直接调引擎/数据包。
// AC4 双方建队：rosterA / rosterB 各持一队（阵营可同可异）。

export type Side = 'a' | 'b'

/** 单支建队结果（阵营 + 特工 + 装备配置 + 子阵营选择）。 */
export interface RosterEntry {
  factionId: string | null // 选定阵营 id（null=未选阵营）
  operativeIds: string[] // 入队特工 operativeId 列表
  /** opId → 选中的 weaponId 列表（装备配置） */
  loadout: Record<string, string[]>
  /** 子阵营选择器已选项 id（死亡天使战团战术 / 军团兵印记） */
  subFactionSelection: string[]
}

export function emptyRoster(): RosterEntry {
  return { factionId: null, operativeIds: [], loadout: {}, subFactionSelection: [] }
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
