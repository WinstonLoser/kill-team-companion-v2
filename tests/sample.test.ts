import { describe, it, expect, beforeEach } from 'vitest'
import { useViewStore } from '../src/state/viewStore'

describe('viewStore (Story 1.1 — view switching)', () => {
  beforeEach(() => {
    // 重置到默认视图，避免测试间状态泄漏
    useViewStore.getState().setView('roster')
  })

  it('默认视图为 roster', () => {
    expect(useViewStore.getState().currentView).toBe('roster')
  })

  it('setView 切换到 battle', () => {
    useViewStore.getState().setView('battle')
    expect(useViewStore.getState().currentView).toBe('battle')
  })

  it('setView 切回 roster', () => {
    useViewStore.getState().setView('battle')
    useViewStore.getState().setView('roster')
    expect(useViewStore.getState().currentView).toBe('roster')
  })
})
