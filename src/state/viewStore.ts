import { create } from 'zustand'

export type View = 'roster' | 'match' | 'simpleMatch' | 'rules' | 'testLab' | 'abilityLab'

interface ViewState {
  currentView: View
  setView: (view: View) => void
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'roster',
  setView: (currentView) => set({ currentView }),
}))
