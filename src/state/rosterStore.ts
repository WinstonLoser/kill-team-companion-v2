import { create } from 'zustand'

// 建队结果（H4 接线：RosterView 写入，MatchView 读取建队→对局数据流）
interface RosterState {
  aOps: string[] // A 方特工 operativeId 列表
  aTactics: string[] // A 方战团战术 effectId 列表（8 选 2）
  setRoster: (ops: string[], tactics: string[]) => void
}

export const useRosterStore = create<RosterState>((set) => ({
  aOps: [],
  aTactics: [],
  setRoster: (aOps, aTactics) => set({ aOps, aTactics }),
}))
