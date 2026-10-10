import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { FACTION_REGISTRY } from '../../src/data/packs'
import { factionVisual } from '../../src/ui/visual/factionVisuals'
import { useVisualFxStore } from '../../src/state/visualFxStore'

afterEach(() => {
  vi.useRealTimers()
  useVisualFxStore.setState({ boardEffects: [], phaseNotice: null, motionMode: 'full' })
})

describe('对局视觉反馈', () => {
  it('五个可玩阵营均有独立视觉标识', () => {
    const visuals = FACTION_REGISTRY.map(entry => factionVisual(entry.id))
    expect(new Set(visuals.map(visual => visual.accent)).size).toBe(5)
    expect(visuals.every(visual => visual.iconUrl?.endsWith('.png') && visual.label)).toBe(true)
    expect(visuals.every(visual => existsSync(`public${visual.iconUrl}`))).toBe(true)
  })

  it('棋盘反馈按事件入列并自动清除；简化模式缩短停留', () => {
    vi.useFakeTimers()
    useVisualFxStore.getState().emitBoardFx({ kind: 'MOVE', to: { x: 3, y: 4 }, durationMs: 800 })
    expect(useVisualFxStore.getState().boardEffects).toMatchObject([{ kind: 'MOVE', durationMs: 800 }])
    vi.advanceTimersByTime(800)
    expect(useVisualFxStore.getState().boardEffects).toEqual([])
    useVisualFxStore.getState().setMotionMode('reduced')
    useVisualFxStore.getState().emitBoardFx({ kind: 'SHOT', to: { x: 5, y: 4 }, durationMs: 900 })
    expect(useVisualFxStore.getState().boardEffects[0]?.durationMs).toBe(320)
    vi.advanceTimersByTime(320)
    expect(useVisualFxStore.getState().boardEffects).toEqual([])
  })

  it('连续阶段提示不会让旧计时器清掉新提示', () => {
    vi.useFakeTimers()
    useVisualFxStore.getState().showPhaseNotice('战略准备')
    vi.advanceTimersByTime(500)
    useVisualFxStore.getState().showPhaseNotice('交替行动')
    vi.advanceTimersByTime(1000)
    expect(useVisualFxStore.getState().phaseNotice?.title).toBe('交替行动')
    vi.advanceTimersByTime(500)
    expect(useVisualFxStore.getState().phaseNotice).toBeNull()
  })
})
