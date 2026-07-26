import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RollMode = 'AUTO' | 'MANUAL'
/** 设计系统的两套配色：dark 为默认（品牌主色板），light 走 tokens/colors-light.css。 */
export type Theme = 'dark' | 'light'

interface SettingsState {
  rollMode: RollMode
  setRollMode: (mode: RollMode) => void
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      rollMode: 'AUTO',
      setRollMode: (mode) => set({ rollMode: mode }),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'kta-settings-storage',
    }
  )
)
