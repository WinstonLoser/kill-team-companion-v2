import { create } from 'zustand'

export type Locale = 'en' | 'zh'

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'zh',
  setLocale: (locale) => set({ locale }),
}))
