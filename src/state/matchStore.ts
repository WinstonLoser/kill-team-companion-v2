import { create } from 'zustand'
import type { Point, TerrainFeature } from '../geometry'
import type { ObjectiveMarker, MapPack } from '../data/maps'
import { createInitialTurnState, turnReducer, type TurnState } from './turnStateMachine'
import type { ResolutionLog } from '../engine'
import { rollbackTo as logRollbackTo, stepBack as logStepBack } from '../engine'

// 对局聚合状态（1.12-1.16 共享）。UI 只读写 store（AR-9），不直接调引擎/几何。

export type Phase = 'map-select' | 'deploy' | 'play' | 'ended'
export type Side = 'a' | 'b'
export type DiceSourceKind = 'electronic' | 'manual'

export interface MatchToken {
  uid: string
  side: Side
  opId: string
  name: string
  pos: Point
  facing: number // 度，0=朝右；双击旋转 45°
  baseRadius: number
  wounds: number
  maxWounds: number // 起始耐伤（受创阈值视觉用，1.15 T4）
  alive: boolean
  placed: boolean
}

export type LogKind = 'turn' | 'shoot' | 'melee' | 'ploy' | 'score' | 'deploy' | 'system'
export interface LogEntry {
  id: number
  kind: LogKind
  text: string
}

export interface LastShot {
  targetUid: string
  targetName: string
  woundsDealt: number
  prevWounds: number
  attackerUid: string
  kind: 'shoot' | 'melee'
}

/** 几何 finding 翻转覆盖（咨询式 D-24）：key=`${attackerUid}>${targetUid}>${kind}`。 */
type OverrideKey = string

interface MatchState {
  phase: Phase
  mapPack: MapPack | null
  customTerrain: TerrainFeature[] // 自定义板会话内（D-20）
  tokens: MatchToken[]
  turn: TurnState
  vp: { a: number; b: number }
  log: LogEntry[]
  logFilter: LogKind | 'all'
  selected: string | null
  dragging: string | null
  dragOrigin: Point | null
  lastShot: LastShot | null
  currentLog: ResolutionLog | null
  shotSeq: number
  diceSource: DiceSourceKind
  overrides: Record<OverrideKey, boolean>
  winner: string | null
  intercept: { title: string; reasons: string[] } | null

  // actions
  setPhase: (p: Phase) => void
  loadMap: (m: MapPack) => void
  startBlank: (bounds: { w: number; h: number }) => void
  addTerrain: (t: TerrainFeature) => void
  removeTerrain: (id: string) => void
  clearTerrain: () => void
  initTokens: (tokens: MatchToken[]) => void
  placeToken: (uid: string, pos: Point, facing: number) => void
  moveToken: (uid: string, pos: Point) => void
  rotateToken: (uid: string) => void
  setSelected: (uid: string | null) => void
  setDragging: (uid: string | null, origin?: Point | null) => void
  applyDamage: (uid: string, woundsDealt: number) => void
  undoLastShot: () => void
  setLastShot: (s: LastShot | null) => void
  setCurrentLog: (l: ResolutionLog | null) => void
  rollbackStep: (index: number) => void // 回滚到某步（保留 0..index，丢弃其后）
  stepBackCurrent: () => void // 单步回退
  nextShotSeq: () => number
  setDiceSource: (d: DiceSourceKind) => void
  toggleOverride: (key: OverrideKey) => void
  overrideFor: (key: OverrideKey) => boolean
  setIntercept: (i: { title: string; reasons: string[] } | null) => void
  pushLog: (kind: LogKind, text: string) => void
  setLogFilter: (f: LogKind | 'all') => void
  activate: (uid: string, side: Side) => void
  endActivation: (uid: string) => void
  scoreAndEndTP: (objectiveControl: (o: ObjectiveMarker) => Side | null) => void
  reset: () => void
}

let logId = 0
function nextLogId(): number {
  logId += 1
  return logId
}

