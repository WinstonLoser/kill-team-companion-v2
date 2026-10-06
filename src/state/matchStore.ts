import { applyUnitRules, isAstartes } from '../rules/unitRules'
import { create, type UseBoundStore, type StoreApi } from 'zustand'
import type { Point, TerrainFeature, OperativePlacement, Board as BoardT } from '../geometry'
import { losFinding, engagementFinding, validateTarget, coverFinding, obscuredFinding } from '../geometry'
import type { ObjectiveMarker, MapPack } from '../data/maps'
import { createInitialTurnState, turnReducer, type TurnState, effectiveApl, effectiveMove, canDoAction, ACTION_AP, type ActionType } from './turnStateMachine'
import { runShooting, runMelee, buildShootingLog, buildMeleeLog, type ResolutionLog } from '../engine'
import { rollbackTo as logRollbackTo, stepBack as logStepBack } from '../engine'
import { ElectronicDiceSource, hashSeed, type DiceSource } from '../dice'
import type { FactionPack, Effect, OperativeStats, WeaponProfile, Operative, Weapon } from '../rules'
import type { PredicateContext } from '../rules/predicates'
import { resolveActivationEffects } from './activationResolver'
import { useAnimationStore } from './animationStore'
import { getAvatarUrl } from '../utils/avatars'
import { ALL_PACKS } from '../data/packs'
import { effectiveActionAp } from './turnStateMachine'
// 对局聚合状态（1.12-1.16 共享）。UI 只读写 store（AR-9）；引擎/几何/骰源由 store 调用。
const MATCH_PACK: FactionPack = ALL_PACKS[0]!

/** 行动中文名（日志/UI 用）。 */
const ACTION_LABEL_ZH: Record<ActionType, string> = {
  MOVE: '转移', DASH: '冲刺', FALL_BACK: '后撤', CHARGE: '冲锋', SHOOT: '射击', FIGHT: '近战',
}
// 多阵营注册表：统一来自 src/data/packs/index.ts，按 faction.id / opId 解析。
const PACKS: FactionPack[] = ALL_PACKS
export function packOfFaction(factionId: string): FactionPack {
  return PACKS.find((p) => p.faction.id === factionId) ?? MATCH_PACK
}
export function packOfOp(opId: string): FactionPack {
  return PACKS.find((p) => p.operatives.some((o) => o.operativeId === opId)) ?? MATCH_PACK
}
export function weaponOfPack(pack: FactionPack, kind: 'RANGED' | 'MELEE') {
  return pack.weapons.find((w) => w.kind === kind)
}
export function combatWeapon(uid: string, kind: 'RANGED' | 'MELEE'): Weapon | undefined {
  const data = getMatchOperativeData(uid)
  return data?.weapons.find(w => w.kind === kind && w.weaponId === data.token.chosenWeapons?.[kind]) ?? data?.weapons.find(w => w.kind === kind)
}
function heavyMoveRule(weapon: Weapon | undefined): 'DASH' | 'MOVE' | 'NONE' | undefined {
  const rule = weapon?.profile.weaponRules.find(item => /^Heavy(?:\s|$)/i.test(item))
  if (!rule) return undefined
  if (/Dash only/i.test(rule)) return 'DASH'
  if (/Reposition only/i.test(rule)) return 'MOVE'
  return 'NONE'
}
// P4：武器查找为可选（缺类不致导入期崩溃，多阵营安全）；结算时再 guard。
const RANGED = MATCH_PACK.weapons.find((w) => w.kind === 'RANGED')
const MELEE = MATCH_PACK.weapons.find((w) => w.kind === 'MELEE')
const DEFENDER_SAVE = 3
const DEFENDER_WEAPON_FALLBACK = MELEE ?? RANGED // 近战防御方也需武器；缺则降级
/** 攻击方阵营「常驻」effect（source 以 factionRule: 开头）：瘟疫毒素挂指示物 + 剧毒 +1 等。 */
function factionRuleEffectsFor(_opId: string, factionId: string): Effect[] {
  return packOfFaction(factionId).effects.filter((e) => e.source.startsWith('factionRule:'))
}

/** 
 * 读取当前对局中带 DM Overrides 的特工数据。
 * @returns 深度克隆并合并了 token.statOverrides 和 token.weaponOverrides 的 operative 和 weapons。
 */
export function getMatchOperativeData(uid: string): { operative: Operative; pack: FactionPack; weapons: Weapon[]; token: MatchToken } | null {
  const s = useMatchStore.getState()
  const token = s.tokens.find((t) => t.uid === uid)
  if (!token) return null
  
  const pack = packOfFaction(token.factionId)
  const baseOp = pack.operatives.find((o) => o.operativeId === token.opId)
  if (!baseOp) return null

  // Clone to avoid mutating global constants
  const op: Operative = structuredClone(baseOp)
  if (token.statOverrides) {
    op.stats = { ...op.stats, ...token.statOverrides }
  }

  // Clone weapons and apply overrides
  const weaponRefs = token.weapons ?? baseOp.loadouts.flatMap(slot => slot.options[0] ?? [])
  const weapons = weaponRefs
    .map((ref) => pack.weapons.find((w) => w.weaponId === ref))
    .filter((w): w is Weapon => Boolean(w))
    .map((w) => structuredClone(w))

  if (token.weaponOverrides) {
    for (const w of weapons) {
      if (token.weaponOverrides[w.weaponId]) {
        Object.assign(w.profile, token.weaponOverrides[w.weaponId])
      }
    }
  }

  if (token.enabledAbilityIds) op.abilityRefs = op.abilityRefs?.filter(id => token.enabledAbilityIds!.includes(id))
  applyUnitRules(op, weapons, token.selections ?? [], token.wounds, token.maxWounds)
  return { operative: op, pack, weapons, token }
}

/**
 * 全量 effect 栈构建（补齐 matchStore 接线）：
- factionRule: 阵营规则（常驻）
- chapterTactic/markOfChaos: roster 选择（双方各选）
- ability: 特工被动（常驻）
- wargear: 装备（常驻，v1 全装）
- stratagem: 仅 activeStratagams 列表内的
 */
