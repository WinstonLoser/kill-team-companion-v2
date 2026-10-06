import { useState, useRef, useEffect, useMemo } from 'react'
import { DungeonMasterOverlay } from '../components/DungeonMaster/DungeonMasterOverlay'
import { useMatchStore, getMatchOperativeData, combatWeapon, vantageBonus, attackCoverType, geometryBoard, geometryPlacement, type MatchToken } from '../../state/matchStore'
import type { ActionType } from '../../state/turnStateMachine'
import { circlesOverlap, circleHitsBlockingTerrain, pointInPolygon, validateTarget, sharedCoverObscuredTerrain, type Point } from '../../geometry'
import { Board, BoardLegend, type LosLine, type ObjControl } from './Board'
import { StatusStrip } from './StatusStrip'
import { UnitPanel } from './UnitPanel'
import { ActionBar } from './ActionBar'
import { LogPanel } from './LogPanel'
import { CombatResolver } from '../components/Combat/CombatResolver'
import { OperativeCard } from '../components/OperativeCard/OperativeCard'
import { TargetSelectionModal } from './TargetSelectionModal'
import { StratagemPanel } from './StratagemPanel'
import { packOfFaction } from '../../state/matchStore'
import { getAvatarUrl } from '../../utils/avatars'
import { DamageResolutionPanel } from '../components/Combat/DamageResolutionPanel'
import { type RollContext } from '../../dice/source'
import { playerRulingRules } from '../weaponDisplay'
import { VolkusTerrainPanel } from './VolkusTerrainPanel'
import { evaluateElevationMove } from '../../geometry/elevationMove'
import { createPlanarReachability, type PlanarRoute } from '../../geometry/planarMove'
import { useVisualFxStore } from '../../state/visualFxStore'

// 对局主界面（1.13-1.16）。AR-9：UI 只 dispatch intent + 读 store，不直接调引擎/几何/骰源。
// 一击结算经 matchStore.resolveAttack；几何可视化经 store.attackViz；翻转经 store.setOverride。

function clampPos(p: Point): Point {
  const b = useMatchStore.getState().mapPack?.bounds ?? { w: 30, h: 20 }
  return { x: Math.max(0.5, Math.min(b.w - 0.5, p.x)), y: Math.max(0.5, Math.min(b.h - 0.5, p.y)) }
}

