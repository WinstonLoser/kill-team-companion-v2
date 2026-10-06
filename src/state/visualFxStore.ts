import { create } from 'zustand'
import type { Point } from '../geometry'

export type MotionMode = 'full' | 'reduced'
export type BoardFxKind = 'MOVE' | 'SHOT' | 'MELEE' | 'DEPLOY' | 'RULE' | 'DAMAGE' | 'DOOR'
export interface BoardFx {
  id: number
  kind: BoardFxKind
  uid?: string
  miss?: boolean
  factionId?: string
  from?: Point
  to: Point
  path?: Point[]
  label?: string
  durationMs: number
}
interface VisualFxState {
  motionMode: MotionMode
  setMotionMode: (mode: MotionMode) => void
  boardEffects: BoardFx[]
  emitBoardFx: (effect: Omit<BoardFx, 'id' | 'durationMs'> & { durationMs?: number }) => void
  phaseNotice: { id: number; title: string; detail?: string; factionId?: string } | null
  showPhaseNotice: (title: string, detail?: string, factionId?: string) => void
}

let nextId = 1
function initialMotionMode(): MotionMode {
  if (typeof window === 'undefined') return 'full'
  const saved = window.localStorage.getItem('kt-motion-mode')
  if (saved === 'full' || saved === 'reduced') return saved
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full'
}

export const useVisualFxStore = create<VisualFxState>((set, get) => ({
  motionMode: initialMotionMode(),
  setMotionMode: (mode) => {
    if (typeof window !== 'undefined') window.localStorage.setItem('kt-motion-mode', mode)
    set({ motionMode: mode })
  },
  boardEffects: [],
  emitBoardFx: (effect) => {
    const id = nextId++
    const durationMs = get().motionMode === 'reduced' ? 320 : effect.durationMs ?? 800
    set(state => ({ boardEffects: [...state.boardEffects, { ...effect, id, durationMs }] }))
    setTimeout(() => set(state => ({ boardEffects: state.boardEffects.filter(item => item.id !== id) })), durationMs)
  },
  phaseNotice: null,
  showPhaseNotice: (title, detail, factionId) => {
    const id = nextId++
    set({ phaseNotice: { id, title, detail, factionId } })
    setTimeout(() => set(state => state.phaseNotice?.id === id ? { phaseNotice: null } : {}), get().motionMode === 'reduced' ? 700 : 1500)
  },
}))
