import { create } from 'zustand'
import type { Point, TerrainFeature, OperativePlacement, Board as BoardT } from '../geometry'
import { losFinding, engagementFinding, validateTarget, coverFinding, obscuredFinding } from '../geometry'
import type { ObjectiveMarker, MapPack } from '../data/maps'
import { createInitialTurnState, turnReducer, type TurnState } from './turnStateMachine'
import { runShooting, runMelee, buildShootingLog, buildMeleeLog, type ResolutionLog } from '../engine'
import { rollbackTo as logRollbackTo, stepBack as logStepBack } from '../engine'
import { ElectronicDiceSource, ManualDiceSource, hashSeed } from '../dice'
import { loadPack, type FactionPack, type Effect } from '../rules'
import type { PredicateContext } from '../rules/predicates'
import { useRosterStore } from './rosterStore'
import angelsPack from '../data/packs/angels_of_death.v1.json'
import legionariesPack from '../data/packs/legionaries.v1.json'
import plaguePack from '../data/packs/plague_marines.v1.json'

// 对局聚合状态（1.12-1.16 共享）。UI 只读写 store（AR-9）；引擎/几何/骰源由 store 调用。
const MATCH_PACK: FactionPack = loadPack(angelsPack)
// 多阵营注册表：按 opId 前缀解析特工阵营包（angels_/leg_/plg_）。
const PACKS: FactionPack[] = [MATCH_PACK, loadPack(legionariesPack), loadPack(plaguePack)]
function packOfOp(opId: string): FactionPack {
  return PACKS.find((p) => p.operatives.some((o) => o.operativeId === opId)) ?? MATCH_PACK
}
function weaponOfPack(pack: FactionPack, kind: 'RANGED' | 'MELEE') {
  return pack.weapons.find((w) => w.kind === kind)
}
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
/** 攻击方阵营「常驻」effect（source 以 factionRule: 开头）：瘟疫毒素挂指示物 + 剧毒 +1 等。 */
function factionRuleEffectsFor(opId: string): Effect[] {
  return packOfOp(opId).effects.filter((e) => e.source.startsWith('factionRule:'))
}
/** 从 ResolutionLog 提取已生效的 GRANT_MARKER（流程结束挂的指示物，如 POISON）。 */
function grantedMarkersOf(log: ResolutionLog | null): { marker: string; target: string }[] {
  if (!log) return []
  const ids = new Set<string>()
  for (const rec of log.records) for (const id of rec.appliedEffectIds) ids.add(id)
  const out: { marker: string; target: string }[] = []
  for (const pack of PACKS) {
    for (const e of pack.effects) {
      if (ids.has(e.effectId) && e.modifier.kind === 'GRANT_MARKER') {
        const p = e.modifier.payload as { marker?: string; target?: string }
        if (p.marker) out.push({ marker: p.marker, target: p.target ?? 'DEFENDER' })
      }
    }
  }
  return out
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
  markers: string[] // 指示物（POISON/FLY_CLOUD 等；GRANT_MARKER 经 confirm 应用，谓词 targetHasMarker 读）
  alive: boolean
  placed: boolean
}

export type LogKind = 'turn' | 'shoot' | 'melee' | 'ploy' | 'score' | 'deploy' | 'system'
export interface LogEntry {
  id: number
  kind: LogKind
  text: string
}

/** 特工身上的限时 effect（D4：到期结算 + 单位卡显示剩余 TP）。 */
export interface ActiveEffect {
  id: string // effectId（溯源）
  label: string
  remainingTP: number // 剩余转折点；TP 结束递减，0 到期移除
}

/** D3：会话内全局回退快照（确认伤亡 / 计分前各存一份，"回滚到此"恢复棋盘+VP+回合）。 */
export interface Snapshot {
  id: number
  label: string
  tokens: MatchToken[]
  vp: { a: number; b: number }
  turn: TurnState
  activeEffects: Record<string, ActiveEffect[]>
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
  /** D4：特工身上的限时 effect（uid → 列表）。 */
  activeEffects: Record<string, ActiveEffect[]>
  /** D3：会话内回退快照栈（确认/计分前 push）。 */
  snapshots: Snapshot[]
  /** D3：最近一次已确认结算的 ResolutionLog，供日志 ▶回放重展。 */
  replayLog: ResolutionLog | null
  winner: string | null
  intercept: { title: string; reasons: string[] } | null