function buildEffectStack(token: MatchToken, activeStratagems: string[]): Effect[] {
  const { opId, factionId } = token
  const pack = packOfFaction(factionId)
  const out: Effect[] = []
  for (const e of pack.effects) {
    const cat = e.source.split(':')[0]
    if (cat === 'factionRule') out.push(e)
    else if (cat === 'ability' && pack.operatives.find(o => o.operativeId === opId)?.abilityRefs?.includes(e.source.split(':')[1]!) && (!token.enabledAbilityIds || token.enabledAbilityIds.includes(e.source.split(':')[1]!))) out.push(e)
    else if (cat === 'chapterTactic' || cat === 'markOfChaos') {
      // Current pack descriptors predate current rule text; direct profile rules are applied per token.
      if (e.modifier.kind === 'CUSTOM_HOOK' && token.selections?.includes(e.effectId)) out.push(e)
    }
    else if (cat === 'stratagem') {
      if (activeStratagems.includes(e.effectId)) out.push(e)
    }
  }
  return out
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

export type Phase = 'map-select' | 'deploy' | 'strategy' | 'play' | 'ended'
export type Side = 'a' | 'b'
export type DiceSourceKind = 'electronic' | 'manual'

export interface MatchToken {
  uid: string
  side: Side
  factionId: string
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
  /** 命令（部署即隐匿 D-部署规则；激活时再选交战/隐匿）。 */
  order: 'CONCEAL' | 'ENGAGE'
  /** 该特工配备的武器ID列表（自 Roster 导入） */
  weapons: string[]
  chosenWeapons?: Partial<Record<'RANGED' | 'MELEE', string>>
  selections?: string[]
  enabledAbilityIds?: string[]
  boonWeaponTarget?: string
  teamWargearIds?: string[]
  /** 运行时数据覆写：基础属性修改（DM Mode） */
  statOverrides?: Partial<OperativeStats>
  /** 运行时数据覆写：武器属性修改（DM Mode）Record<weaponId, Partial<WeaponProfile>> */
  weaponOverrides?: Record<string, Partial<WeaponProfile>>
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
  flow?: Pick<MatchState, "phase" | "initiative" | "strategyTurn" | "strategyPasses" | "activeStratagems" | "usedPloys" | "reactionUid" | "reacted" | "previousInitiative" | "winner">
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
  kind: 'SHOOT' | 'MELEE'
  attackerWoundsDealt?: number
  atkNats?: number[]
  defNats?: number[]
  atkRolls?: { nat: number, grade: 'FAIL' | 'NORMAL' | 'CRITICAL' | string }[]
  defRolls?: { nat: number, grade: 'FAIL' | 'NORMAL' | 'CRITICAL' | string }[]
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
  /** 4-1 视口变换（缩放/平移）。 */
  viewport: { scale: number; offsetX: number; offsetY: number }
  /** 4-1 用户正在交互（拖特工/缩放/平移）→ overlay 延迟计算。 */
  interacting: boolean
  /** 当前激活的计谋 effectId（按方）。 */
  activeStratagems: { a: string[]; b: string[] }
  diceSource: DiceSourceKind
  /** D-24 咨询式翻转：key=`${aUid}>${tUid}>${kind}` → 玩家终裁 finalValue。 */
  overrides: Record<string, boolean | string | number>
  /** D4：特工身上的限时 effect（uid → 列表）。 */
  activeEffects: Record<string, ActiveEffect[]>
  /** D3：会话内回退快照栈（确认/计分前 push）。 */
  snapshots: Snapshot[]
  /** D3：最近一次已确认结算的 ResolutionLog，供日志 ▶回放重展。 */
  replayLog: ResolutionLog | null
  winner: string | null
  intercept: { title: string; reasons: string[] } | null
  /** 6.1 战略阶段：先手权方 */
  initiative: 'a' | 'b' | null
  /** 部署前先手权（随机掷骰定，驱动部署顺序；与每 TP 战略先手区分）。null=未掷 */
  deployInitiative: 'a' | 'b' | null
  /** 部署先手骰结果（展示用）。 */
  deployDice: { a: number; b: number } | null
  /** 部署先手骰重掷计数（每次点击 +1，使结果变化）。 */
  deployRollNonce: number
  /** 6.1 战略阶段：双方是否已跳过（连续两次跳过 → 进交战） */
  strategyPasses: { a: boolean; b: boolean }
  /** 6.1 战略阶段：当前轮到谁使用计谋 */
  strategyTurn: 'a' | 'b' | null
  /** 6.1 战略阶段：最近一次使用计谋前的快照（一级回退，防误点） */
  lastPloy: { cp: { a: number; b: number }; strategyTurn: 'a' | 'b'; strategyPasses: { a: boolean; b: boolean }; activeStratagems: { a: string[]; b: string[] } } | null
  /** 激活期逐步回退栈：每次 doAction 前压栈，undoAction 弹栈恢复（AP/行动记录/位置）。激活结束清空。 */
  activationUndo: { uid: string; apUsed: number; actionsThisActivation: ActionType[]; fallBackDone: boolean; chargeDone: boolean; moveDone: boolean; heavyMoveRule?: 'DASH' | 'MOVE' | 'NONE'; pos: Point; tokens: MatchToken[] }[]
  /** 简化对局模式（无地图、跳过部署、自动隐蔽、手动选择目标/掩体） */
  maplessMode?: boolean

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
  /** 仅重置部署：所有 token 取消放置 + 清部署先手，保留地图与 token 阵容。 */
  resetDeploy: () => void
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
  /** 4-1：设视口（scale/offset）。 */
  setViewport: (vp: { scale: number; offsetX: number; offsetY: number }) => void
  /** 4-1：以屏幕点 (cx,cy) 为锚缩放 delta 倍。 */
  zoomAt: (delta: number, cx: number, cy: number) => void
  /** 4-1：平移 dx,dy 像素。 */
  panBy: (dx: number, dy: number) => void
  /** 4-1：交互态（拖/缩/平移期间 overlay 延迟）。 */
  setInteracting: (v: boolean) => void
  /** 切换计谋激活状态。 */
  toggleStratagem: (side: Side, effectId: string) => void
  /** 6.1：进入战略阶段（部署后 → 战略） */
  enterStrategy: () => void
  /** 部署前掷先手权（按钮触发，即时出结果；动画后续补）。 */
  rollDeployInitiative: () => { a: number; b: number; winner: 'a' | 'b' }
  /** 6.1：掷 D6 定先手权（仅返回结果不生效，UI 负责动画及让胜者选择） */
  rollInitiative: () => { a: number; b: number; winner: 'a' | 'b' }
  confirmInitiative: (side: 'a' | 'b') => void
  /** 6.1：战略阶段使用计谋（花 CP）或跳过 */
  strategyAct: (side: Side, action: 'ploy' | 'pass') => void
  /** 6.1：撤销最近一次战略计谋（恢复 CP/回合/激活态） */
  strategyUndo: () => void
  /** D-24：设置某项 finding 的玩家终裁值（key 不存在则用引擎值）。 */
  setOverride: (key: string, value: boolean | string | number) => void
  clearOverride: (key: string) => void
  /** 取某对 (attacker,target) 的 findingOverrides，注入 validateTarget。 */
  findingOverridesFor: (aUid: string, tUid: string) => { kind: 'LOS' | 'COVER' | 'OBSCURED' | 'RANGE' | 'ENGAGEMENT'; finalValue: boolean }[]
  /** D-24：读某项 finding 的玩家终裁值（无则 undefined=用引擎值）。 */
  overrideValue: (aUid: string, tUid: string, kind: string) => boolean | string | number | undefined
  setIntercept: (i: { title: string; reasons: string[] } | null) => void
  pushLog: (kind: LogKind, text: string) => void
  setLogFilter: (f: LogKind | 'all') => void
  // DM 模式数据覆写
  setTokenOverrides: (uid: string, statOverrides?: Partial<OperativeStats>, weaponOverrides?: Record<string, Partial<WeaponProfile>>) => void
  setTokenState: (uid: string, state: Partial<MatchToken>) => void
  swapOperativeClass: (uid: string, newOpId: string) => void
  setTokenWeapons: (uid: string, weaponIds: string[]) => void
  setResource: (side: 'a' | 'b', type: 'cp' | 'vp', delta: number) => void
  reactionUid: string | null
  reacted: string[]
  previousInitiative: Side | null
  usedPloys: Record<string, number>
  usePloy: (side: Side, id: string) => { ok: boolean; reason?: string }
  canEndTP: () => { ok: boolean; reason?: string }
  canReact: (uid: string) => boolean
  react: (uid: string) => void
  passOpportunity: () => void
  setCombatWeapon: (uid: string, kind: 'RANGED' | 'MELEE', weaponId: string) => void
  activate: (uid: string, side: Side) => void
  endActivation: (uid: string) => void
  /** 激活时选命令（交战/隐匿）。 */
  selectOrder: (uid: string, order: 'ENGAGED' | 'CONCEALED') => void
  /** 执行一个行动（先 checkAction 校验，通过则 commit AP+记录）。 */
  doAction: (uid: string, action: ActionType) => { ok: boolean; reason?: string }
  /** 撤销当前激活特工的最近一个行动（恢复 AP/行动记录/位置）。 */
  undoAction: () => void
  /** 查特工有效 APL（base + effects）。 */
  effectiveAplOf: (uid: string) => number
  actionCostOf: (uid: string, action: ActionType) => number
  /** 查特工有效移动距离（base + effects）。 */
  effectiveMoveOf: (uid: string) => number
  /** 检查行动合法性（AP/约束），返回 {ok, reason}。 */
  checkAction: (uid: string, action: ActionType) => { ok: boolean; reason?: string }
  /** AR-9 intent：一击结算。UI 只 dispatch 此（+ confirmCasualties），不直接调引擎。 */
  /** 执行前校验攻击合法性（距离、LOS等），用于 UI 前置拦截 */
  checkAttackLegality: (input: { attackerUid: string; targetUid: string; kind: 'SHOOT' | 'MELEE' }) => { ok: boolean; missing?: string[] }
  resolveAttack: (input: {
    attackerUid: string
    targetUid: string
    kind: 'SHOOT' | 'MELEE'
    atkNats?: number[]
    defNats?: number[]
    atkRolls?: { nat: number, grade: 'FAIL' | 'NORMAL' | 'CRITICAL' | string }[]
    defRolls?: { nat: number, grade: 'FAIL' | 'NORMAL' | 'CRITICAL' | string }[]
    manualAllocation?: { atkStrike: { normal: number, critical: number }, defStrike: { normal: number, critical: number } }
  }) => { ok: boolean; missing?: string[] }
  /** 唯一强制确认：应用伤亡（单一数据源=store），清 lastShot/currentLog。 */
  confirmCasualties: (overrides?: {
    targetWoundsDealt?: number
    attackerWoundsDealt?: number
    targetMarkers?: string[]
    attackerMarkers?: string[]
  }) => void
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
  setMaplessMode: (m: boolean) => void
}

let logId = 0
function nextLogId(): number {
  logId += 1
  return logId
}
let snapshotId = 0

export const useMatchStore: UseBoundStore<StoreApi<MatchState>> = create<MatchState>((set, get) => ({
  reactionUid: null, reacted: [], previousInitiative: null, usedPloys: {},
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
  viewport: { scale: 1, offsetX: 0, offsetY: 0 },
  interacting: false,
  activeStratagems: { a: [], b: [] },
  diceSource: 'electronic',
  overrides: {},
  activeEffects: {},
  snapshots: [],
  replayLog: null,
  pushMsg: null,
  winner: null,
  intercept: null,
  initiative: null,
  deployInitiative: null,
  deployDice: null,
  deployRollNonce: 0,
  strategyPasses: { a: false, b: false },
  strategyTurn: null,
  lastPloy: null,
  activationUndo: [],
  maplessMode: false,

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
  resetDeploy: () =>
    set((s) => ({
      tokens: s.tokens.map((t) => ({ ...t, placed: false, pos: { x: -1, y: -1 }, facing: 0 })),
      deployInitiative: null,
      deployDice: null,
      deployRollNonce: 0,
      intercept: null,
      log: [{ id: nextLogId(), kind: 'system' as LogKind, text: '部署已重置（地图保留）' }, ...s.log],
    })),
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
  setViewport: (viewport) => set({ viewport }),
  zoomAt: (delta, cx, cy) => set((s) => {
    const { scale, offsetX, offsetY } = s.viewport
    const newScale = Math.max(0.5, Math.min(3, scale * delta))
    // P5：scale 未变（clamp 边界）→ 不改 offset，避免漂移
    if (newScale === scale) return {}
    const worldX = (cx - offsetX) / scale
    const worldY = (cy - offsetY) / scale
    return { viewport: { scale: newScale, offsetX: cx - worldX * newScale, offsetY: cy - worldY * newScale } }
  }),
  panBy: (dx, dy) => set((s) => ({ viewport: { ...s.viewport, offsetX: s.viewport.offsetX + dx, offsetY: s.viewport.offsetY + dy } })),
  setInteracting: (interacting) => set({ interacting }),
  // ===== 部署前先手权（按钮触发，即时出结果） =====
  rollDeployInitiative: () => {
    const nonce = get().deployRollNonce + 1
    const dice = new ElectronicDiceSource(hashSeed('DEPLOY_INITIATIVE', 'D6', nonce))
    const a = dice.roll(1)[0]!.nat
    const b = dice.roll(1)[0]!.nat
    const winner: 'a' | 'b' = a === b ? (dice.roll(1)[0]!.nat <= 3 ? 'a' : 'b') : a > b ? 'a' : 'b'
    set((s) => ({
      deployInitiative: winner,
      deployDice: { a, b },
      deployRollNonce: nonce,
      log: [{ id: nextLogId(), kind: 'system' as LogKind, text: `部署先手 D6：A=${a} B=${b} → ${winner.toUpperCase()} 方先部署` }, ...s.log],
    }))
    return { a, b, winner }
  },

  // ===== 6.1 战略阶段 =====
  enterStrategy: () => {
    const s = get()
    // 全员就绪
    if (s.phase !== 'deploy' && s.phase !== 'map-select') return
    const turn = turnReducer(s.turn, { type: 'START_BATTLE' })
    for (const t of s.tokens) turn.operatives[t.uid] = { order: t.order === 'ENGAGE' ? 'ENGAGED' : 'CONCEALED', ready: true, apUsed: 0, actionsThisActivation: [], fallBackDone: false, chargeDone: false, moveDone: false }
    set({ phase: 'strategy', turn, initiative: null, strategyPasses: { a: false, b: false }, strategyTurn: null })
    s.pushLog('system', `转折点 ${turn.turningPoint} 战略阶段开始 — 掷 D6 定先手权`)
  },
  rollInitiative: () => {
    let a = 0, b = 0
    const dice = new ElectronicDiceSource(hashSeed('INITIATIVE', 'D6', get().turn.turningPoint + Math.random()))
    {
      a = dice.roll(1)[0]!.nat
      b = dice.roll(1)[0]!.nat
    }
    const previous = get().previousInitiative ?? get().deployInitiative ?? 'a'
    const winner: Side = a === b ? (previous === 'a' ? 'b' : 'a') : a > b ? 'a' : 'b'
    get().pushLog('system', `先手权争夺：A 掷 ${a}, B 掷 ${b}。${winner.toUpperCase()} 胜出。`)
    return { a, b, winner }
  },
  confirmInitiative: (side: 'a' | 'b') => {
    // CP 发放：首 TP 各 +1（START_BATTLE 已给 3/3）；后续先手+1 非先手+2
    const s = get()
    if (s.phase !== 'strategy' || s.initiative) return
    const tp = s.turn.turningPoint
    let cpA = s.turn.cp.a, cpB = s.turn.cp.b
    if (tp === 1) { cpA += 1; cpB += 1 }
    else { if (side === 'a') { cpA += 1; cpB += 2 } else { cpA += 2; cpB += 1 } }
    
    set((st) => ({
      initiative: side,
      strategyTurn: side,
      strategyPasses: { a: false, b: false },
      turn: { ...st.turn, cp: { a: cpA, b: cpB }, activePlayer: side },
      log: [{ id: nextLogId(), kind: 'system' as LogKind, text: `${side.toUpperCase()} 方决定先手；CP A:${cpA} B:${cpB}` }, ...st.log],
    }))
  },
  strategyAct: (side, action) => {
    const s = get()
    if (action === 'ploy') {
      // 花 1CP
      const cp = { ...s.turn.cp, [side]: Math.max(0, s.turn.cp[side] - 1) }
      const next = side === 'a' ? 'b' : 'a'
      // 回退快照（防误点）：记下消费前的 CP/回合/跳过/激活态
      const lastPloy = { cp: s.turn.cp, strategyTurn: side, strategyPasses: { ...s.strategyPasses }, activeStratagems: { a: [...s.activeStratagems.a], b: [...s.activeStratagems.b] } }
      set({ turn: { ...s.turn, cp }, strategyTurn: next, strategyPasses: { a: false, b: false }, lastPloy })
      s.pushLog('ploy', `${side.toUpperCase()} 方使用战略计谋（−1CP）`)
    } else {
      // 跳过
      const passes = { ...s.strategyPasses, [side]: true }
      const next = side === 'a' ? 'b' : 'a'
      const bothPassed = passes.a && passes.b
      if (bothPassed) {
        // 连续两次跳过 → 进入交战阶段
        set({ phase: 'play', strategyPasses: passes, strategyTurn: null, lastPloy: null, turn: { ...s.turn, phase: 'ENGAGEMENT' } })
        s.pushLog('system', `战略阶段结束 → 进入交战阶段（${s.initiative?.toUpperCase()} 方先激活）`)
      } else {
        set({ strategyPasses: passes, strategyTurn: next })
        s.pushLog('system', `${side.toUpperCase()} 方跳过战略计谋`)
      }
    }
  },
  strategyUndo: () => {
    const s = get()
    const lp = s.lastPloy
    if (!lp) return
    set({
      turn: { ...s.turn, cp: lp.cp },
      strategyTurn: lp.strategyTurn,
      strategyPasses: lp.strategyPasses,
      activeStratagems: lp.activeStratagems,
      lastPloy: null,
      log: [{ id: nextLogId(), kind: 'system' as LogKind, text: '已撤销最近一次战略计谋' }, ...s.log],
    })
  },
  toggleStratagem: (side, effectId) =>
    set((s) => {
      const cur = s.activeStratagems[side]
      const next = cur.includes(effectId) ? cur.filter((x) => x !== effectId) : [...cur, effectId]
      return { activeStratagems: { ...s.activeStratagems, [side]: next } }
    }),
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
      .filter((k) => k.startsWith(`${aUid}>${tUid}>`) && ['LOS','COVER','OBSCURED','RANGE','ENGAGEMENT'].includes(k.split('>')[2]!) && typeof ov[k] === 'boolean')
      .map((k) => {
        const kind = k.split('>')[2] as 'LOS' | 'COVER' | 'OBSCURED' | 'RANGE' | 'ENGAGEMENT'
        return { kind, finalValue: ov[k] === true }
      })
  },
overrideValue: (aUid, tUid, kind) => get().overrides[overrideKey(aUid, tUid, kind)],
  setIntercept: (intercept) => set({ intercept }),
  pushLog: (kind, text) =>
    set((s) => ({ log: [{ id: nextLogId(), kind, text }, ...s.log] })),
  setLogFilter: (logFilter) => set({ logFilter }),
  // DM 数据修改
  setTokenOverrides: (uid, statOverrides, weaponOverrides) => set((s) => {
    const next = [...s.tokens]
    const idx = next.findIndex(t => t.uid === uid)
    if (idx < 0) return {}
    next[idx] = { ...next[idx]!, statOverrides, weaponOverrides }
    return { tokens: next }
  }),
  // DM 数据修改: 直接修改当前血量与状态指示物
  setTokenState: (uid, state) => set((s) => {
    const next = [...s.tokens]
    const idx = next.findIndex(t => t.uid === uid)
    if (idx < 0) return {}
    next[idx] = { ...next[idx]!, ...state }
    return { tokens: next }
  }),
  swapOperativeClass: (uid, newOpId) => set((s) => {
    const next = [...s.tokens]
    const idx = next.findIndex(t => t.uid === uid)
    if (idx < 0) return {}
    const t = next[idx]!
    const pack = packOfFaction(t.factionId)
    const baseOp = pack.operatives.find(o => o.operativeId === newOpId)
    if (!baseOp) return {}
    next[idx] = {
      ...t,
      opId: newOpId,
      name: baseOp.name,
      maxWounds: baseOp.stats.wounds,
      wounds: Math.max(0, baseOp.stats.wounds - (t.maxWounds - t.wounds)),
      baseRadius: baseOp.base.diameterMm / 2 / 25.4,
      statOverrides: undefined,
      weaponOverrides: undefined,
      weapons: baseOp.loadouts.flatMap(slot => slot.options[0] ?? [])
    }
    return { tokens: next }
  }),
  setTokenWeapons: (uid, weaponIds) => set((s) => {
    const next = [...s.tokens]
    const idx = next.findIndex(t => t.uid === uid)
    if (idx < 0) return {}
    next[idx] = { ...next[idx]!, weapons: weaponIds }
    return { tokens: next }
  }),
  setResource: (side, type, delta) => set((s) => {
    if (type === 'vp') {
      return { vp: { ...s.vp, [side]: Math.max(0, s.vp[side] + delta) } }
    } else {
      const currentCp = s.turn.cp[side] || 0
      return { turn: { ...s.turn, cp: { ...s.turn.cp, [side]: Math.max(0, currentCp + delta) } } }
    }
  }),
  setCombatWeapon: (uid, kind, weaponId) => {
    const data = getMatchOperativeData(uid)
    if (!data?.weapons.some(w => w.weaponId === weaponId && w.kind === kind) || get().lastShot) return
    set(s => ({ tokens: s.tokens.map(t => t.uid === uid ? { ...t, chosenWeapons: { ...t.chosenWeapons, [kind]: weaponId } } : t) }))
  },
  canEndTP: () => {
    const s = get()
    if (s.phase !== 'play') return { ok: false, reason: '请先完成战略阶段；已结束的战斗不能重复计分' }
    if (s.lastShot || s.turn.activeOpId || s.dragging) return { ok: false, reason: '请先确认伤亡并结束当前激活或反应' }
    const ready = s.tokens.filter(t => t.alive && t.placed && s.turn.operatives[t.uid]?.ready !== false)
    if (ready.length) return { ok: false, reason: `还有 ${ready.length} 名特工未激活` }
    return { ok: true }
  },
  usePloy: (side, id) => {
    const s = get()
    const token = s.tokens.find(t => t.side === side)
    const pack = token ? packOfFaction(token.factionId) : null
    const ploy = pack?.stratagems?.find(p => p.id === id)
    if (!ploy || !pack || s.phase === 'ended') return { ok: false, reason: '没有可用计谋' }
    if ((ploy.phase === 'STRATEGY' && (s.phase !== 'strategy' || s.strategyTurn !== side)) || (ploy.phase === 'ENGAGEMENT' && s.phase !== 'play')) return { ok: false, reason: '当前不是该计谋的使用阶段' }
    const tpKey = `${side}:${id}:tp${s.turn.turningPoint}`
    const battleKey = `${side}:${id}:battle`
    if ((s.usedPloys[tpKey] ?? 0) >= (ploy.useLimit.perTurningPoint ?? 1) || (s.usedPloys[battleKey] ?? 0) >= (ploy.useLimit.perBattle ?? Infinity)) return { ok: false, reason: '本计谋已达使用上限' }
    if (s.turn.cp[side] < ploy.cp) return { ok: false, reason: 'CP 不足' }
    const eids = pack.effects.filter(e => e.source === `stratagem:${id}`).map(e => e.effectId)
    set({
      turn: { ...s.turn, cp: { ...s.turn.cp, [side]: s.turn.cp[side] - ploy.cp } },
      usedPloys: { ...s.usedPloys, [tpKey]: (s.usedPloys[tpKey] ?? 0) + 1, [battleKey]: (s.usedPloys[battleKey] ?? 0) + 1 },
      activeStratagems: { ...s.activeStratagems, [side]: [...new Set([...s.activeStratagems[side], ...eids])] },
      strategyTurn: ploy.phase === 'STRATEGY' ? (side === 'a' ? 'b' : 'a') : s.strategyTurn,
      strategyPasses: ploy.phase === 'STRATEGY' ? { a: false, b: false } : s.strategyPasses,
      lastPloy: null,
    })
    get().pushLog('ploy', `${side.toUpperCase()} 使用 ${ploy.name}（−${ploy.cp} CP）；${ploy.description ?? '按卡面处理对象与效果'}`)
    return { ok: true }
  },
  canReact: (uid) => {
    const s = get()
    const t = s.tokens.find(t => t.uid === uid)
    if (!t || !t.alive || !t.placed || s.phase !== 'play' || s.turn.activeOpId || s.lastShot || s.reacted.includes(uid) || t.side !== s.turn.activePlayer) return false
    if (s.tokens.some(x => x.side === t.side && x.alive && s.turn.operatives[x.uid]?.ready !== false)) return false
    if (!s.tokens.some(x => x.side !== t.side && x.alive && s.turn.operatives[x.uid]?.ready !== false)) return false
    const data = getMatchOperativeData(uid)
    return s.turn.operatives[uid]?.order === 'ENGAGED' || !!data && isAstartes(data.operative)
  },
  react: (uid) => {
    if (!get().canReact(uid)) return
    const s = get()
    const t = s.tokens.find(t => t.uid === uid)!
    const turn = turnReducer(s.turn, { type: 'ACTIVATE', opId: uid, player: t.side })
    set({ turn, reactionUid: uid, reacted: [...s.reacted, uid], selected: uid, activationUndo: [] })
    get().pushLog('turn', `${t.name} 反应：免费执行一个1AP行动，移动最多2英寸`)
  },
  passOpportunity: () => {
    const s = get()
    if (s.phase !== 'play' || s.turn.activeOpId || s.lastShot) return
    if (s.tokens.some(t => t.alive && t.side === s.turn.activePlayer && s.turn.operatives[t.uid]?.ready !== false)) return
    set({ turn: { ...s.turn, activePlayer: s.turn.activePlayer === 'a' ? 'b' : 'a' }, selected: null })
    get().pushLog('turn', `${s.turn.activePlayer.toUpperCase()} 放弃本次反应机会`)
  },
  // P5：activate 只 dispatch，由 reducer 自包含 upsert ready:true（不再手填 operatives）。
  activate: (uid, side) => {
    const before = get()
    const candidate = before.tokens.find(t => t.uid === uid)
    if (!candidate?.alive || !candidate.placed || before.phase !== 'play' || before.turn.activeOpId || before.lastShot || side !== before.turn.activePlayer || candidate.side !== side || before.turn.operatives[uid]?.ready === false) return
    set((s) => ({ turn: turnReducer(s.turn, { type: 'ACTIVATE', opId: uid, player: side }), activationUndo: [] }))
    const poison = candidate.markers.filter(m => m.startsWith('POISON:') || m === 'POISON').length
    if (poison) { get().applyDamage(uid, poison); get().pushLog('turn', `${candidate.name} 毒素造成 ${poison} 伤害`) }
    if (!get().tokens.find(t => t.uid === uid)?.alive) { get().endActivation(uid); return }
    // 5-6 mucus_exit：激活期 effect resolver（排毒口 D3=3 挂 POISON / D3 伤）
    const s = get()
    const activator = s.tokens.find((t) => t.uid === uid)
    if (!activator) return
    // 找持激活期 wargear effect 的对手方特工
    const holders = s.tokens
      .filter((t) => t.alive && t.placed && t.side !== side)
      .map((t) => {
        const effects = factionRuleEffectsFor(t.opId, t.factionId)
        return { uid: t.uid, pos: t.pos, side: t.side, effects }
      })
      .filter((h) => h.effects.length > 0)
    if (holders.length === 0) return
    const aResult = resolveActivationEffects({
      activatorUid: uid,
      activatorPos: activator.pos,
      activatorMarkers: activator.markers,
      holders,
      turningPoint: s.turn.turningPoint,
    })
    // 应用结果到 tokens
    if (aResult.markersGranted.length || aResult.damageDealt.length) {
      set((st) => ({
        tokens: st.tokens.map((t) => {
          const marks = aResult.markersGranted.filter((m) => m.targetUid === t.uid)
          const dmgs = aResult.damageDealt.filter((d) => d.targetUid === t.uid)
          if (marks.length === 0 && dmgs.length === 0) return t
          const newMarkers = marks.length ? [...t.markers, ...marks.map((m) => m.marker)] : t.markers
          const newWounds = dmgs.length ? Math.max(0, t.wounds - dmgs.reduce((s2, d) => s2 + d.amount, 0)) : t.wounds
          return { ...t, markers: newMarkers, wounds: newWounds, alive: newWounds > 0 }
        }),
        log: aResult.trace.length
          ? [{ id: nextLogId(), kind: 'system' as LogKind, text: `激活效果：${aResult.trace.map((tr) => tr.detail).join('; ')}` }, ...st.log]
          : st.log,
      }))
    }
  },
  endActivation: (uid) => {
    const s = get()
    if (s.turn.activeOpId !== uid || s.lastShot) return
    set({ turn: turnReducer(s.turn, { type: 'END_ACTIVATION', opId: uid }), activationUndo: [], reactionUid: null })
  },
  selectOrder: (uid, order) => {
    if (get().reactionUid || get().lastShot || get().turn.operatives[uid]?.apUsed) return
    set((s) => ({ turn: turnReducer(s.turn, { type: 'SELECT_ORDER', opId: uid, order }) }))
    set(s => ({ tokens: s.tokens.map(t => t.uid === uid ? { ...t, order: order === 'ENGAGED' ? 'ENGAGE' : 'CONCEAL' } : t) }))
    get().pushLog('turn', `${get().tokens.find((t) => t.uid === uid)?.name ?? uid} 选命令：${order === 'ENGAGED' ? '交战' : '隐匿'}`)
  },
  doAction: (uid, action) => {
    const chk = get().checkAction(uid, action)
    if (!chk.ok) return chk
    const s = get()
    const op = s.turn.operatives[uid]
    const tok = s.tokens.find((t) => t.uid === uid)
    // 逐步回退栈：压入 commit 前状态
    const undo = op && tok
      ? [...s.activationUndo, { uid, apUsed: op.apUsed, actionsThisActivation: [...op.actionsThisActivation], fallBackDone: op.fallBackDone, chargeDone: op.chargeDone, moveDone: op.moveDone, heavyMoveRule: op.heavyMoveRule, pos: tok.pos, tokens: structuredClone(s.tokens) }]
      : s.activationUndo
    set({ turn: turnReducer(s.turn, { type: 'DO_ACTION', opId: uid, action, apCost: get().actionCostOf(uid, action), heavyMoveRule: action === 'SHOOT' ? heavyMoveRule(combatWeapon(uid, 'RANGED')) : undefined }), activationUndo: undo })
    s.pushLog('turn', `${s.tokens.find((t) => t.uid === uid)?.name ?? uid} → ${ACTION_LABEL_ZH[action] ?? action}（−${s.actionCostOf(uid, action)}AP）`)
    return { ok: true }
  },
  undoAction: () => {
    const s = get()
    const last = s.activationUndo[s.activationUndo.length - 1]
    if (!last) return
    const op = s.turn.operatives[last.uid]
    set({
      turn: op ? { ...s.turn, operatives: { ...s.turn.operatives, [last.uid]: { ...op, apUsed: last.apUsed, actionsThisActivation: [...last.actionsThisActivation], fallBackDone: last.fallBackDone, chargeDone: last.chargeDone, moveDone: last.moveDone, heavyMoveRule: last.heavyMoveRule } } } : s.turn,
      tokens: structuredClone(last.tokens),
      lastShot: null, currentLog: null,
      activationUndo: s.activationUndo.slice(0, -1),
      log: [{ id: nextLogId(), kind: 'turn' as LogKind, text: `↶ 撤销 ${s.tokens.find((t) => t.uid === last.uid)?.name ?? ''} 上一步行动` }, ...s.log],
    })
  },
  effectiveAplOf: (uid) => {
    if (get().reactionUid === uid) return 1
    const s = get()
    const dmData = getMatchOperativeData(uid)
    if (!dmData) return 0
    const { operative, token: t } = dmData
    const baseApl = operative.stats.apl ?? 3
    const effects = buildEffectStack(t, s.activeStratagems[t.side])
    return t.selections?.includes('chapterTactic_resolute') ? baseApl : effectiveApl(baseApl, effects)
  },
  effectiveMoveOf: (uid) => {
    if (get().reactionUid === uid) return 2
    const s = get()
    const dmData = getMatchOperativeData(uid)
    if (!dmData) return 0
    const { operative, token: t } = dmData
    const baseMove = operative.stats.move ?? 6
    const effects = buildEffectStack(t, s.activeStratagems[t.side])
    return effectiveMove(baseMove, effects)
  },
  actionCostOf: (uid, action) => {
    const s = get()
    if (s.reactionUid === uid) return 1
    const t = s.tokens.find(t => t.uid === uid)
    if (!t) return ACTION_AP[action]
    if (action === 'FALL_BACK' && t.selections?.includes('chapterTactic_mobile')) return 1
    return effectiveActionAp(action, ACTION_AP[action], buildEffectStack(t, s.activeStratagems[t.side]))
  },
  checkAction: (uid, action) => {
    const s = get()
    const op = s.turn.operatives[uid]
    if (!op || !op.ready || s.phase !== 'play' || s.turn.activeOpId !== uid || s.lastShot) return { ok: false, reason: '请先完成当前结算并激活该特工' }
    const t = s.tokens.find((x) => x.uid === uid)
    if (!t?.alive || t.side !== s.turn.activePlayer) return { ok: false, reason: '该特工不能行动' }
    const pack = packOfFaction(t.factionId)
    const opData = pack.operatives.find((o) => o.operativeId === t.opId)
    const apl = s.effectiveAplOf(uid)
    // effectiveActionAp 已在 canDoAction 内消费（ACTION_AP_MOD delta → ACTION_AP 调整）
    const astartes = opData ? isAstartes(opData) : false
    if (s.reactionUid === uid && (ACTION_AP[action] !== 1 || op.actionsThisActivation.length > 0)) return { ok: false, reason: '反应仅允许一个原费用为1AP的行动' }
    const ranged = combatWeapon(uid, 'RANGED')
    const moving = action === 'MOVE' || action === 'DASH' || action === 'FALL_BACK' || action === 'CHARGE'
    if (moving && op.heavyMoveRule && action !== op.heavyMoveRule) return { ok: false, reason: '本次激活已使用重型武器，不能执行此移动' }
    if (action === 'SHOOT') {
      const permitted = heavyMoveRule(ranged)
      if (permitted && op.actionsThisActivation.some(previous => (previous === 'MOVE' || previous === 'DASH' || previous === 'FALL_BACK' || previous === 'CHARGE') && previous !== permitted)) return { ok: false, reason: '此前移动与当前重型武器不兼容' }
    }
    const extra = { actionCost: s.actionCostOf(uid, action), quiet: !!ranged?.profile.weaponRules.some(r => /silent|quiet/i.test(r)), chargeInEngagement: t.selections?.includes('chapterTactic_mobile') }
    
    // 简化对局模式下，跳过物理距离的交战检查，假设条件满足（由玩家手动判定）
    if (s.maplessMode) {
      return canDoAction(s.turn, uid, action, {
        ...extra,
        apl,
        isAstartes: astartes,
        inEngagementRange: action === 'FIGHT' || action === 'FALL_BACK', // 若是近战/后撤则当做交战中
        enemyInEngagement: action === 'FIGHT' || action === 'FALL_BACK', 
      })
    }

    // 1" 控制范围内是否有敌方（驱动 FALL_BACK/SHOOT/FIGHT 门控）
    const inEng = s.tokens.some(
      (e) => e.alive && e.placed && e.side !== t.side &&
        Math.hypot(e.pos.x - t.pos.x, e.pos.y - t.pos.y) <= t.baseRadius + e.baseRadius + 1,
    )
    return canDoAction(s.turn, uid, action, {
      ...extra,
      apl,
      isAstartes: astartes,
      inEngagementRange: inEng,
      enemyInEngagement: inEng,
    })
  },
  // ===== AR-9 intent：一击结算（引擎/几何/骰源在 store 内，UI 只 dispatch）=====
  checkAttackLegality: ({ attackerUid, targetUid, kind }) => {
    const s = get()
    if (s.maplessMode) {
      const a = s.tokens.find(t => t.uid === attackerUid); const d = s.tokens.find(t => t.uid === targetUid)
      return a?.alive && d?.alive && a.side !== d.side && combatWeapon(attackerUid, kind === 'SHOOT' ? 'RANGED' : 'MELEE') ? { ok: true } : { ok: false, missing: ['请选择存活敌人及已装备武器'] }
    }
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
    
    const atkRanged = combatWeapon(attacker.uid, 'RANGED')
    const findingOverrides = get().findingOverridesFor(attacker.uid, target.uid)
    
    const elig = validateTarget(aPl, dPl, atkRanged?.profile.range ?? Math.hypot(map.bounds.w, map.bounds.h), board, others, { findingOverrides, kind, targetOrder: target.order === 'CONCEAL' ? 'CONCEALED' : 'ENGAGED', friendlyPositions: s.tokens.filter(t => t.alive && t.placed && t.side === attacker.side && t.uid !== attacker.uid).map(t => t.pos) })
    return { ok: elig.ok, missing: elig.missing }
  },
  resolveAttack: ({ attackerUid, targetUid, kind, atkNats, defNats, atkRolls, defRolls, manualAllocation }) => {
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

    const atkDmData = getMatchOperativeData(attacker.uid)
    const tgtDmData = getMatchOperativeData(target.uid)
    if (!atkDmData || !tgtDmData) return { ok: false, missing: ['无法获取单位数据'] }

    const atkPack = atkDmData.pack
    const tgtPack = tgtDmData.pack
    
    const atkRanged = combatWeapon(attacker.uid, 'RANGED')
    // P3/D-24：获取几何判定的 findingOverrides （如掩体遮蔽）
    const findingOverrides = get().findingOverridesFor(attacker.uid, target.uid)
    
    let elig = { ok: true, missing: [] as string[], findings: findingOverrides }
    if (!s.maplessMode) {
      elig = validateTarget(aPl, dPl, atkRanged?.profile.range ?? Math.hypot(map.bounds.w, map.bounds.h), board, others, { findingOverrides, kind })
      if (!elig.ok) return { ok: false, missing: elig.missing }
    }

    // 攻击方 effect 栈 = 全量（factionRule + chapterTactic/markOfChaos + ability + wargear + activeStratagem）
    const atkStrats = s.activeStratagems[attacker.side]
    const effects = buildEffectStack(attacker, atkStrats)
    const useWeapon = combatWeapon(attacker.uid, kind === 'SHOOT' ? 'RANGED' : 'MELEE')
    if (!useWeapon) return { ok: false, missing: [`阵营包缺 ${kind} 武器`] }
    if (useWeapon.profile.weaponRules.some(r => /^(Toxic|Virulent)$/i.test(r)) && target.markers.includes(`POISON:${attacker.side}`)) { useWeapon.profile.normalDamage++; useWeapon.profile.criticalDamage++ }
    // 谓词 ctx（W3 接线）：目标指示物 + 双方阵营 + 武器类 + 距离 → 剧毒(+1 vs POISON)等条件门控生效
    const predicate: PredicateContext = {
      targetMarkers: target.markers,
      attackerFaction: atkPack.faction.id,
      targetFaction: tgtPack.faction.id,
      weaponKind: kind === 'SHOOT' ? 'RANGED' : 'MELEE',
      rangeInches: Math.hypot(target.pos.x - attacker.pos.x, target.pos.y - attacker.pos.y),
    }
    const baseDice = new ElectronicDiceSource(hashSeed(`${attacker.uid}>${target.uid}`, kind, s.nextShotSeq()))
    
    // Create a mutable array of all dice provided so that successive rolls consume it
    const manualDicePool = (atkNats || defNats) ? [...(atkNats || []), ...(defNats || [])] : undefined
    
    const finalizedRolls = atkRolls && defRolls ? [...atkRolls, ...defRolls] : undefined
    const dice: DiceSource = {
      finalized: !!finalizedRolls,
      roll: (n: number, ctx: any) => {
        if (finalizedRolls) {
          return finalizedRolls.splice(0,n).map(d => ({nat: d.nat as 1|2|3|4|5|6,grade: d.grade as 'NORMAL'|'CRITICAL'|'FAIL'}))
        }
        if (manualDicePool && manualDicePool.length > 0) {
          const take = manualDicePool.splice(0, n)
          return take.map((d) => {
            let grade: 'FAIL' | 'NORMAL' | 'CRITICAL' = 'FAIL'
            if (ctx) {
              if (d >= ctx.critTarget) grade = 'CRITICAL'
              else if (d >= ctx.hitTarget) grade = 'NORMAL'
            }
            if (d === 1) grade = 'FAIL'
            return { nat: d as any, grade, seed: 0 }
          })
        }
        return baseDice.roll(n, ctx)
      }
    }

    let woundsDealt: number
    let attackerWoundsDealt: number = 0
    let log: ResolutionLog
    
    const atkSave = atkDmData.operative.stats.save || DEFENDER_SAVE
    const tgtSave = tgtDmData.operative.stats.save || DEFENDER_SAVE

    if (kind === 'SHOOT') {
      const cover = elig.findings.find((f) => f.kind === 'COVER')?.finalValue ?? false
      const input = {
        attacker: { operativeId: attacker.uid, weapon: useWeapon },
        defender: { operativeId: target.uid, save: tgtSave, wounds: target.wounds },
        effects, defenderEffects: buildEffectStack(target, s.activeStratagems[target.side]), dice, hasCover: cover, predicate,
      }
      const r = runShooting(input)
      woundsDealt = r.woundsDealt
      log = buildShootingLog(`${attacker.uid}>${target.uid}`, input, r)
    } else {
      const defMeleeWeapon = combatWeapon(target.uid, 'MELEE') ?? DEFENDER_WEAPON_FALLBACK ?? useWeapon
      const input = {
        attacker: { operativeId: attacker.uid, weapon: useWeapon, save: atkSave, wounds: attacker.wounds },
        defender: { operativeId: target.uid, weapon: defMeleeWeapon, save: tgtSave, wounds: target.wounds },
        effects, defenderEffects: buildEffectStack(target, s.activeStratagems[target.side]), dice, predicate,
        manualAllocation, // Pass down to engine
      }
      const r = runMelee(input)
      woundsDealt = r.woundsToDefender
      attackerWoundsDealt = r.woundsToAttacker
      log = buildMeleeLog(`${attacker.uid}>${target.uid}`, input, r)
    }
    // 待确认伤亡：lastShot 持 prevWounds，damage 不在此应用（confirmCasualties 才写回）。
    const logKind: LogKind = kind === 'SHOOT' ? 'shoot' : 'melee'
    set({
      lastShot: { targetUid: target.uid, targetName: target.name, woundsDealt, prevWounds: target.wounds, attackerUid: attacker.uid, kind: logKind === 'shoot' ? 'SHOOT' : 'MELEE', attackerWoundsDealt, atkNats, defNats, atkRolls, defRolls },
      currentLog: log,
      log: [{ id: nextLogId(), kind: logKind, text: `${attacker.name} → ${target.name}：待确认伤亡 ${woundsDealt}` }, ...s.log],
    })
    return { ok: true }
  },
  // P1/P2：唯一强制确认——单一数据源(store)应用伤亡，清 lastShot/currentLog。
  // D3：确认前 push 快照（供日志"回滚到此"恢复棋盘），并把 ResolutionLog 存为 replayLog。
  confirmCasualties: (overrides?: {
    targetWoundsDealt?: number
    attackerWoundsDealt?: number
    targetMarkers?: string[]
    attackerMarkers?: string[]
  }) => {
    const ls = get().lastShot
    if (!ls) return
    get().pushSnapshot(`确认伤亡 ${ls.targetName}`)
    const log = get().currentLog
    const target = get().tokens.find((t) => t.uid === ls.targetUid)
    const prevW = target?.wounds ?? 0
    const finalTargetWoundsDealt = overrides?.targetWoundsDealt ?? ls.woundsDealt
    get().applyDamage(ls.targetUid, finalTargetWoundsDealt)
    const newW = Math.max(0, prevW - finalTargetWoundsDealt)
    
    const finalAttackerWoundsDealt = overrides?.attackerWoundsDealt ?? (ls.attackerWoundsDealt ?? 0)
    if (finalAttackerWoundsDealt > 0) {
      get().applyDamage(ls.attackerUid, finalAttackerWoundsDealt)
    }

    // -- Animation Dispatch --
    if (target) {
      const pack = packOfFaction(target.factionId)
      const themeColorRgb = pack.faction.theme?.ui?.primaryRgb || '255, 90, 0'
      const avatarUrl = getAvatarUrl(target.factionId, target.opId)
      
      if (finalTargetWoundsDealt > 0) {
        if (newW <= 0) {
          useAnimationStore.getState().playAnimation({
            type: 'DEATH', themeColorRgb, avatarUrl, 
            maxWounds: target.maxWounds, prevWounds: prevW, currentWounds: 0
          })
        } else {
          useAnimationStore.getState().playAnimation({
            type: 'DAMAGE', themeColorRgb, avatarUrl, 
            text: `-${finalTargetWoundsDealt}`,
            maxWounds: target.maxWounds, prevWounds: prevW, currentWounds: newW
          })
        }
      }
    }
    // ------------------------

    // -- Animation Dispatch (Attacker) --
    const attacker = get().tokens.find((t) => t.uid === ls.attackerUid)
    if (attacker && finalAttackerWoundsDealt > 0) {
      const atkPack = packOfFaction(attacker.factionId)
      const atkThemeColorRgb = atkPack.faction.theme?.ui?.primaryRgb || '255, 90, 0'
      const atkAvatarUrl = getAvatarUrl(attacker.factionId, attacker.opId)
      const atkPrevW = attacker.wounds + finalAttackerWoundsDealt
      const atkNewW = Math.max(0, atkPrevW - finalAttackerWoundsDealt)

      if (atkNewW <= 0) {
        useAnimationStore.getState().playAnimation({
          type: 'DEATH', themeColorRgb: atkThemeColorRgb, avatarUrl: atkAvatarUrl, 
          maxWounds: attacker.maxWounds, prevWounds: atkPrevW, currentWounds: 0
        })
      } else {
        useAnimationStore.getState().playAnimation({
          type: 'DAMAGE', themeColorRgb: atkThemeColorRgb, avatarUrl: atkAvatarUrl, 
          text: `-${finalAttackerWoundsDealt}`,
          maxWounds: attacker.maxWounds, prevWounds: atkPrevW, currentWounds: atkNewW
        })
      }
    }
    // ------------------------

    // 流程结束挂的指示物（POISON 等）应用到对应 token——下次攻击该目标时谓词 targetHasMarker 命中
    const granted = grantedMarkersOf(log)
    const markerLog: string[] = []
    
    // Merge granted from log with manual overrides
    let targetMarkersToAdd = granted.filter(g => g.target === 'DEFENDER').map(g => g.marker)
    let attackerMarkersToAdd = granted.filter(g => g.target === 'ATTACKER').map(g => g.marker)
    if (overrides?.targetMarkers) targetMarkersToAdd = overrides.targetMarkers
    const toxinWeapon = combatWeapon(ls.attackerUid, ls.kind === 'SHOOT' ? 'RANGED' : 'MELEE')
    if (finalTargetWoundsDealt > 0 && toxinWeapon?.profile.weaponRules.some(r => /^(Poison|Toxin)$/i.test(r)) && attacker) targetMarkersToAdd = [...targetMarkersToAdd, `POISON:${attacker.side}`]
    if (overrides?.attackerMarkers) attackerMarkersToAdd = overrides.attackerMarkers
    
    if (targetMarkersToAdd.length > 0 || attackerMarkersToAdd.length > 0) {
      set((s) => ({
        tokens: s.tokens.map((t) => {
          let add: string[] = []
          if (t.uid === ls.targetUid) add = targetMarkersToAdd.filter(m => !t.markers.includes(m))
          if (t.uid === ls.attackerUid) add = attackerMarkersToAdd.filter(m => !t.markers.includes(m))
          
          if (add.length === 0) return t
          add.forEach((m) => markerLog.push(`${t.name} ←${m}`))
          return { ...t, markers: [...t.markers, ...add] }
        }),
      }))
    }
    set((s) => ({
      lastShot: null,
      currentLog: null,
      replayLog: log,
      log: [
        { id: nextLogId(), kind: 'system' as LogKind, text: `确认伤亡：${ls.targetName} -${finalTargetWoundsDealt}血` + (finalAttackerWoundsDealt > 0 ? `，${ls.attackerUid === ls.targetUid ? '' : '攻击方'} -${finalAttackerWoundsDealt}血` : '') + (markerLog.length ? ` [${markerLog.join(', ')}]` : '') },
        ...s.log
      ]
    }))
  },
  undoPending: () => { get().undoAction(); set({ lastShot: null, currentLog: null }) },
  attackViz: (activeUid) => {
    const s = get()
    const map = s.mapPack
    if (!activeUid || !map || !RANGED) return { range: 0, controlRing: null, ownCover: null, targets: [] }
    const attacker = s.tokens.find((t) => t.uid === activeUid)
    if (!attacker) return { range: 0, controlRing: null, ownCover: null, targets: [] }
    const placed = s.tokens.filter((t) => t.alive && t.placed)
    const board: BoardT = { terrain: map.terrain, operatives: placed.map((t) => ({ operativeId: t.uid, pos: t.pos, baseRadius: t.baseRadius })) }
    const range = combatWeapon(activeUid, 'RANGED')?.profile.range ?? Math.hypot(map.bounds.w, map.bounds.h)
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
          return { uid: t.uid, pos: t.pos, losFinal: typeof ov === 'boolean' ? ov : los.finalValue, losAmbiguous: los.confidence === 'AMBIGUOUS', obscured }
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
      typeof ov === 'boolean' ? ov : los.finalValue,
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
      log: [...newLogs, ...s.log],
      // D4 effect 到期 push：作为非阻塞 intercept 提示
      intercept: expired.length ? { title: `effect 到期 ×${expired.length}`, reasons: expired } : s.intercept,
    })
    return expired.length
  },
  pushSnapshot: (label) => {
    const s = get()
    snapshotId += 1
    const snap: Snapshot = {
      flow: structuredClone({phase:s.phase, initiative:s.initiative, strategyTurn:s.strategyTurn, strategyPasses:s.strategyPasses, activeStratagems:s.activeStratagems, usedPloys:s.usedPloys, reactionUid:s.reactionUid, reacted:s.reacted, previousInitiative:s.previousInitiative, winner:s.winner}),
      id: snapshotId,
      label,
      tokens: structuredClone(s.tokens),
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
      ...snap.flow,
      activationUndo: [], selected: null, dragging: null,
      tokens: structuredClone(snap.tokens),
      vp: { ...snap.vp },
      turn: { ...snap.turn, operatives: { ...snap.turn.operatives } },
      activeEffects: Object.fromEntries(Object.entries(snap.activeEffects).map(([k, v]) => [k, v.map((e) => ({ ...e }))])),
      lastShot: null,
      currentLog: null,
      snapshots: cur.snapshots.filter((x) => x.id < id), // 丢弃其后快照
      log: [{ id: nextLogId(), kind: 'system' as LogKind, text: `↶ 回退：<${snap.label}>` }, ...cur.log],
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
    const gate = get().canEndTP()
    if (!gate.ok) { get().setIntercept({ title: '暂不能结束转折点', reasons: [gate.reason!] }); return }
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
      winner = s.mapPack?.objectives.length === 0 && scoredA === 0 && scoredB === 0 ? '训练完成（未记录任务得分）' : scoredA > scoredB ? 'A 胜' : scoredB > scoredA ? 'B 胜' : '平局'
      newLogs.push({ id: nextLogId(), kind: 'system' as LogKind, text: `战斗结束 → ${winner}（VP A:${scoredA} B:${scoredB}）` })
    }
    // P11：TP 结束计分 push 文案
    const pushMsg = ended ? null : `TP${s.turn.turningPoint} 结束 — VP +${gainedA}/+${gainedB}（A:${scoredA} B:${scoredB}）`
    set({
      previousInitiative: s.initiative,
      activeStratagems: { a: [], b: [] }, reacted: [], reactionUid: null,
      vp: { a: scoredA, b: scoredB },
      turn: ended ? next : { ...next, activePlayer: next.activePlayer === 'a' ? 'b' : 'a' },
      winner: ended ? winner : null,
      phase: ended ? 'ended' : 'strategy',
      initiative: null,
      strategyTurn: null,
      strategyPasses: { a: false, b: false },
      selected: null,
      pushMsg,
      log: [...newLogs, ...s.log],
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
  viewport: { scale: 1, offsetX: 0, offsetY: 0 },
  interacting: false,
  activeStratagems: { a: [], b: [] },
      overrides: {},
      activeEffects: {},
      snapshots: [],
      replayLog: null,
      pushMsg: null,
      winner: null,
      intercept: null,
      initiative: null,
      deployInitiative: null,
      deployDice: null,
      deployRollNonce: 0,
      strategyPasses: { a: false, b: false },
      strategyTurn: null,
      lastPloy: null,
      activationUndo: [],
      maplessMode: false
    }),
  setMaplessMode: (m) => set({ maplessMode: m }),
}))

// ===== 选择器/派生（纯函数，组件用） =====
export function selectActivated(state: MatchState, uid: string | null): boolean {
  if (!uid) return false
  return Boolean(state.turn.operatives[uid]?.ready)
}
