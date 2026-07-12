import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RollMode = 'AUTO' | 'MANUAL'

interface SettingsState {
  rollMode: RollMode
  setRollMode: (mode: RollMode) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      rollMode: 'AUTO',
      setRollMode: (mode) => set({ rollMode: mode }),
    }),
    {
      name: 'kta-settings-storage',
    }
  )
)