  // actions
  setPhase: (p: Phase) => void
  loadMap: (m: MapPack) => void
  startBlank: (bounds: { w: number; h: number }) => void
  addTerrain: (t: TerrainFeature) => void
  removeTerrain: (id: string) => void
  clearTerrain: () => void
  /** D2：自定义板编辑结果一次性提交（地形+目标点+降落区）。 */
  commitBlankMap: (draft: { terrain: TerrainFeature[]; objectives: ObjectiveMarker[]; dropA: Point[]; dropB: Point[] }) => void
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
  attackViz: (activeUid: string | null) => { range: number; controlRing: { center: Point; r: number } | null; ownCover: 'open' | 'cover' | 'exposed' | null; targets: { uid: string; pos: Point; losFinal: boolean; losAmbiguous: boolean; obscured: boolean }[] }
  /** AR-9：控制范围判定（UI 不调 geometry）。 */
  engagementOf: (aUid: string, tUid: string) => boolean
  /** 物理骰录入所需枚数（hit+defense 上限）。 */
  manualDiceNeeded: (kind: 'SHOOT' | 'MELEE') => number
  /** D4：给特工加限时 effect（同 id 刷新 duration）。 */
  addEffect: (uid: string, effect: { id: string; label: string; durationTP: number }) => void
  /** D4：TP 结束结算到期 effect（递减、移除、记日志）；返回到期条目数供 push。 */
  tickEffects: () => number
  /** D3：压一份回退快照（label 描述事件）。 */
  pushSnapshot: (label: string) => void
  /** D3：回退到指定快照（恢复 tokens/vp/turn/activeEffects），记日志。 */
  rewindToSnapshot: (id: number) => void
  /** D3：重展最近已确认结算（日志 ▶回放）。 */
  replayLast: () => void
  /** P7：目标控制归属（读 store 当下 tokens，非渲染闭包）。 */
  controlOf: (o: ObjectiveMarker) => Side | null
  /** P11：ActionBar push 文案（TP 结束计分等），null=无。 */
  pushMsg: string | null
  setPushMsg: (msg: string | null) => void
  scoreAndEndTP: () => void
  reset: () => void
}

