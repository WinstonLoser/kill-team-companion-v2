import { create } from 'zustand'
import type { Point, TerrainFeature, OperativePlacement, Board as BoardT } from '../geometry'
import { losFinding, engagementFinding, validateTarget } from '../geometry'
import type { ObjectiveMarker, MapPack } from '../data/maps'
import { createInitialTurnState, turnReducer, type TurnState } from './turnStateMachine'
import { runShooting, runMelee, buildShootingLog, buildMeleeLog, type ResolutionLog } from '../engine'
import { rollbackTo as logRollbackTo, stepBack as logStepBack } from '../engine'
import { ElectronicDiceSource, ManualDiceSource, hashSeed } from '../dice'
import { loadPack, type FactionPack, type Effect } from '../rules'
import { useRosterStore } from './rosterStore'
import angelsPack from '../data/packs/angels_of_death.v1.json'

// 对局聚合状态（1.12-1.16 共享）。UI 只读写 store（AR-9）；引擎/几何/骰源由 store 调用。
const MATCH_PACK: FactionPack = loadPack(angelsPack)
// P4：武器查找为可选（缺类不致导入期崩溃，多阵营安全）；结算时再 guard。
const RANGED = MATCH_PACK.weapons.find((w) => w.kind === 'RANGED')
const MELEE = MATCH_PACK.weapons.find((w) => w.kind === 'MELEE')
const DEFENDER_SAVE = 3
const DEFENDER_WEAPON_FALLBACK = MELEE ?? RANGED // 近战防御方也需武器；缺则降级
function tacticEffectsFor(side: Side): Effect[] {
  if (side !== 'a') return []
  return useRosterStore.getState().rosterA.subFactionSelection
    .map((id) => MATCH_PACK.effects.find((e) => e.effectId === id))
    .filter((e): e is Effect => Boolean(e))
}

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