export const useMatchStore = create<MatchState>((set, get) => ({
  phase: 'map-select',
  mapPack: null,
  customTerrain: [],
  tokens: [],
  turn: createInitialTurnState(),
  vp: { a: 0, b: 0 },
  log: [],
  logFilter: 'all',
  selected: null,
  dragging: null,
  dragOrigin: null,
  lastShot: null,
  currentLog: null,
  shotSeq: 0,
  diceSource: 'electronic',
  overrides: {},
  winner: null,
  intercept: null,

  setPhase: (phase) => set({ phase }),
  loadMap: (m) =>
    set({
      mapPack: m,
      customTerrain: [...m.terrain],
      phase: 'deploy',
      log: [{ id: nextLogId(), kind: 'system', text: `载入地图「${m.name}」· 部署阶段` }],
    }),
  startBlank: (bounds) =>
    set({
      mapPack: {
        mapId: 'blank',
        name: '自定义板',
        version: '1.0.0',
        bounds,
        terrain: [],
        objectives: [{ id: 'obj1', pos: { x: bounds.w / 2, y: bounds.h / 2 }, controlRange: 3 }],
        dropZones: {
          a: [
            { x: 0, y: 0 },
            { x: bounds.w / 3, y: 0 },
            { x: bounds.w / 3, y: bounds.h },
            { x: 0, y: bounds.h },
          ],
          b: [
            { x: (bounds.w * 2) / 3, y: 0 },
            { x: bounds.w, y: 0 },
            { x: bounds.w, y: bounds.h },
            { x: (bounds.w * 2) / 3, y: bounds.h },
          ],
        },
      },
      customTerrain: [],
      phase: 'deploy',
      log: [{ id: nextLogId(), kind: 'system', text: '自定义板 · 画地形后部署' }],
    }),
  addTerrain: (t) => set((s) => ({ customTerrain: [...s.customTerrain, t] })),
  removeTerrain: (id) => set((s) => ({ customTerrain: s.customTerrain.filter((t) => t.id !== id) })),
  clearTerrain: () => set({ customTerrain: [] }),
  initTokens: (tokens) => set({ tokens }),
  placeToken: (uid, pos, facing) =>
    set((s) => ({ tokens: s.tokens.map((t) => (t.uid === uid ? { ...t, placed: true, pos, facing } : t)) })),
  moveToken: (uid, pos) => set((s) => ({ tokens: s.tokens.map((t) => (t.uid === uid ? { ...t, pos } : t)) })),
  rotateToken: (uid) =>
    set((s) => ({ tokens: s.tokens.map((t) => (t.uid === uid ? { ...t, facing: (t.facing + 45) % 360 } : t)) })),
  setSelected: (selected) => set({ selected }),
  setDragging: (dragging, origin = null) => set({ dragging, dragOrigin: origin }),
  applyDamage: (uid, woundsDealt) =>
    set((s) => ({
      tokens: s.tokens.map((t) => {
        if (t.uid !== uid) return t
        const nw = Math.max(0, t.wounds - woundsDealt)
        return { ...t, wounds: nw, alive: nw > 0 }
      }),
    })),
  undoLastShot: () => {
    const ls = get().lastShot
    if (!ls) return
    set((s) => ({
      tokens: s.tokens.map((t) =>
        t.uid === ls.targetUid ? { ...t, wounds: ls.prevWounds, alive: ls.prevWounds > 0 } : t,
      ),
      lastShot: null,
    }))
  },
  setLastShot: (lastShot) => set({ lastShot }),
  setCurrentLog: (currentLog) => set({ currentLog }),
  rollbackStep: (index) => set((s) => (s.currentLog ? { currentLog: logRollbackTo(s.currentLog, index) } : {})),
  stepBackCurrent: () => set((s) => (s.currentLog ? { currentLog: logStepBack(s.currentLog) } : {})),
  nextShotSeq: () => {
    const n = get().shotSeq + 1
    set({ shotSeq: n })
    return n
  },
  setDiceSource: (diceSource) => set({ diceSource }),
  toggleOverride: (key) => set((s) => ({ overrides: { ...s.overrides, [key]: !s.overrides[key] } })),
  overrideFor: (key) => Boolean(get().overrides[key]),
  setIntercept: (intercept) => set({ intercept }),
  pushLog: (kind, text) =>
    set((s) => ({ log: [{ id: nextLogId(), kind, text }, ...s.log].slice(0, 80) })),
  setLogFilter: (logFilter) => set({ logFilter }),
  activate: (uid, side) =>
    set((s) => {
      const base = {
        ...s,
        operatives: { ...s.turn.operatives, [uid]: { order: 'ENGAGED' as const, ready: true, apUsed: 0, actionsThisActivation: [], fallBackDone: false, chargeDone: false, moveDone: false } },
      }
      const turn = turnReducer({ ...s.turn, operatives: base.operatives }, { type: 'ACTIVATE', opId: uid, player: side })
      return { turn }
    }),
  endActivation: (uid) =>
    set((s) => ({ turn: turnReducer(s.turn, { type: 'END_ACTIVATION', opId: uid }) })),
  scoreAndEndTP: (objectiveControl) => {
    const s = get()
    const map = s.mapPack
    let scoredA = s.vp.a
    let scoredB = s.vp.b
    const events: string[] = []
    if (map) {
      for (const o of map.objectives) {
        const ctrl = objectiveControl(o)
        if (ctrl === 'a') { scoredA++; events.push(`${o.id} → A`) }
        else if (ctrl === 'b') { scoredB++; events.push(`${o.id} → B`) }
      }
    }
    const next = turnReducer(s.turn, { type: 'END_TURNING_POINT' })
    const newLogs: LogEntry[] = []
    if (events.length) newLogs.push({ id: nextLogId(), kind: 'score', text: `TP${s.turn.turningPoint} 计分：${events.join('，')}（VP A:${scoredA} B:${scoredB}）` })
    const ended = next.phase === 'BATTLE_END'
    let winner: string | null = s.winner
    if (ended) {
      winner = scoredA > scoredB ? 'A 胜' : scoredB > scoredA ? 'B 胜' : '平局'
      newLogs.push({ id: nextLogId(), kind: 'system', text: `战斗结束 → ${winner}（VP A:${scoredA} B:${scoredB}）` })
    }
    set({
      vp: { a: scoredA, b: scoredB },
      turn: ended ? next : { ...next, activePlayer: next.activePlayer === 'a' ? 'b' : 'a' },
      winner: ended ? winner : null,
      phase: ended ? 'ended' : s.phase,
      selected: null,
      log: [...newLogs, ...s.log].slice(0, 80),
    })
  },
  reset: () =>
    set({
      phase: 'map-select',
      mapPack: null,
      customTerrain: [],
      tokens: [],
      turn: createInitialTurnState(),
      vp: { a: 0, b: 0 },
      log: [],
      selected: null,
      dragging: null,
      dragOrigin: null,
      lastShot: null,
      currentLog: null,
      shotSeq: 0,
      overrides: {},
      winner: null,
      intercept: null,
    }),
}))

// ===== 选择器/派生（纯函数，组件用） =====
export function selectActivated(state: MatchState, uid: string | null): boolean {
  if (!uid) return false
  return Boolean(state.turn.operatives[uid]?.ready)
}