let logId = 0
function nextLogId(): number {
  logId += 1
  return logId
}
let snapshotId = 0

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
  activeEffects: {},
  snapshots: [],
  replayLog: null,
  pushMsg: null,
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
  commitBlankMap: (draft) => {
    const s = get()
    const base = s.mapPack
    if (!base) { set({ phase: 'deploy' }); return }
    const merged: MapPack = { ...base, terrain: draft.terrain, objectives: draft.objectives, dropZones: { a: draft.dropA, b: draft.dropB } }
    set({ mapPack: merged, customTerrain: draft.terrain, phase: 'deploy' })
  },
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
    // 多阵营：解析攻击方阵营包（武器/effect/谓词 ctx）
    const atkPack = packOfOp(attacker.opId)
    const tgtPack = packOfOp(target.opId)
    const atkRanged = weaponOfPack(atkPack, 'RANGED')
    // P3/D-24：注入玩家终裁 findingOverrides 到资格判定
    const findingOverrides = get().findingOverridesFor(attacker.uid, target.uid)
    const elig = validateTarget(aPl, dPl, atkRanged?.profile.range ?? RANGED?.profile.range ?? 24, board, others, { findingOverrides })
    if (!elig.ok) return { ok: false, missing: elig.missing }

    // 攻击方 effect 栈 = 战团战术(A) + 阵营常驻规则（瘟疫毒素挂指示物/剧毒等）
    const effects = [...tacticEffectsFor(attacker.side), ...factionRuleEffectsFor(attacker.opId)]
    const useWeapon = weaponOfPack(atkPack, kind === 'SHOOT' ? 'RANGED' : 'MELEE') ?? (kind === 'SHOOT' ? RANGED : MELEE)
    if (!useWeapon) return { ok: false, missing: [`阵营包缺 ${kind} 武器`] }
    // 谓词 ctx（W3 接线）：目标指示物 + 双方阵营 + 武器类 + 距离 → 剧毒(+1 vs POISON)等条件门控生效
    const predicate: PredicateContext = {
      targetMarkers: target.markers,
      attackerFaction: atkPack.faction.id,
      targetFaction: tgtPack.faction.id,
      weaponKind: kind === 'SHOOT' ? 'RANGED' : 'MELEE',
      rangeInches: Math.hypot(target.pos.x - attacker.pos.x, target.pos.y - attacker.pos.y),
    }
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
        effects, defenderEffects: factionRuleEffectsFor(target.opId), dice, hasCover: cover, predicate,
      }
      const r = runShooting(input)
      woundsDealt = r.woundsDealt
      log = buildShootingLog(`${attacker.uid}>${target.uid}`, input, r)
    } else {
      const input = {
        attacker: { operativeId: attacker.uid, weapon: useWeapon, save: DEFENDER_SAVE, wounds: attacker.wounds },
        defender: { operativeId: target.uid, weapon: DEFENDER_WEAPON_FALLBACK ?? useWeapon, save: DEFENDER_SAVE, wounds: target.wounds },
        effects, defenderEffects: factionRuleEffectsFor(target.opId), dice, predicate,
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
  // D3：确认前 push 快照（供日志"回滚到此"恢复棋盘），并把 ResolutionLog 存为 replayLog。
  confirmCasualties: () => {
    const ls = get().lastShot
    if (!ls) return
    get().pushSnapshot(`确认伤亡 ${ls.targetName}`)
    const log = get().currentLog
    const target = get().tokens.find((t) => t.uid === ls.targetUid)
    const prevW = target?.wounds ?? 0
    get().applyDamage(ls.targetUid, ls.woundsDealt)
    const newW = Math.max(0, prevW - ls.woundsDealt)
    // 流程结束挂的指示物（POISON 等）应用到对应 token——下次攻击该目标时谓词 targetHasMarker 命中
    const granted = grantedMarkersOf(log)
    const markerLog: string[] = []
    if (granted.length) {
      set((s) => ({
        tokens: s.tokens.map((t) => {
          const add = granted.filter((g) => (g.target === 'DEFENDER' ? t.uid === ls.targetUid : t.uid === ls.attackerUid) && !t.markers.includes(g.marker))
          if (add.length === 0) return t
          add.forEach((g) => markerLog.push(`${t.name} ←${g.marker}`))
          return { ...t, markers: [...t.markers, ...add.map((g) => g.marker)] }
        }),
      }))
    }
    set((s) => ({
      lastShot: null,
      currentLog: null,
      replayLog: log,
      log: [{ id: nextLogId(), kind: ls.kind, text: `${ls.targetName} 确认伤亡 ${ls.woundsDealt}${newW <= 0 ? '（残废）' : `（剩 ${newW}）`}${markerLog.length ? `；挂指示物 ${markerLog.join(',')}` : ''}` }, ...s.log].slice(0, 80),
    }))
  },
  undoPending: () => set({ lastShot: null, currentLog: null }),
  attackViz: (activeUid) => {
    const s = get()
    const map = s.mapPack
    if (!activeUid || !map || !RANGED) return { range: 0, controlRing: null, ownCover: null, targets: [] }
    const attacker = s.tokens.find((t) => t.uid === activeUid)
    if (!attacker) return { range: 0, controlRing: null, ownCover: null, targets: [] }
    const placed = s.tokens.filter((t) => t.alive && t.placed)
    const board: BoardT = { terrain: map.terrain, operatives: placed.map((t) => ({ operativeId: t.uid, pos: t.pos, baseRadius: t.baseRadius })) }
    const range = RANGED.profile.range ?? 24
    // 1.14 AC2：1" 控制范围圈 + 自身掩护染色（COVER 1" 内→绿；2" 内有他特工→灰）
    const others = placed.filter((t) => t.uid !== attacker.uid).map((t) => t.pos)
    const cf = coverFinding(attacker.pos, board, others)
    return {
      range,
      controlRing: { center: attacker.pos, r: 1 },
      ownCover: cf.finalValue ? 'cover' : (others.some((o) => Math.hypot(o.x - attacker.pos.x, o.y - attacker.pos.y) <= 2) ? 'exposed' : 'open'),
      targets: s.tokens
        .filter((t) => t.alive && t.placed && t.side !== attacker.side)
        .map((t) => {
          const los = losFinding(attacker.pos, t.pos, board)
          const ov = s.overrides[overrideKey(attacker.uid, t.uid, 'LOS')]
          const obscured = obscuredFinding(t.pos, board).finalValue
          return { uid: t.uid, pos: t.pos, losFinal: ov ?? los.finalValue, losAmbiguous: los.confidence === 'AMBIGUOUS', obscured }
        }),
    }
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
  addEffect: (uid, effect) =>
    set((s) => {
      const cur = s.activeEffects[uid] ?? []
      const without = cur.filter((e) => e.id !== effect.id)
      return { activeEffects: { ...s.activeEffects, [uid]: [...without, { id: effect.id, label: effect.label, remainingTP: effect.durationTP }] } }
    }),
  tickEffects: () => {
    const s = get()
    const expired: string[] = []
    const next: Record<string, ActiveEffect[]> = {}
    for (const [uid, list] of Object.entries(s.activeEffects)) {
      const kept: ActiveEffect[] = []
      for (const e of list) {
        const rem = e.remainingTP - 1
        if (rem <= 0) expired.push(`${e.label}(${uid})`)
        else kept.push({ ...e, remainingTP: rem })
      }
      if (kept.length) next[uid] = kept
    }
    const newLogs: LogEntry[] = []
    if (expired.length) newLogs.push({ id: nextLogId(), kind: 'system', text: `effect 到期 ×${expired.length}：${expired.join('，')}` })
    set({
      activeEffects: next,
      log: [...newLogs, ...s.log].slice(0, 80),
      // D4 effect 到期 push：作为非阻塞 intercept 提示
      intercept: expired.length ? { title: `effect 到期 ×${expired.length}`, reasons: expired } : s.intercept,
    })
    return expired.length
  },
  pushSnapshot: (label) => {
    const s = get()
    snapshotId += 1
    const snap: Snapshot = {
      id: snapshotId,
      label,
      tokens: s.tokens.map((t) => ({ ...t })),
      vp: { ...s.vp },
      turn: { ...s.turn, operatives: { ...s.turn.operatives } },
      activeEffects: Object.fromEntries(Object.entries(s.activeEffects).map(([k, v]) => [k, v.map((e) => ({ ...e }))])),
    }
    set({ snapshots: [...s.snapshots, snap] })
  },
  rewindToSnapshot: (id) => {
    const s = get()
    const snap = s.snapshots.find((x) => x.id === id)
    if (!snap) return
    set((cur) => ({
      tokens: snap.tokens.map((t) => ({ ...t })),
      vp: { ...snap.vp },
      turn: { ...snap.turn, operatives: { ...snap.turn.operatives } },
      activeEffects: Object.fromEntries(Object.entries(snap.activeEffects).map(([k, v]) => [k, v.map((e) => ({ ...e }))])),
      lastShot: null,
      currentLog: null,
      snapshots: cur.snapshots.filter((x) => x.id < id), // 丢弃其后快照
      log: [{ id: nextLogId(), kind: 'system' as LogKind, text: `↶ 回退：<${snap.label}>` }, ...cur.log].slice(0, 80),
    }))
  },
  replayLast: () => {
    const r = get().replayLog
    if (r) set({ currentLog: r })
  },
  controlOf: (o) => {
    const tokens = get().tokens
    const nA = tokens.filter((t) => t.alive && t.placed && t.side === 'a' && Math.hypot(t.pos.x - o.pos.x, t.pos.y - o.pos.y) <= o.controlRange).length
    const nB = tokens.filter((t) => t.alive && t.placed && t.side === 'b' && Math.hypot(t.pos.x - o.pos.x, t.pos.y - o.pos.y) <= o.controlRange).length
    if (nA > nB && nA > 0) return 'a'
    if (nB > nA && nB > 0) return 'b'
    return null
  },
  setPushMsg: (pushMsg) => set({ pushMsg }),
  scoreAndEndTP: () => {
    // D4：先结算到期 effect（递减/移除/记日志/push），再计分推进
    get().tickEffects()
    const s = get() // tickEffects 已 set，重取最新
    get().pushSnapshot(`TP${s.turn.turningPoint} 计分`) // D3：计分前快照
    const map = s.mapPack
    let scoredA = s.vp.a
    let scoredB = s.vp.b
    const events: string[] = []
    if (map) {
      for (const o of map.objectives) {
        const ctrl = get().controlOf(o) // P7：读 store 当下 tokens
        if (ctrl === 'a') { scoredA++; events.push(`${o.id} → A`) }
        else if (ctrl === 'b') { scoredB++; events.push(`${o.id} → B`) }
      }
    }
    const next = turnReducer(s.turn, { type: 'END_TURNING_POINT' })
    const newLogs: LogEntry[] = []
    const gainedA = scoredA - s.vp.a
    const gainedB = scoredB - s.vp.b
    if (events.length) newLogs.push({ id: nextLogId(), kind: 'score' as LogKind, text: `TP${s.turn.turningPoint} 计分：${events.join('，')}（VP A:${scoredA} B:${scoredB}）` })
    const ended = next.phase === 'BATTLE_END'
    let winner: string | null = s.winner
    if (ended) {
      winner = scoredA > scoredB ? 'A 胜' : scoredB > scoredA ? 'B 胜' : '平局'
      newLogs.push({ id: nextLogId(), kind: 'system' as LogKind, text: `战斗结束 → ${winner}（VP A:${scoredA} B:${scoredB}）` })
    }
    // P11：TP 结束计分 push 文案
    const pushMsg = ended ? null : `TP${s.turn.turningPoint} 结束 — VP +${gainedA}/+${gainedB}（A:${scoredA} B:${scoredB}）`
    set({
      vp: { a: scoredA, b: scoredB },
      turn: ended ? next : { ...next, activePlayer: next.activePlayer === 'a' ? 'b' : 'a' },
      winner: ended ? winner : null,
      phase: ended ? 'ended' : s.phase,
      selected: null,
      pushMsg,
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
      activeEffects: {},
      snapshots: [],
      replayLog: null,
      pushMsg: null,
      winner: null,
      intercept: null,
    }),
}))

// ===== 选择器/派生（纯函数，组件用） =====
export function selectActivated(state: MatchState, uid: string | null): boolean {
  if (!uid) return false
  return Boolean(state.turn.operatives[uid]?.ready)
}