/** 几何 finding 翻转覆盖键：`${attackerUid}>${targetUid}>${kind}`。 */
function overrideKey(aUid: string, tUid: string, kind: string): string {
  return `${aUid}>${tUid}>${kind}`
}

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
  /** D-24 咨询式翻转：key=`${aUid}>${tUid}>${kind}` → 玩家终裁 finalValue。 */
  overrides: Record<string, boolean>
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
  /** D-24：设置某项 finding 的玩家终裁值（key 不存在则用引擎值）。 */
  setOverride: (key: string, value: boolean) => void
  clearOverride: (key: string) => void
  /** 取某对 (attacker,target) 的 findingOverrides，注入 validateTarget。 */
  findingOverridesFor: (aUid: string, tUid: string) => { kind: 'LOS' | 'COVER' | 'OBSCURED' | 'RANGE' | 'ENGAGEMENT'; finalValue: boolean }[]
  /** D-24：读某项 finding 的玩家终裁值（无则 undefined=用引擎值）。 */
  overrideValue: (aUid: string, tUid: string, kind: string) => boolean | undefined
  setIntercept: (i: { title: string; reasons: string[] } | null) => void
  pushLog: (kind: LogKind, text: string) => void
  setLogFilter: (f: LogKind | 'all') => void
  activate: (uid: string, side: Side) => void
  endActivation: (uid: string) => void
  /** AR-9 intent：一击结算。UI 只 dispatch 此（+ confirmCasualties），不直接调引擎。 */
  resolveAttack: (input: { attackerUid: string; targetUid: string; kind: 'SHOOT' | 'MELEE'; manualNats?: number[] }) => { ok: boolean; missing?: string[] }
  /** 唯一强制确认：应用伤亡（单一数据源=store），清 lastShot/currentLog。 */
  confirmCasualties: () => void
  /** 确认前撤销待结算（清 lastShot/currentLog）。 */
  undoPending: () => void
  /** AR-9：几何可视化由 store 算（UI 不调 geometry）；返回活动特工的射程 + 各敌方 LOS（含 D-24 翻转）。 */
  attackViz: (activeUid: string | null) => { range: number; targets: { uid: string; pos: Point; losFinal: boolean; losAmbiguous: boolean }[] }
  /** AR-9：控制范围判定（UI 不调 geometry）。 */
  engagementOf: (aUid: string, tUid: string) => boolean
  /** 物理骰录入所需枚数（hit+defense 上限）。 */
  manualDiceNeeded: (kind: 'SHOOT' | 'MELEE') => number
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
  setOverride: (key, value) => set((s) => ({ overrides: { ...s.overrides, [key]: value } })),
  clearOverride: (key) =>
    set((s) => {
      const next = { ...s.overrides }
      delete next[key]
      return { overrides: next }
    }),
  findingOverridesFor: (aUid, tUid) => {
    const ov = get().overrides
    return (Object.keys(ov) as (keyof typeof ov)[])
      .filter((k) => k.startsWith(`${aUid}>${tUid}>`))
      .map((k) => {
        const kind = k.split('>')[2] as 'LOS' | 'COVER' | 'OBSCURED' | 'RANGE' | 'ENGAGEMENT'
        return { kind, finalValue: ov[k]! }
      })
  },
  overrideValue: (aUid, tUid, kind) => get().overrides[overrideKey(aUid, tUid, kind)],
  setIntercept: (intercept) => set({ intercept }),
  pushLog: (kind, text) =>
    set((s) => ({ log: [{ id: nextLogId(), kind, text }, ...s.log].slice(0, 80) })),
  setLogFilter: (logFilter) => set({ logFilter }),
  // P5：activate 只 dispatch，由 reducer 自包含 upsert ready:true（不再手填 operatives）。
  activate: (uid, side) =>
    set((s) => ({ turn: turnReducer(s.turn, { type: 'ACTIVATE', opId: uid, player: side }) })),
  endActivation: (uid) =>
    set((s) => ({ turn: turnReducer(s.turn, { type: 'END_ACTIVATION', opId: uid }) })),
  // ===== AR-9 intent：一击结算（引擎/几何/骰源在 store 内，UI 只 dispatch）=====
  resolveAttack: ({ attackerUid, targetUid, kind, manualNats }) => {
    const s = get()
    const attacker = s.tokens.find((t) => t.uid === attackerUid)
    const target = s.tokens.find((t) => t.uid === targetUid)
    const map = s.mapPack
    if (!attacker || !target || !map) return { ok: false, missing: ['无效攻击方/目标/地图'] }
    const aPl: OperativePlacement = { operativeId: attacker.uid, pos: attacker.pos, baseRadius: attacker.baseRadius }
    const dPl: OperativePlacement = { operativeId: target.uid, pos: target.pos, baseRadius: target.baseRadius }
    const board: BoardT = {
      terrain: map.terrain,
      operatives: s.tokens.filter((t) => t.alive && t.placed).map((t) => ({ operativeId: t.uid, pos: t.pos, baseRadius: t.baseRadius })),
    }
    const others = s.tokens.filter((t) => t.alive && t.placed && t.uid !== target.uid).map((t) => t.pos)
    // P3/D-24：注入玩家终裁 findingOverrides 到资格判定
    const findingOverrides = get().findingOverridesFor(attacker.uid, target.uid)
    const elig = validateTarget(aPl, dPl, RANGED?.profile.range ?? 24, board, others, { findingOverrides })
    if (!elig.ok) return { ok: false, missing: elig.missing }

    const effects = tacticEffectsFor(attacker.side)
    const useWeapon = kind === 'SHOOT' ? RANGED : MELEE
    if (!useWeapon) return { ok: false, missing: [`阵营包缺 ${kind} 武器`] }
    const dice = manualNats
      ? (() => { const m = new ManualDiceSource(); m.provide(manualNats); return m })()
      : new ElectronicDiceSource(hashSeed(`${attacker.uid}>${target.uid}`, kind, s.nextShotSeq()))

    let woundsDealt: number
    let log: ResolutionLog
    if (kind === 'SHOOT') {
      const cover = elig.findings.find((f) => f.kind === 'COVER')?.finalValue ?? false
      const input = {
        attacker: { operativeId: attacker.uid, weapon: useWeapon },
        defender: { operativeId: target.uid, save: DEFENDER_SAVE, wounds: target.wounds },
        effects, dice, hasCover: cover,
      }
      const r = runShooting(input)
      woundsDealt = r.woundsDealt
      log = buildShootingLog(`${attacker.uid}>${target.uid}`, input, r)
    } else {
      const input = {
        attacker: { operativeId: attacker.uid, weapon: useWeapon, save: DEFENDER_SAVE, wounds: attacker.wounds },
        defender: { operativeId: target.uid, weapon: DEFENDER_WEAPON_FALLBACK!, save: DEFENDER_SAVE, wounds: target.wounds },
        effects, dice,
      }
      const r = runMelee(input)
      woundsDealt = r.woundsToDefender
      log = buildMeleeLog(`${attacker.uid}>${target.uid}`, input, r)
    }
    // 待确认伤亡：lastShot 持 prevWounds，damage 不在此应用（confirmCasualties 才写回）。
    const logKind: LogKind = kind === 'SHOOT' ? 'shoot' : 'melee'
    set({
      lastShot: { targetUid: target.uid, targetName: target.name, woundsDealt, prevWounds: target.wounds, attackerUid: attacker.uid, kind: logKind },
      currentLog: log,
      log: [{ id: nextLogId(), kind: logKind, text: `${attacker.name} → ${target.name}：待确认伤亡 ${woundsDealt}` }, ...s.log].slice(0, 80),
    })
    return { ok: true }
  },
  // P1/P2：唯一强制确认——单一数据源(store)应用伤亡，清 lastShot/currentLog。
  confirmCasualties: () => {
    const ls = get().lastShot
    if (!ls) return
    const target = get().tokens.find((t) => t.uid === ls.targetUid)
    const prevW = target?.wounds ?? 0
    get().applyDamage(ls.targetUid, ls.woundsDealt)
    const newW = Math.max(0, prevW - ls.woundsDealt)
    set((s) => ({
      lastShot: null,
      currentLog: null,
      log: [{ id: nextLogId(), kind: ls.kind, text: `${ls.targetName} 确认伤亡 ${ls.woundsDealt}${newW <= 0 ? '（残废）' : `（剩 ${newW}）`}` }, ...s.log].slice(0, 80),
    }))
  },
  undoPending: () => set({ lastShot: null, currentLog: null }),
  attackViz: (activeUid) => {
    const s = get()
    const map = s.mapPack
    if (!activeUid || !map || !RANGED) return { range: 0, targets: [] }
    const attacker = s.tokens.find((t) => t.uid === activeUid)
    if (!attacker) return { range: 0, targets: [] }
    const board: BoardT = { terrain: map.terrain, operatives: s.tokens.filter((t) => t.alive && t.placed).map((t) => ({ operativeId: t.uid, pos: t.pos, baseRadius: t.baseRadius })) }
    const range = RANGED.profile.range ?? 24
    const targets = s.tokens
      .filter((t) => t.alive && t.placed && t.side !== attacker.side)
      .map((t) => {
        const los = losFinding(attacker.pos, t.pos, board)
        const ov = s.overrides[overrideKey(attacker.uid, t.uid, 'LOS')]
        return { uid: t.uid, pos: t.pos, losFinal: ov ?? los.finalValue, losAmbiguous: los.confidence === 'AMBIGUOUS' }
      })
    return { range, targets }
  },
  engagementOf: (aUid, tUid) => {
    const s = get()
    const map = s.mapPack
    const a = s.tokens.find((t) => t.uid === aUid)
    const t = s.tokens.find((t) => t.uid === tUid)
    if (!map || !a || !t) return false
    const board: BoardT = { terrain: map.terrain, operatives: s.tokens.filter((x) => x.alive && x.placed).map((x) => ({ operativeId: x.uid, pos: x.pos, baseRadius: x.baseRadius })) }
    const los = losFinding(a.pos, t.pos, board)
    const ov = s.overrides[overrideKey(aUid, tUid, 'LOS')]
    return engagementFinding(
      { operativeId: a.uid, pos: a.pos, baseRadius: a.baseRadius },
      { operativeId: t.uid, pos: t.pos, baseRadius: t.baseRadius },
      ov ?? los.finalValue,
    ).finalValue
  },
  manualDiceNeeded: (kind) => {
    const w = kind === 'SHOOT' ? RANGED : MELEE
    if (!w) return 0
    return w.profile.attacks * 2 // hit + defense 上限（射击）/ atk + def（近战）
  },
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
