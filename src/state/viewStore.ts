import { create } from 'zustand'

/**
 * 应用只有两个界面：建队 → 对局。
 * 地图选择 / 地形编辑 / 部署 / 各实验室仍在磁盘上，但不再挂路由。
 */
export type View = 'roster' | 'battle'

interface ViewState {
  currentView: View
  setView: (view: View) => void
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'roster',
  setView: (currentView) => set({ currentView }),
}))