export function PlayView({ onQueryRule }: { onQueryRule: (hint: string) => void }) {
  const mapPack = useMatchStore((s) => s.mapPack)
  const heightMode = useMatchStore((s) => s.heightMode)
  const maplessMode = useMatchStore((s) => s.maplessMode)
  const tokens = useMatchStore((s) => s.tokens)
  const turn = useMatchStore((s) => s.turn)
  const selected = useMatchStore((s) => s.selected)
  const setSelected = useMatchStore((s) => s.setSelected)
  const dragging = useMatchStore((s) => s.dragging)
  const setDragging = useMatchStore((s) => s.setDragging)
  const moveToken = useMatchStore((s) => s.moveToken)
  const rotateToken = useMatchStore((s) => s.rotateToken)
  const activate = useMatchStore((s) => s.activate)
  const endActivation = useMatchStore((s) => s.endActivation)
  const selectOrder = useMatchStore((s) => s.selectOrder)
  const doAction = useMatchStore((s) => s.doAction)
  const checkAction = useMatchStore((s) => s.checkAction)
  const undoAction = useMatchStore((s) => s.undoAction)
  const activationUndo = useMatchStore((s) => s.activationUndo)
  const scoreAndEndTP = useMatchStore((s) => s.scoreAndEndTP)
  const undoPending = useMatchStore((s) => s.undoPending)
  const resolveAttack = useMatchStore((s) => s.resolveAttack)
  const replayLast = useMatchStore((s) => s.replayLast)
  const rewindToSnapshot = useMatchStore((s) => s.rewindToSnapshot)
  const snapshots = useMatchStore((s) => s.snapshots)
  const controlOf = useMatchStore((s) => s.controlOf)
  const pushMsg = useMatchStore((s) => s.pushMsg)
  const setPushMsg = useMatchStore((s) => s.setPushMsg)
  const viewport = useMatchStore((s) => s.viewport)
  const setInteracting = useMatchStore((s) => s.setInteracting)
  const interacting = useMatchStore((s) => s.interacting) // P2：响应式订阅
  const setViewport = useMatchStore((s) => s.setViewport)
  const effectiveMoveOf = useMatchStore((s) => s.effectiveMoveOf)
  const effectiveAplOf = useMatchStore((s) => s.effectiveAplOf)
  const lastPinchDist = useRef(0)
  const viewportRef = useRef<HTMLDivElement>(null)

  // Removed wheel zooming logic per user request.

  // P1.5：容器尺寸变化时，自动缩放以填满水平空间
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let lastScale = -1
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const width = entry.contentRect.width
      const defaultW = (mapPack?.bounds.w ?? 30) * 20
      if (width > 0 && defaultW > 0) {
        const newScale = width / defaultW
        if (Math.abs(lastScale - newScale) > 0.001) {
          lastScale = newScale
          setViewport({ scale: newScale, offsetX: 0, offsetY: 0 })
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [mapPack, setViewport])
  const confirmCasualties = useMatchStore((s) => s.confirmCasualties)
  const diceSource = useMatchStore((s) => s.diceSource)
  const setIntercept = useMatchStore((s) => s.setIntercept)
  const emitBoardFx = useVisualFxStore(s => s.emitBoardFx)
  const intercept = useMatchStore((s) => s.intercept)
  const pushLog = useMatchStore((s) => s.pushLog)
  const lastShot = useMatchStore((s) => s.lastShot)
  const attackViz = useMatchStore((s) => s.attackViz)
  useMatchStore((s) => s.overrides)
  const engagementOf = useMatchStore((s) => s.engagementOf)

  const [pendingAsk, setPendingAsk] = useState<{ attacker: MatchToken; target: MatchToken } | null>(null)
  const [combatCollect, setCombatCollect] = useState<{
    attacker: MatchToken;
    target: MatchToken;
    kind: 'SHOOT' | 'MELEE';
    atkCount: number;
    atkContext: any
    atkTheme: any
    atkDamage?: { normal: number, critical: number }
    atkRetainedDice?: import('../../dice/source').DiceRoll[]
    defCount: number;
    defContext: any;
    defTheme: any
    defDamage?: { normal: number, critical: number }
    defModifiers?: string[];
    defRetainedDice?: import("../../dice/source").DiceRoll[];
    defSave: number;
    defWounds: number;
  } | null>(null)
  const [hoverInch, setHoverInch] = useState<string | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{uid:string;pos:Point}|null>(null)
  const [moveRoute, setMoveRoute] = useState<PlanarRoute | null>(null)
  const [destinationHeight, setDestinationHeight] = useState(0)
  const [pendingMove, setPendingMove] = useState<ActionType | null>(null)
  const [pendingAttack, setPendingAttack] = useState<'SHOOT' | 'FIGHT' | null>(null)
  const [hoverTargetUid, setHoverTargetUid] = useState<string | null>(null)
  const [pendingTerrainChoice, setPendingTerrainChoice] = useState<{ attacker: MatchToken; target: MatchToken } | null>(null)
  const [moveOrigin, setMoveOrigin] = useState<Point | null>(null) // 移动起点（arm 时捕获，confirm/cancel 前不变）
  const [movePreview, setMovePreview] = useState<boolean>(false) // 拖动后待确认
  const [showDataCardUid, setShowDataCardUid] = useState<string | null>(null)
  const [showDungeonMaster, setShowDungeonMaster] = useState(false)
  const [showFullLog, setShowFullLog] = useState<boolean>(false)

  useEffect(() => { setPreviewPosition(null); setMoveRoute(null); setPendingMove(null); setMoveOrigin(null); setMovePreview(false); setDestinationHeight(0); setHoverTargetUid(null) }, [selected])
  const active = tokens.find((t) => t.uid === selected) ?? null
  const selectedOp = active ? turn.operatives[active.uid] : undefined
  const activated = active ? turn.activeOpId === active.uid : false
  const canSelect = active ? active.side === turn.activePlayer : false

  const promptStr = intercept
    ? `⚠️ ${intercept.title}：${intercept.reasons.join(', ')}`
    : !active
      ? useMatchStore.getState().canEndTP().ok ? '双方全部待机：可以结束转折点' : !tokens.some(t=>t.side===turn.activePlayer && t.alive && turn.operatives[t.uid]?.ready) ? '选择待机特工进行反应，或放弃反应交给对手' : `轮到 ${turn.activePlayer.toUpperCase()}：点一名己方特工`
      : !canSelect
        ? `选中了${active.side === 'a' ? 'A' : 'B'}方特工（仅查看）；请激活 ${turn.activePlayer.toUpperCase()} 方`
        : !activated
          ? `${active.name}：先激活才能行动`
          : pendingMove
            ? `${active.name} · ${pendingMove === 'MOVE' ? '转移' : pendingMove === 'DASH' ? '冲刺' : pendingMove === 'FALL_BACK' ? '后撤' : '冲锋'}：${moveRoute ? `${moveRoute.cost}/${actionMaxDist(active.uid, pendingMove)}″${moveRoute.ok ? ' · 可确认' : ` · ${moveRoute.reason ?? '落点不可达'}`}` : '拖拽特工到绿色可达区域'}`
            : pendingAttack
              ? `${active.name} · ${pendingAttack === 'SHOOT' ? '射击' : '近战'} 已选：点敌方目标（再点取消）`
              : `${active.name} 已激活：选命令 + 选行动`

  const apl = active ? effectiveAplOf(active.uid) : 0
  // 各行动合法性（激活后才需算）
  const canDo = (() => {
    const z: Record<ActionType, boolean> = { MOVE: false, DASH: false, FALL_BACK: false, CHARGE: false, SHOOT: false, FIGHT: false }
    if (active && activated) (['MOVE', 'DASH', 'FALL_BACK', 'CHARGE', 'SHOOT', 'FIGHT'] as ActionType[]).forEach((a) => { z[a] = checkAction(active.uid, a).ok })
    return z
  })()
  const log = useMatchStore((s) => s.log)
  const latestLog = log.length > 0 ? log[0] : null

  const actionBarProps = {
    active: turn.activePlayer,
    selectedName: active?.name ?? null,
    selectedSide: active?.side ?? null,
    activated,
    orderLocked: useMatchStore.getState().reactionUid === active?.uid,
    order: selectedOp?.order ?? null,
    apl,
    apUsed: selectedOp?.apUsed ?? 0,
    canDo,
    actionCosts: Object.fromEntries(Object.keys(canDo).map(a => [a, active ? useMatchStore.getState().actionCostOf(active.uid,a as ActionType) : 1])) as Record<ActionType,number>,
    pendingMove,
    pendingAttack,
    hasLastShot: Boolean(lastShot),
    movePreview: movePreview && active && moveOrigin !== null,
    onActivate: () => {
      if (active) {
        activate(active.uid, active.side)
        pushLog('turn', `${active.name} 激活（APL ${effectiveAplOf(active.uid)}）`)
      }
    },
    onSelectOrder: (o: any) => { if (active) selectOrder(active.uid, o) },
    onPickMove: pickMove,
    onConfirmMove: confirmMove,
    onCancelMove: cancelMove,
    onPickAttack: (k: 'SHOOT' | 'FIGHT') => {
      setPreviewPosition(null)
      setHoverTargetUid(null)
      setPendingAttack((prev) => (prev === k ? null : k))
      setPendingMove(null); setMoveOrigin(null); setMovePreview(false)
    },
    onUndoAction: () => {cancelMove();undoAction()},
    canUndoAction: activationUndo.length > 0,
    onEndActivation: () => { 
      if (active) { 
        setPreviewPosition(null);
        endActivation(active.uid); 
        pushLog('turn', `${active.name} 结束激活`); 
        setSelected(null); setPendingMove(null); setPendingAttack(null); setMoveOrigin(null); setMovePreview(false) 
      } 
    },
    onEndTP: () => scoreAndEndTP(),
    onUndo: undoPending
  }

  /** 行动最大移动距离（英寸）。 */
  function actionMaxDist(uid: string, action: ActionType): number {
    if (useMatchStore.getState().reactionUid === uid) return 2
    const m = effectiveMoveOf(uid)
    if (action === 'DASH') return 3
    if (action === 'CHARGE') return m + 2
    return m // MOVE / FALL_BACK
  }
  function horizontalAllowance(uid: string, action: ActionType, currentHeight: number): number {
    const difference = heightMode === 'elevation' ? destinationHeight - currentHeight : 0
    const verticalCost = difference > 0 ? Math.max(2, Math.ceil(difference)) : difference < 0 ? Math.max(0, Math.ceil(-difference - 2)) : 0
    return Math.max(0, actionMaxDist(uid, action) - verticalCost)
  }

  // ===== 目标控制（1.16）— 读 store.controlOf（P7：store 当下 tokens） =====
  const objControl: ObjControl[] = mapPack ? mapPack.objectives.map((o) => {
    const nA = tokens.filter((t) => t.alive && t.placed && t.side === 'a' && Math.hypot(t.pos.x - o.pos.x, t.pos.y - o.pos.y) <= o.controlRange).length
    const nB = tokens.filter((t) => t.alive && t.placed && t.side === 'b' && Math.hypot(t.pos.x - o.pos.x, t.pos.y - o.pos.y) <= o.controlRange).length
    return { id: o.id, ctrl: controlOf(o), nA, nB }
  }) : []

  // ===== 几何可视化（1.14）— 读 store.attackViz（AR-9：不在 UI 调 geometry） =====
  const showViz = active && activated && active.side === turn.activePlayer && !interacting
  const viz = showViz ? attackViz(active!.uid) : { range: 0, controlRing: null, ownCover: null, targets: [] }
  // 移动范围指示器（武装移动行动时显示，优先于武器射程环）
  const moveRing = heightMode === 'elevation' && active && pendingMove && moveOrigin ? { center: moveOrigin, r: horizontalAllowance(active.uid, pendingMove, active.height ?? 0) } : null
  const rangeRing = pendingMove && heightMode !== 'elevation' ? null : moveRing ?? (showViz ? { center: active!.pos, r: viz.range } : null)
  const planarReach = useMemo(() => mapPack && heightMode !== 'elevation' && active && pendingMove && moveOrigin && !maplessMode
    ? createPlanarReachability({
        map: mapPack, from: moveOrigin, radius: active.baseRadius,
        allowance: actionMaxDist(active.uid, pendingMove), action: pendingMove as 'MOVE' | 'DASH' | 'FALL_BACK' | 'CHARGE', side: active.side,
        obstacles: tokens.filter(t => t.uid !== active.uid && t.alive && t.placed).map(t => ({ pos: t.pos, radius: t.baseRadius, side: t.side })),
      }) : null,
    [mapPack, heightMode, active, pendingMove, moveOrigin, maplessMode, tokens, effectiveMoveOf])
  const controlRing = viz.controlRing
  const ownCover = viz.ownCover
  const losLines: LosLine[] = viz.targets.map((tg) => {
    const tok = tokens.find((t) => t.uid === tg.uid)
    if (!tok) return null
    return {
      uid: tg.uid,
      target: tg.pos,
      stroke: !tg.losFinal ? '#ff5c5c' : !tg.shootable ? '#f59e0b' : tg.obscured ? '#c084fc' : '#39d98a',
      dash: tg.obscured ? '2 4' : tg.losAmbiguous ? '4 3' : 'none',
      opacity: 0.8,
      fromHeight: heightMode === 'elevation' ? active?.height ?? 0 : undefined,
      toHeight: heightMode === 'elevation' ? tok.height ?? 0 : undefined,
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null)
  const hoverTarget = tokens.find(t => t.uid === hoverTargetUid && t.side !== active?.side) ?? null

  // ===== 一击交互（1.13 T4）— dispatch intent =====
  function onClickToken(t: MatchToken) {
    if (t.side === turn.activePlayer) {
      // 切换特工时放弃当前移动预览（避免回退到错位）
      if (movePreview && t.uid !== selected) cancelMove()
      setSelected(t.uid)
      setIntercept(null)
      return
    }
    if (!active || active.side !== turn.activePlayer || !activated) {
      setIntercept({ title: '未激活', reasons: ['须先激活己方特工再攻击'] })
      return
    }
    // 已装填射击/近战 → 直接走该 kind
    if (pendingAttack) {
      runKind(active, t, pendingAttack === 'SHOOT' ? 'SHOOT' : 'MELEE')
      setPendingAttack(null)
      return
    }
    startAttack(active, t)
  }

  function startAttack(attacker: MatchToken, target: MatchToken) {
    const engaged = engagementOf(attacker.uid, target.uid)
    if (engaged) {
      setPendingAsk({ attacker, target })
      return
    }
    runKind(attacker, target, 'SHOOT')
  }

  function runKind(attacker: MatchToken, target: MatchToken, kind: 'SHOOT' | 'MELEE') {
    if (kind === 'SHOOT' && heightMode === 'elevation' && !maplessMode && mapPack &&
      useMatchStore.getState().overrideValue(attacker.uid, target.uid, 'TERRAIN_CHOICE') === undefined &&
      sharedCoverObscuredTerrain(
        geometryPlacement(attacker, heightMode),
        geometryPlacement(target, heightMode),
        geometryBoard(mapPack, heightMode),
      )) {
      setPendingTerrainChoice({ attacker, target })
      return
    }
    // 预校验射程和LOS，如果超出射程，不弹骰子界面直接提示且不扣除AP
    const legality = useMatchStore.getState().checkAttackLegality({ attackerUid: attacker.uid, targetUid: target.uid, kind })
    if (!legality.ok) {
      useMatchStore.getState().clearOverride(`${attacker.uid}>${target.uid}>TERRAIN_CHOICE`)
      setIntercept({ title: '无法攻击', reasons: legality.missing ?? [] })
      return
    }

    // 行动消费 AP（SHOOT→SHOOT，MELEE→FIGHT）；不通过则拦截
    const actR = doAction(attacker.uid, kind === 'SHOOT' ? 'SHOOT' : 'FIGHT')
    if (!actR.ok) { useMatchStore.getState().clearOverride(`${attacker.uid}>${target.uid}>TERRAIN_CHOICE`); setIntercept({ title: '行动不可用', reasons: [actR.reason ?? '未知'] }); return }

    // 获取攻击者的武器和属性，唤出 DiceInterface
    const atkData = getMatchOperativeData(attacker.uid)
    const atkPack = atkData?.pack
    const weapon = combatWeapon(attacker.uid, kind === 'SHOOT' ? 'RANGED' : 'MELEE')
    if (!weapon) { undoAction(); setIntercept({ title: '无武器', reasons: [`阵营包缺 ${kind} 武器`] }); return }

    const lethalRule = weapon.profile.weaponRules?.find((r: string) => r.startsWith('Lethal '))
    const critTarget = lethalRule ? parseInt(lethalRule.replace('Lethal ', '')) || 6 : 6;
    const context: RollContext = { hitTarget: weapon.profile.hit, critTarget }

    const defData = getMatchOperativeData(target.uid)
    const defPack = defData?.pack
    const defWeapon = combatWeapon(target.uid, 'MELEE')

    // 防御方数据准备 (近战时使用其武器；射击时防御方使用 save 值作为目标，防守骰数固定3或根据规则)
    const defCount = kind === 'SHOOT' ? Math.max(0,3 - Number(weapon.profile.weaponRules.find(r => /^Piercing \d/i.test(r))?.match(/\d+/)?.[0] ?? 0)) : (defWeapon?.profile.attacks ?? 0)
    let defContext: any = { hitTarget: 3, critTarget: 6 }
    if (kind === 'MELEE' && defWeapon) {
      const defLethal = defWeapon.profile.weaponRules?.find((r: string) => r.startsWith('Lethal '))
      const defCritTarget = defLethal ? parseInt(defLethal.replace('Lethal ', '')) || 6 : 6
      defContext = { hitTarget: defWeapon.profile.hit, critTarget: defCritTarget }
    } else if (kind === 'SHOOT') {
      defContext = { hitTarget: defData?.operative.stats.save || 3, critTarget: 6 }
    }

    let defModifiers: string[] = []
    let defRetainedDice: import('../../dice/source').DiceRoll[] = []
    let atkRetainedDice: import('../../dice/source').DiceRoll[] = []

    if (kind === 'SHOOT') {
      const coverType = attackCoverType(attacker.uid, target.uid)
      const vantage = vantageBonus(attacker.uid, target.uid)
      const match = useMatchStore.getState()
      const board = mapPack ? geometryBoard(mapPack, heightMode) : { terrain: [], operatives: [] }
      const geometry = validateTarget(
        geometryPlacement(attacker, heightMode),
        geometryPlacement(target, heightMode),
        weapon.profile.range ?? Math.hypot(mapPack?.bounds.w ?? 30, mapPack?.bounds.h ?? 22), board, [attacker.pos],
        { findingOverrides: match.findingOverridesFor(attacker.uid, target.uid), terrainChoice: match.overrideValue(attacker.uid, target.uid, 'TERRAIN_CHOICE') === 'OBSCURED' ? 'OBSCURED' : 'COVER' },
      )
      const isObscured = geometry.findings.find(f => f.kind === 'OBSCURED')?.finalValue ?? false
      const hasCover = geometry.findings.find(f => f.kind === 'COVER')?.finalValue ?? false
      const accurateWeapon = Number(weapon.profile.weaponRules.find(r => /^Accurate \d+/i.test(r))?.match(/\d+/)?.[0] ?? 0)
      const accurate = Math.min(2, accurateWeapon + (target.order === 'ENGAGE' ? vantage : 0))
      atkRetainedDice = Array.from({ length: Math.min(weapon.profile.attacks, accurate) }, () => ({ nat: context.hitTarget as 1 | 2 | 3 | 4 | 5 | 6, grade: 'NORMAL', isRetained: true }))
      if (vantage) defModifiers.push(`制高点高出 ${vantage * 2}"：${target.order === 'ENGAGE' ? `攻击方获得精准 ${vantage}。` : '可射击轻掩护中的隐匿目标；其掩护豁免增强。'}`)
      const retainsCover = hasCover && !weapon.profile.weaponRules.some(r => /^saturate$/i.test(r))
      if (retainsCover) {
        const enhanced = vantage > 0 && coverType === 'LIGHT' && target.order === 'CONCEAL'
        defRetainedDice = Array.from({ length: Math.min(defCount, enhanced ? 2 : 1) }, () => ({ nat: defContext.hitTarget as 1 | 2 | 3 | 4 | 5 | 6, grade: 'NORMAL', isRetained: true }))
        if (enhanced) defModifiers.push('高点对轻掩护隐匿目标：可保留 1 个关键豁免或 2 个普通豁免；当前预选 2 个普通豁免，可在骰子界面调整。')
      }
      if (coverType === 'LIGHT' && hasCover) defModifiers.push('轻型掩护：可保留掩护豁免。')
      if (coverType === 'HEAVY' && hasCover) defModifiers.push('重型掩护：可保留掩护豁免；隐匿目标仍不可被高点射击。')
      if (isObscured) defModifiers.push('遮蔽：目标仍可射击；结算时优先弃 1 枚普通成功，所有关键命中降为普通命中。若需自行指定，确认伤害时可裁定。')
    }

    setPendingAsk(null)
    setCombatCollect({
      attacker, target, kind,
      atkCount: weapon.profile.attacks,
      atkContext: context,
      atkTheme: atkPack?.faction.theme?.dice || { baseColor: '#1e1e1e', pipColor: '#e0e0e0' },
      atkDamage: { normal: weapon.profile.normalDamage, critical: weapon.profile.criticalDamage },
      atkRetainedDice,
      defCount,
      defContext,
      defTheme: defPack?.faction.theme?.dice || { baseColor: '#444', pipColor: '#fff' },
      defDamage: defWeapon ? { normal: defWeapon.profile.normalDamage, critical: defWeapon.profile.criticalDamage } : { normal: 0, critical: 0 },
      defSave: 3, // DEFENDER_SAVE
      defWounds: target.wounds,
      defModifiers,
      defRetainedDice
    })
  }

  function rewindLast() {
    // D3：回退到最近一次确认/计分前（全局恢复棋盘+VP+回合）
    const last = snapshots[snapshots.length - 1]
    if (last) rewindToSnapshot(last.id)
  }

  function onPointerMove(p: Point) {
    if (dragging && moveOrigin && pendingMove) {
      // 保留最大距离硬限制；统一高度时展示由障碍物和底座决定的实际可达区域。
      const max = active ? horizontalAllowance(dragging, pendingMove, active.height ?? 0) : actionMaxDist(dragging, pendingMove)
      const dx = p.x - moveOrigin.x, dy = p.y - moveOrigin.y
      const dist = Math.hypot(dx, dy)
      const cl = dist > max ? { x: moveOrigin.x + (dx / dist) * max, y: moveOrigin.y + (dy / dist) * max } : p
      const destination = clampPos(cl)
      setPreviewPosition({uid:dragging,pos:destination})
      const total = actionMaxDist(dragging, pendingMove)
      const projected = planarReach ? planarReach.routeTo(destination) : mapPack && active ? evaluateElevationMove({ map: mapPack, from: moveOrigin, to: destination, fromHeight: active.height ?? 0, toHeight: heightMode === 'elevation' ? destinationHeight : 0, radius: active.baseRadius, allowance: total, action: pendingMove as 'MOVE' | 'DASH' | 'FALL_BACK' | 'CHARGE' }) : null
      setMoveRoute(planarReach ? projected as PlanarRoute : null)
      setHoverInch(`${pendingMove === 'DASH' ? '冲刺' : pendingMove === 'CHARGE' ? '冲锋' : pendingMove === 'FALL_BACK' ? '后撤' : '转移'} ${projected?.cost ?? Math.ceil(Math.min(dist, max))}/${total}″${projected && !projected.ok ? ` · ${projected.reason ?? '请调整落点'}` : planarReach && (projected as PlanarRoute)?.path.length > 2 ? ' · 已规划绕行' : ''}`)
    }
  }
  function onPointerUp() {
    if (dragging) {
      const t = tokens.find((x) => x.uid === dragging)
      if (t && moveOrigin && pendingMove) {
        const d = previewPosition ? Math.hypot(previewPosition.pos.x - moveOrigin.x, previewPosition.pos.y - moveOrigin.y) : 0
        if (d > 0.1 || (heightMode === 'elevation' && destinationHeight !== (t.height ?? 0))) setMovePreview(true) // 待确认：不立即消费 AP，可再拖
      }
      setDragging(null)
      setHoverInch(null)
    }
  }
  // 确认移动：校验落点 → 消费 AP；失败回退到起点
  function confirmMove() {
    if (!active || !pendingMove || !moveOrigin) return
    const t = previewPosition?.uid === active.uid ? {...active,pos:previewPosition.pos} : active
    const isMapless = useMatchStore.getState().maplessMode
    const targetHeight = heightMode === 'elevation' ? destinationHeight : 0
    
    if (!isMapless) {
      if (mapPack) {
        const verdict = planarReach ? planarReach.routeTo(t.pos) : evaluateElevationMove({ map: mapPack, from: moveOrigin, to: t.pos, fromHeight: active.height ?? 0, toHeight: targetHeight, radius: t.baseRadius, allowance: actionMaxDist(t.uid, pendingMove)!, action: pendingMove as 'MOVE' | 'DASH' | 'FALL_BACK' | 'CHARGE' })
        if (!verdict.ok) { setIntercept({ title: '移动路径不可通行', reasons: [verdict.reason ?? '请重新选择落点'] }); return }
      }
      if (!planarReach) {
      const distance = Math.hypot(t.pos.x - moveOrigin.x, t.pos.y - moveOrigin.y)
      const steps = Math.max(1,Math.ceil(distance / 0.1))
      const rising = targetHeight > (active.height ?? 0)
      const falling = targetHeight < (active.height ?? 0)
      const transitionPlatform = mapPack?.platforms?.find(p => p.height === (rising ? targetHeight : active.height ?? 0) && pointInPolygon(rising ? t.pos : moveOrigin, p.polygon))
      for(let i=1;i<=steps;i++) {
        const p={x:moveOrigin.x+(t.pos.x-moveOrigin.x)*i/steps,y:moveOrigin.y+(t.pos.y-moveOrigin.y)*i/steps}
        const insidePlatform = transitionPlatform ? pointInPolygon(p, transitionPlatform.polygon) : false
        const pathHeight = rising ? (insidePlatform ? targetHeight : active.height ?? 0) : falling ? (insidePlatform ? active.height ?? 0 : targetHeight) : targetHeight
        if(mapPack && (p.x < t.baseRadius || p.y < t.baseRadius || p.x > mapPack.bounds.w-t.baseRadius || p.y > mapPack.bounds.h-t.baseRadius)) {
          setIntercept({title:'移动路径不可通行',reasons:['请沿无墙体的直线路径移动，并保持底座完全位于战场内']});return
        }
        if (tokens.some(e => e.alive && e.placed && e.side !== t.side && Math.abs((e.height ?? 0) - pathHeight) < 1 && circlesOverlap(p, t.baseRadius, e.pos, e.baseRadius))) {
          setIntercept({ title: '移动路径不可通行', reasons: ['底座不能穿过敌方特工'] }); return
        }
        if(pendingMove !== 'CHARGE' && pendingMove !== 'FALL_BACK' && tokens.some(e=>e.alive && e.placed && e.side!==t.side && Math.abs((e.height ?? 0) - pathHeight) <= 1 && Math.hypot(e.pos.x-p.x,e.pos.y-p.y)<=e.baseRadius+t.baseRadius+1)) {
          setIntercept({title:'移动进入敌方控制范围',reasons:['转移与冲刺不能穿过敌方控制范围；接敌请使用冲锋']});return
        }
      }
      }
      if (pendingMove === 'CHARGE') {
        const inEng = tokens.some((e) => e.alive && e.placed && e.side !== t.side && Math.abs((e.height ?? 0) - targetHeight) <= 1 && Math.hypot(e.pos.x - t.pos.x, e.pos.y - t.pos.y) <= t.baseRadius + e.baseRadius + 1)
        if (!inEng) { setIntercept({ title: '冲锋非法', reasons: ['冲锋须结束在敌方 1" 控制范围内'] }); return }
      }
      if (pendingMove === 'FALL_BACK' && tokens.some(e => e.alive && e.placed && e.side !== t.side && Math.abs((e.height ?? 0) - targetHeight) <= 1 && Math.hypot(e.pos.x-t.pos.x,e.pos.y-t.pos.y)<=e.baseRadius+t.baseRadius+1)) {setIntercept({title:'后撤尚未脱离',reasons:['后撤必须结束在所有敌方控制范围以外']});return}
      const overlap = tokens.filter((o) => o.alive && o.placed && o.uid !== t.uid && Math.abs((o.height ?? 0) - targetHeight) < 1).find((o) => circlesOverlap(t.pos, t.baseRadius, o.pos, o.baseRadius))
      const destinationPlatform = mapPack?.platforms?.find(p => p.height === targetHeight && pointInPolygon(t.pos, p.polygon))
      const wall = mapPack ? circleHitsBlockingTerrain(t.pos, t.baseRadius, mapPack.terrain.filter(feature => targetHeight === 0 || feature.pieceId !== destinationPlatform?.pieceId)) : false
      if (overlap || wall) {
        setIntercept({ title: overlap ? '与特工重叠' : '与墙体重叠', reasons: [`${t.name} ${overlap ? `与 ${overlap.name} 底座重叠` : '压在阻拦地形上'}`] })
        return
      }
    }

    const destination = { ...t.pos }
    // Validate action and capture undo at its committed origin, not the drag preview.
    const r = doAction(t.uid, pendingMove)
    if (r.ok) {
      const path = planarReach?.routeTo(destination).path ?? [moveOrigin, destination]
      moveToken(t.uid, destination, targetHeight)
      emitBoardFx({ kind: 'MOVE', uid: t.uid, factionId: t.factionId, from: moveOrigin, to: destination, path, durationMs: 700 })
      const crossedDoor = mapPack?.terrain.find(feature => feature.isDoor && path.some((point, index) => index > 0 && Array.from({ length: 13 }, (_, step) => ({ x: path[index - 1]!.x + (point.x - path[index - 1]!.x) * step / 12, y: path[index - 1]!.y + (point.y - path[index - 1]!.y) * step / 12 })).some(sample => pointInPolygon(sample, feature.polygon))))
      if (crossedDoor) {
        const middle = crossedDoor.polygon.reduce((sum, point) => ({ x: sum.x + point.x / crossedDoor.polygon.length, y: sum.y + point.y / crossedDoor.polygon.length }), { x: 0, y: 0 })
        emitBoardFx({ kind: 'DOOR', factionId: t.factionId, to: middle, label: '门 · +1″', durationMs: 850 })
      }
      if (targetHeight !== (active.height ?? 0)) pushLog('turn', `${t.name} ${targetHeight > (active.height ?? 0) ? '攀爬上高台' : '从高台跳落'}：${active.height ?? 0}″ → ${targetHeight}″`)
      setPreviewPosition(null)
    }
    if (!r.ok) { setIntercept({ title: '行动不可用', reasons: [r.reason ?? '未知'] }); return }
    setPendingMove(null); setMoveOrigin(null); setMovePreview(false); setDestinationHeight(0); setMoveRoute(null)
  }
  function cancelMove() {
    setPreviewPosition(null)
    setPendingMove(null); setMoveOrigin(null); setMovePreview(false); setDestinationHeight(0); setMoveRoute(null)
  }
  /** 选移动行动：切换行动时先把上一次预览回退到真实起点，避免累计距离。 */
  function pickMove(a: ActionType) {
    setPendingAttack(null)
    const truePos = movePreview && moveOrigin ? moveOrigin : active?.pos ?? null
    if (pendingMove === a) { // 再点当前行动 → 取消（回退预览）
      setPreviewPosition(null)
      setPendingMove(null); setMoveOrigin(null); setMovePreview(false); setMoveRoute(null)
      return
    }
    setPreviewPosition(null); setMoveRoute(null) // 切换：回退旧预览
    const isMapless = useMatchStore.getState().maplessMode
    setMoveOrigin(truePos); setMovePreview(Boolean(isMapless)); setPendingMove(a); setDestinationHeight(active?.height ?? 0)
  }

  if (!mapPack && !maplessMode) return <div className="empty-state">请先在对局页面选择战场。</div>
  return (
    <div className="play-view">
      <StatusStrip prompt={promptStr} isError={!!intercept} onConfirm={confirmCasualties} onQueryRule={onQueryRule} onEndTP={() => scoreAndEndTP()} />
      {!maplessMode && <p className="map-mode-indicator">{heightMode === 'elevation' ? '高低差已启用 · 按立体地图裁定射击' : '统一高度 · 所有单位按同一高度裁定'}{heightMode === 'elevation' && active && <strong className="selected-height-readout">当前选中：{active.name} · {(active.height ?? 0) > 0 ? '上层' : '地面'} {active.height ?? 0}″</strong>}<span>门可通行；隔门近战待实现，现由玩家裁定</span></p>}
      <VolkusTerrainPanel mapId={mapPack?.mapId ?? null} />
      {!maplessMode && <BoardLegend />}
      {showViz && <FindingStrip active={active!} targets={viz.targets} />}
      {lastShot && (() => {
        const attacker = tokens.find(t => t.uid === lastShot.attackerUid)
        const defender = tokens.find(t => t.uid === lastShot.targetUid)
        if (!attacker || !defender) return null

        const atkPortrait = {
          name: attacker.name,
          maxWounds: attacker.maxWounds,
          currentWounds: attacker.wounds,
          statuses: attacker.markers,
          themeColorRgb: packOfFaction(attacker.factionId)?.faction.theme?.ui?.primaryRgb || '255, 90, 0',
          avatarUrl: getAvatarUrl(attacker.factionId, attacker.opId),
          onClick: () => setShowDataCardUid(attacker.uid)
        }

        const defPortrait = {
          name: defender.name,
          maxWounds: defender.maxWounds,
          currentWounds: defender.wounds,
          statuses: defender.markers,
          themeColorRgb: packOfFaction(defender.factionId)?.faction.theme?.ui?.primaryRgb || '92, 255, 140',
          avatarUrl: getAvatarUrl(defender.factionId, defender.opId),
          onClick: () => setShowDataCardUid(defender.uid)
        }

        return (
          <DamageResolutionPanel
            attackerPortrait={atkPortrait}
            defenderPortrait={defPortrait}
            atkNats={lastShot.atkNats}
            defNats={lastShot.defNats}
            atkRolls={lastShot.atkRolls}
            defRolls={lastShot.defRolls}
            initialAtkDamage={lastShot.attackerWoundsDealt || 0}
            initialDefDamage={lastShot.woundsDealt}
            onConfirm={(res) => {
              useMatchStore.getState().confirmCasualties({
                targetWoundsDealt: res.defDamage,
                attackerWoundsDealt: res.atkDamage,
                targetMarkers: res.defMarkers,
                attackerMarkers: res.atkMarkers
              })
            }}
            onCancel={undoPending}
          />
        )
      })()}
      {pushMsg && (
        <div className="push-banner">
          {pushMsg}
          <button className="link-btn" onClick={() => setPushMsg(null)}>✕</button>
        </div>
      )}

      <div className="play-main">
        {/* Left Column: Team A */}
        <div className="play-left-col">
          <UnitPanel sideFilter="a" startWoundsOf={(uid) => tokens.find((t) => t.uid === uid)?.maxWounds ?? 1} onPortraitClick={(uid) => setShowDataCardUid(uid)} actionBarProps={!maplessMode && turn.activePlayer === 'a' ? actionBarProps : undefined} />
        </div>

        {/* Center Column: Board, Actions, Logs */}
        <div className="play-center-col" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* TOP AREA: Active Op & Stratagems */}
          <div className="play-mid-col" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <StratagemPanel />
                {active && <WeaponPicker uid={active.uid} />}
              </div>
            </div>
          </div>

          {/* MID AREA: Board (or Hidden for maplessMode) */}
          <div className="play-board-col" style={{ flex: 1, minHeight: maplessMode ? 0 : '400px', display: 'flex', flexDirection: 'column' }}>
            {maplessMode ? (
              <ActiveOperativeFocus
                active={activated ? active : null}
                actionBarProps={actionBarProps}
                effectiveMoveOf={effectiveMoveOf}
                effectiveAplOf={effectiveAplOf}
              />
            ) : (
              <>
                {heightMode === 'elevation' && pendingAttack === 'SHOOT' && active && <div className="elevation-target-preview" aria-live="polite">
                  <span className="elevation-preview-title">射击高度预览</span>
                  <span>{active.name} <b>{(active.height ?? 0) > 0 ? '上层' : '地面'} {active.height ?? 0}″</b></span>
                  <span className="elevation-preview-arrow">{hoverTarget ? (hoverTarget.height ?? 0) > (active.height ?? 0) ? '↗' : (hoverTarget.height ?? 0) < (active.height ?? 0) ? '↘' : '→' : '→'}</span>
                  <span>{hoverTarget ? <>{hoverTarget.name} <b>{(hoverTarget.height ?? 0) > 0 ? '上层' : '地面'} {hoverTarget.height ?? 0}″</b></> : '悬停目标查看高度，点击射击'}</span>
                </div>}
                <div
                  ref={viewportRef}
                  className="board-viewport"
                  style={{ flex: 1 }}
                  onTouchStart={(e) => {
                    if (e.touches.length >= 2) { setInteracting(true); setDragging(null) /* P4：双指取消 token 拖 */ }
                  }}
                  onTouchEnd={(e) => { if (e.touches.length === 0) { lastPinchDist.current = 0; setInteracting(false) } /* P7：仅全指松开才清 */ }}
                  onTouchCancel={() => { lastPinchDist.current = 0; setInteracting(false) /* P6：OS 取消 */ }}
                >
                  <div style={{ transform: `scale(${viewport.scale})`, transformOrigin: '0 0' }}>
                    <Board
                      mapPack={mapPack!}
                      showPlatforms={heightMode === 'elevation'}
                      shotFocus={heightMode === 'elevation' && pendingAttack === 'SHOOT'}
                      shotTargetUid={hoverTargetUid}
                      terrain={mapPack!.terrain}
                      tokens={tokens.map(t => previewPosition?.uid === t.uid ? {...t,pos:previewPosition.pos,height:destinationHeight} : t)}
                      objectives={mapPack!.objectives}
                      phase="play"
                      selected={selected}
                      rangeRing={rangeRing}
                      movementReach={planarReach?.cells}
                      movementPath={moveRoute ? { points: moveRoute.path, valid: moveRoute.ok } : null}
                      controlRing={controlRing}
                      ownCover={ownCover}
                      losLines={losLines}
                      objControl={objControl}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerLeave={onPointerUp}
                      onTokenPointerDown={(t) => {
                        if (t.side !== turn.activePlayer) return
                        setSelected(t.uid)
                        setIntercept(null)
                        // #4：移动需先激活；#7：需先在行动菜单选移动行动
                        if (!activated || t.uid !== active?.uid) { setIntercept({ title: '未激活', reasons: ['先激活该特工才能移动'] }); return }
                        if (!pendingMove) { setIntercept({ title: '未选行动', reasons: ['先在行动菜单选 转移/冲刺/后撤/冲锋'] }); return }
                        setDragging(t.uid, t.pos)
                      }}
                      onTokenHover={(uid) => setHoverTargetUid(uid && tokens.some(t => t.uid === uid && t.side !== active?.side) ? uid : null)}
                      onTokenDoubleClick={(t) => rotateToken(t.uid)}
                      onTokenClick={onClickToken}
                    />
                  </div>
                </div>
                {(hoverInch || moveRoute) && <div className="inch-readout">{hoverInch ?? `${moveRoute!.ok ? '✓ 可达' : '× 不可达'} · 路径消耗 ${moveRoute!.cost}/${active && pendingMove ? actionMaxDist(active.uid, pendingMove) : 0}″${moveRoute!.reason ? ` · ${moveRoute!.reason}` : ''}`}</div>}
                {heightMode === 'elevation' && pendingMove && active && <div className="elevation-move-picker" aria-label="移动目标高度">
                  <span>目标高度 · 当前 {active.height ?? 0}″</span>
                  {[0, ...new Set(mapPack?.platforms?.map(p => p.height) ?? [])].map(height => <button key={height} type="button" disabled={pendingMove === 'DASH' && height > (active.height ?? 0)} className={destinationHeight === height ? 'selected' : ''} onClick={() => { setDestinationHeight(height); if (height !== (active.height ?? 0)) setMovePreview(true) }}>{height === 0 ? '地面 0″' : `高台 ${height}″`}</button>)}
                  <small>攀爬计入移动距离；冲刺不能攀爬。当前地图标注了要塞首层和大型废墟上层；要塞 B 的最高层与火力台仍按实物现场裁定。</small>
                </div>}
                <p className="muted" style={{ margin: '4px 0 0 0' }}>激活 → 选命令 → 选移动行动 → 拖特工到绿色可达区域；路径会自动绕墙并计费 · 射击/近战点敌方目标 · 双击旋转</p>
              </>
            )}
          </div>
          {/* BOT AREA: Logs (Mini View) */}
          <div 
            style={{ flexShrink: 0, background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => setShowFullLog(true)}
            title="点击查看完整历史"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#aaa' }}>最近历史记录 (点击展开)</span>
              <span style={{ fontSize: '0.8rem', color: '#666' }}>▴</span>
            </div>
            {latestLog ? (
              <div style={{ fontSize: '0.9rem', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span className={`log-kind ${latestLog.kind}`} style={{ marginRight: '8px' }}>{latestLog.kind}</span>
                {latestLog.text}
              </div>
            ) : (
              <div style={{ fontSize: '0.9rem', marginTop: '4px', color: '#666' }}>暂无记录</div>
            )}
          </div>
        </div>

        {/* Right Column: Team B */}
        <div className="play-right-col">
          <UnitPanel sideFilter="b" startWoundsOf={(uid) => tokens.find((t) => t.uid === uid)?.maxWounds ?? 1} onPortraitClick={(uid) => setShowDataCardUid(uid)} actionBarProps={!maplessMode && turn.activePlayer === 'b' ? actionBarProps : undefined} />
        </div>
      </div>

      {showFullLog && (
        <div className="overlay-backdrop" style={{ zIndex: 9000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowFullLog(false)}>
          <div style={{ background: '#1e1e1e', padding: '16px', borderRadius: '8px', width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>完整历史记录</h3>
              <button className="link-btn" onClick={() => setShowFullLog(false)} style={{ fontSize: '1.2rem' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <LogPanel onReplay={replayLast} onRollbackToHere={rewindLast} />
            </div>
          </div>
        </div>
      )}

      {pendingAsk && (
        <div className="chips-ask">
          <span>{pendingAsk.attacker.name} 控制范围内有 {pendingAsk.target.name}：</span>
          <button className="primary" onClick={() => { const { attacker, target } = pendingAsk; setPendingAsk(null); runKind(attacker, target, 'SHOOT') }}>射击 ▸</button>
          <button className="primary" onClick={() => { const { attacker, target } = pendingAsk; setPendingAsk(null); runKind(attacker, target, 'MELEE') }}>近战 ▸</button>
          <button onClick={() => setPendingAsk(null)}>取消</button>
        </div>
      )}
      {pendingTerrainChoice && (
        <div className="overlay-backdrop" style={{ zIndex: 9998, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.74)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div role="dialog" aria-modal="true" aria-label="选择地形效果" style={{ maxWidth: 440, padding: 24, borderRadius: 12, background: '#1d2423', border: '1px solid #a89969' }}>
            <h3>防守方选择地形效果</h3>
            <p>{pendingTerrainChoice.target.name} 从同一块重型地形获得掩护和遮蔽。规则要求此射击序列只选其中一项。</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {(['COVER', 'OBSCURED'] as const).map(choice => <button className="primary" key={choice} onClick={() => {
                const { attacker, target } = pendingTerrainChoice
                useMatchStore.getState().setOverride(`${attacker.uid}>${target.uid}>TERRAIN_CHOICE`, choice)
                setPendingTerrainChoice(null)
                runKind(attacker, target, 'SHOOT')
              }}>{choice === 'COVER' ? '选择掩护' : '选择遮蔽'}</button>)}
              <button onClick={() => setPendingTerrainChoice(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
      {combatCollect && (
        <div className="overlay-backdrop" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', background: '#111', padding: '0', borderRadius: '12px', border: '1px solid #333', boxShadow: '0 10px 40px rgba(0,0,0,0.8)', width: '95vw', maxWidth: '1000px', height: '95vh', maxHeight: '900px', display: 'flex', flexDirection: 'column' }}>
            {heightMode === 'elevation' && !maplessMode && combatCollect.kind === 'SHOOT' && <div className="combat-elevation-banner">
              <span>{combatCollect.attacker.name} · {(combatCollect.attacker.height ?? 0) > 0 ? '上层' : '地面'} {combatCollect.attacker.height ?? 0}″</span>
              <strong>{(combatCollect.target.height ?? 0) > (combatCollect.attacker.height ?? 0) ? '↗' : (combatCollect.target.height ?? 0) < (combatCollect.attacker.height ?? 0) ? '↘' : '→'} 高差 {Math.abs((combatCollect.target.height ?? 0) - (combatCollect.attacker.height ?? 0))}″</strong>
              <span>{combatCollect.target.name} · {(combatCollect.target.height ?? 0) > 0 ? '上层' : '地面'} {combatCollect.target.height ?? 0}″</span>
            </div>}
            <CombatResolver
              mode={combatCollect.kind}
              attackerName={combatCollect.attacker.name}
              attackerPortrait={{
                name: combatCollect.attacker.name,
                maxWounds: combatCollect.attacker.maxWounds,
                currentWounds: combatCollect.attacker.wounds,
                statuses: combatCollect.attacker.markers,
                themeColor: `rgb(${packOfFaction(combatCollect.attacker.factionId)?.faction.theme?.ui?.primaryRgb || '255, 90, 0'})`,
                themeColorRgb: packOfFaction(combatCollect.attacker.factionId)?.faction.theme?.ui?.primaryRgb || '255, 90, 0',
                avatarUrl: getAvatarUrl(combatCollect.attacker.factionId, combatCollect.attacker.opId),
                scale: 2,
                onClick: () => setShowDataCardUid(combatCollect.attacker.uid)
              }}
              attackerCount={combatCollect.atkCount}
              attackerRetainedDice={combatCollect.atkRetainedDice}
              attackerContext={combatCollect.atkContext}
              attackerTheme={combatCollect.atkTheme}
              attackerDamage={(combatCollect as any).atkDamage}
              defenderName={combatCollect.target.name}
              defenderPortrait={{
                name: combatCollect.target.name,
                maxWounds: combatCollect.target.maxWounds,
                currentWounds: combatCollect.target.wounds,
                statuses: combatCollect.target.markers,
                themeColor: `rgb(${packOfFaction(combatCollect.target.factionId)?.faction.theme?.ui?.primaryRgb || '92, 255, 140'})`,
                themeColorRgb: packOfFaction(combatCollect.target.factionId)?.faction.theme?.ui?.primaryRgb || '92, 255, 140',
                avatarUrl: getAvatarUrl(combatCollect.target.factionId, combatCollect.target.opId),
                scale: 2,
                onClick: () => setShowDataCardUid(combatCollect.target.uid)
              }}
              defenderCount={combatCollect.defCount}
              defenderContext={combatCollect.defContext}
              defenderTheme={combatCollect.defTheme}
              defenderDamage={(combatCollect as any).defDamage}
              defenderModifiers={(combatCollect as any).defModifiers}
              defenderRetainedDice={(combatCollect as any).defRetainedDice}
              rollMode={diceSource === 'electronic' ? 'AUTO' : 'MANUAL'}
              onComplete={(result) => {
                const { attacker, target, kind } = combatCollect
                setCombatCollect(null)
                const r = resolveAttack({
                  attackerUid: attacker.uid,
                  targetUid: target.uid,
                  kind,
                  atkNats: result.atkNats,
                  defNats: result.defNats,
                  atkRolls: result.atkRolls,
                  defRolls: result.defRolls,
                  manualAllocation: result.manualAllocation
                })
                useMatchStore.getState().clearOverride(`${attacker.uid}>${target.uid}>TERRAIN_CHOICE`)
                if (!r.ok) setIntercept({ title: '结算失败', reasons: r.missing ?? [] })
                else if (!maplessMode) {
                  const shot = useMatchStore.getState().lastShot
                  const attackRolls = result.atkRolls ?? []
                  const miss = kind === 'SHOOT' && attackRolls.length > 0 && attackRolls.every(roll => roll.grade === 'FAIL')
                  emitBoardFx({ kind: kind === 'SHOOT' ? 'SHOT' : 'MELEE', factionId: attacker.factionId, from: attacker.pos, to: target.pos, miss, label: miss ? '射偏' : shot?.woundsDealt ? `待确认 −${shot.woundsDealt}` : '未造成伤害', durationMs: 900 })
                }
              }}
              onCancel={() => {
                useMatchStore.getState().clearOverride(`${combatCollect.attacker.uid}>${combatCollect.target.uid}>TERRAIN_CHOICE`)
                undoAction()
                setCombatCollect(null)
              }}
            />
          </div>
        </div>
      )}

      {/* Operative Card Modal */}
      {showDataCardUid && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowDataCardUid(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '95vw', maxWidth: '900px', height: '95vh', maxHeight: '900px', display: 'flex', flexDirection: 'column', borderRadius: '12px' }}>
            {(() => {
              const dmData = getMatchOperativeData(showDataCardUid)
              if (!dmData) return null
              
              const { operative, pack: opPack, token: opToken, weapons } = dmData
              const uiTheme = opPack.faction.theme?.ui || { primaryRgb: '255, 90, 0', textHighlight: '#ffaa77' }
              
              // Use equipped weapons
              const avatarUrl = getAvatarUrl(opPack.faction.id, opToken.opId)
              return (
                <div style={{ height: '100%', '--theme-primary-rgb': uiTheme.primaryRgb, '--theme-text-highlight': uiTheme.textHighlight } as React.CSSProperties}>
                  <OperativeCard 
                    operative={operative} 
                    pack={{ ...opPack, weapons }} // Pass the overridden weapons array via pack to the card
                    selectedWeaponIds={opToken.weapons || []} 
                    factionRuleSelections={Object.fromEntries((opPack.factionRules ?? []).map(rule => [rule.ruleId, selectedRuleOptions(opToken.selections ?? [])]))}
                    avatarUrl={avatarUrl}
                  />
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Dungeon Master Modal */}
      {showDungeonMaster && (
        <DungeonMasterOverlay onClose={() => setShowDungeonMaster(false)} />
      )}

      {/* Dungeon Master Floating Button */}
      <button 
        className="dm-floating-btn" 
        onClick={() => setShowDungeonMaster(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(255, 68, 68, 0.4)',
          zIndex: 9000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        title="Dungeon Master Mode"
      >
        🎲
      </button>

      {maplessMode && pendingAttack && active && (
        <TargetSelectionModal
          attackerUid={active.uid}
          kind={pendingAttack === 'FIGHT' ? 'MELEE' : 'SHOOT'}
          heightOnly={!maplessMode}
          initialTargetUid={null}
          onClose={() => { setPendingAttack(null) }}
          onConfirm={(targetUid) => {
            const t = tokens.find((x) => x.uid === targetUid)
            if (t) {
              setPendingAttack(null)
              runKind(active, t, pendingAttack === 'FIGHT' ? 'MELEE' : 'SHOOT')
            }
          }}
        />
      )}
    </div>
  )
}

// 简化对局：中央「激活前空态」。显示行动号召，引导玩家激活特工。
function SimpleMatchEmptyState() {
  const tokens = useMatchStore((s) => s.tokens)
  const turn = useMatchStore((s) => s.turn)

  const activeSide = turn.activePlayer
  const activePack = activeSide ? packOfFaction(tokens.find((t) => t.side === activeSide)?.factionId ?? '') : null
  const activeRgb = activePack?.faction.theme?.ui?.primaryRgb || '160, 160, 160'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <div style={{
        width: '100%', maxWidth: '420px', padding: '20px 24px', borderRadius: '8px', textAlign: 'center',
        background: `rgba(${activeRgb}, 0.1)`, border: `1px solid rgba(${activeRgb}, 0.5)`,
      }}>
        <div style={{ fontSize: '0.78rem', color: '#aaa', marginBottom: '6px' }}>第 {turn.turningPoint} 转折点</div>
        {activeSide ? (
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: `rgb(${activeRgb})`, textShadow: `0 0 8px rgba(${activeRgb}, 0.4)` }}>
            轮到 {activeSide.toUpperCase()} 方激活
          </div>
        ) : (
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ccc' }}>准备激活特工</div>
        )}
        <div style={{ fontSize: '0.9rem', color: '#bbb', marginTop: '10px', lineHeight: 1.6 }}>
          在两侧面板选择一名特工并点击「激活该特工 ▶」，<br/>其数据与行动菜单将显示在此。
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: '#777', textAlign: 'center' }}>
        简化对局模式 · 无需地图 · 攻击时将弹出目标选择窗口
      </div>
    </div>
  )
}

// 简化对局：中央「激活特工聚焦面板」。替代原地图占位，显示当前激活特工的核心属性 + 行动菜单。
function ActiveOperativeFocus({
  active,
  actionBarProps,
  effectiveMoveOf,
  effectiveAplOf,
}: {
  active: MatchToken | null
  actionBarProps: any
  effectiveMoveOf: (uid: string) => number
  effectiveAplOf: (uid: string) => number
}) {
  if (!active) {
    return <SimpleMatchEmptyState />
  }

  const pack = packOfFaction(active.factionId)
  const uiTheme = pack?.faction.theme?.ui || { primaryRgb: '255, 90, 0' }
  const themeRgb = uiTheme.primaryRgb
  const themeColor = `rgb(${themeRgb})`
  const avatarUrl = getAvatarUrl(active.factionId, active.opId)
  const save = getMatchOperativeData(active.uid)?.operative.stats.save

  const hpPercent = Math.max(0, Math.min(100, (active.wounds / (active.maxWounds || 1)) * 100))
  let hpColor = '#4ade80'
  if (hpPercent <= 30) hpColor = '#ef4444'
  else if (hpPercent <= 60) hpColor = '#facc15'

  const stats: { label: string; value: string; color?: string }[] = [
    { label: 'M', value: `${effectiveMoveOf(active.uid)}"` },
    { label: 'APL', value: `${effectiveAplOf(active.uid)}` },
    { label: 'SV', value: save != null ? `${save}+` : '—' },
    { label: 'W', value: `${active.wounds}/${active.maxWounds}`, color: hpColor },
  ]

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px',
      backgroundColor: 'var(--bg-panel)', borderRadius: '8px',
      border: `2px solid rgb(${themeRgb})`,
      boxShadow: `0 0 15px rgba(${themeRgb}, 0.35), inset 0 0 12px rgba(${themeRgb}, 0.12)`,
    }}>
      {/* Header: avatar + name + status markers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: `1px solid rgba(${themeRgb}, 0.6)`, background: 'rgba(0,0,0,0.3)' }}>
          {avatarUrl
            ? <img src={avatarUrl} alt={active.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>👤</div>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, color: themeColor, textShadow: `0 0 8px rgba(${themeRgb}, 0.5)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{active.name}</h3>
          {active.markers && active.markers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
              {active.markers.map((m) => (
                <span key={m} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', color: '#ccc' }}>{m}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stat line: M / APL / SV / W */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {stats.map((s) => (
          <div key={s.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: `1px solid rgba(${themeRgb}, 0.25)` }}>
            <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: s.color || '#fff', lineHeight: 1.1 }}>{s.value}</span>
            <span style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '2px', letterSpacing: '0.05em' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Action menu */}
      <ActionBar {...actionBarProps} themeColor={themeColor} />
    </div>
  )
}

// 1.14 T5：几何 finding 内联翻转（D-24）— 读 store 算的 LOS，翻转写 store.setOverride。
function FindingStrip({
  active,
  targets,
}: {
  active: MatchToken
  targets: { uid: string; pos: Point; losFinal: boolean; losAmbiguous: boolean; obscured: boolean; cover: boolean; shootable: boolean; reasons: string[] }[]
}) {
  const setOverride = useMatchStore((s) => s.setOverride)
  const clearOverride = useMatchStore((s) => s.clearOverride)
  const overrideValue = useMatchStore((s) => s.overrideValue)
  const tokens = useMatchStore((s) => s.tokens)

  if (targets.length === 0) return null
  return (
    <div className="finding-strip">
      {targets.slice(0, 4).map((tg) => {
        const tok = tokens.find((t) => t.uid === tg.uid)
        if (!tok) return null
        const key = `${active.uid}>${tg.uid}>LOS`
        const ov = overrideValue(active.uid, tg.uid, 'LOS')
        const overridden = ov !== undefined
        const displayed = ov ?? tg.losFinal
        return (
          <button
            key={tg.uid}
            className={`chip finding ${tg.losAmbiguous ? 'ambiguous' : ''} ${overridden ? 'flipped' : ''}`}
            onClick={() => (overridden ? clearOverride(key) : setOverride(key, !displayed))}
            title={`${tg.reasons.length ? tg.reasons.join('；') : '目标资格通过'}。点击可翻转视线判定。`}
          >
            {tg.losAmbiguous ? '⚠ ' : ''}{tok.name} · {tg.shootable ? '可选目标' : '不可选'} · {displayed ? '可见' : '阻挡'}{tg.cover ? ' · 掩护' : ''}{tg.obscured ? ' · 遮蔽' : ''}{overridden ? ' ⟲' : ''}
          </button>
        )
      })}
    </div>
  )
}

function WeaponPicker({ uid }: { uid: string }) {
  const data = getMatchOperativeData(uid)
  const setWeapon = useMatchStore(s => s.setCombatWeapon)
  const pending = useMatchStore(s => s.lastShot)
  if (!data) return null
  return <div className="weapon-picker"><span className="muted">{data.token.name} · 本次武器</span>{(['RANGED','MELEE'] as const).map(kind => {
    const list = data.weapons.filter(w => w.kind === kind)
    const manual = playerRulingRules(combatWeapon(uid, kind)?.profile.weaponRules ?? [])
    return list.length ? <label key={kind}>{kind === 'RANGED' ? '射击' : '近战'}<select aria-label={kind === 'RANGED' ? '射击武器' : '近战武器'} disabled={!!pending} value={combatWeapon(uid, kind)?.weaponId} onChange={e => setWeapon(uid,kind,e.target.value)}>{list.map(w => <option key={w.weaponId} value={w.weaponId}>{w.name} · {w.profile.attacks}骰 / {w.profile.hit}+</option>)}</select>{manual.length > 0 && <small>本武器的 {manual.join('、')} 效果请按规则由玩家裁定。</small>}</label> : null
  })}</div>
}

function selectedRuleOptions(ids: string[]) {
  const aliases: Record<string,string> = {chapterTactic_relentless:'tactic_aggressive',chapterTactic_duelist:'tactic_dueller',chapterTactic_resolute:'tactic_resolute',chapterTactic_concealed:'tactic_stealthy',chapterTactic_mobile:'tactic_mobile',chapterTactic_stalwart:'tactic_hardy',chapterTactic_sharpshooter:'tactic_sharpshooter',chapterTactic_siege:'tactic_siege_specialist'}
  return ids.map(id => aliases[id] ?? id)
}
