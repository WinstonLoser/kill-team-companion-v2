import { create } from 'zustand'

export type AnimationType = 'DAMAGE' | 'DEATH' | 'HEAL' | 'BUFF' | 'CUSTOM'

export interface AnimationRequest {
  id: string
  type: AnimationType
  avatarUrl?: string
  themeColorRgb?: string
  text?: string
  maxWounds?: number
  prevWounds?: number
  currentWounds?: number
  durationMs?: number
  onComplete?: () => void
}

interface AnimationState {
  queue: AnimationRequest[]
  activeAnimation: AnimationRequest | null
  
  // Enqueue a new animation
  playAnimation: (req: Omit<AnimationRequest, 'id'>) => void
  
  // Called by the engine when the current animation finishes
  finishCurrent: () => void
}

let nextId = 1

export const useAnimationStore = create<AnimationState>((set, get) => ({
  queue: [],
  activeAnimation: null,

  playAnimation: (req) => {
    const newReq: AnimationRequest = { ...req, id: `anim_${nextId++}` }
    set((state) => {
      // If nothing is playing, play immediately
      if (!state.activeAnimation) {
        return { activeAnimation: newReq }
      }
      // Otherwise queue it
      return { queue: [...state.queue, newReq] }
    })
  },

  finishCurrent: () => {
    set((state) => {
      const current = state.activeAnimation
      if (current && current.onComplete) {
        // We defer onComplete so it doesn't run during render/dispatch
        setTimeout(() => current.onComplete!(), 0)
      }

      if (state.queue.length > 0) {
        const next = state.queue[0]
        return {
          activeAnimation: next,
          queue: state.queue.slice(1)
        }
      }
      return { activeAnimation: null }
    })
  }
}))
