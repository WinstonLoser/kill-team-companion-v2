import { create } from 'zustand'

// 顶层入口（无存档面 D-20）。视图切换走 Zustand 状态，不用路由库（AQ-7 细化）。
export type View = 'roster' | 'match' | 'rules' | 'testLab'

interface ViewState {
  currentView: View
  setView: (view: View) => void
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'roster',
  setView: (currentView) => set({ currentView }),
}))
