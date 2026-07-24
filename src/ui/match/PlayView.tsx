import { useState, useRef, useEffect } from 'react'
import { RulesQuery, useRulesQuery } from './RulesQuery'
import { DungeonMasterOverlay } from '../components/DungeonMaster/DungeonMasterOverlay'
import { useMatchStore, getMatchOperativeData, type MatchToken } from '../../state/matchStore'
import type { ActionType } from '../../state/turnStateMachine'
import { circlesOverlap, circleHitsBlockingTerrain, type Point } from '../../geometry'
import { Board, type LosLine, type ObjControl } from './Board'
import { StatusStrip } from './StatusStrip'
import { UnitPanel } from './UnitPanel'
import { PipelineDrawer } from './PipelineDrawer'
import { LogPanel } from './LogPanel'
import { InterceptorCard } from './InterceptorCard'
import { CombatResolver } from '../components/Combat/CombatResolver'
import { UnitPortrait } from '../components/UnitPortrait/UnitPortrait'
import { OperativeCard } from '../components/OperativeCard/OperativeCard'
import { TargetSelectionModal } from './TargetSelectionModal'
import { StratagemPanel } from './StratagemPanel'
import { packOfOp, packOfFaction, weaponOfPack } from '../../state/matchStore'
import { getAvatarUrl } from '../../utils/avatars'
import { DamageResolutionPanel } from '../components/Combat/DamageResolutionPanel'
import { type RollContext } from '../../dice/source'

// 对局主界面（1.13-1.16）。AR-9：UI 只 dispatch intent + 读 store，不直接调引擎/几何/骰源。
// 一击结算经 matchStore.resolveAttack；几何可视化经 store.attackViz；翻转经 store.setOverride。

function clampPos(p: Point): Point {
  const b = useMatchStore.getState().mapPack?.bounds ?? { w: 30, h: 20 }
  return { x: Math.max(0.5, Math.min(b.w - 0.5, p.x)), y: Math.max(0.5, Math.min(b.h - 0.5, p.y)) }
}

export function PlayView({ onQueryRule }: { onQueryRule: (hint: string) => void }) {
  const mapPack = useMatchStore((s) => s.mapPack)
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
  const zoomAt = useMatchStore((s) => s.zoomAt)
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
  const intercept = useMatchStore((s) => s.intercept)
  const pushLog = useMatchStore((s) => s.pushLog)
  const lastShot = useMatchStore((s) => s.lastShot)
  const attackViz = useMatchStore((s) => s.attackViz)
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
    defCount: number;
    defContext: any;
    defTheme: any
    defDamage?: { normal: number, critical: number }
    defSave: number;
    defWounds: number;
  } | null>(null)
  const [hoverInch, setHoverInch] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<ActionType | null>(null)
  const [pendingAttack, setPendingAttack] = useState<'SHOOT' | 'FIGHT' | null>(null)
  const [moveOrigin, setMoveOrigin] = useState<Point | null>(null) // 移动起点（arm 时捕获，confirm/cancel 前不变）
  const [movePreview, setMovePreview] = useState<boolean>(false) // 拖动后待确认
  const [showDataCardUid, setShowDataCardUid] = useState<string | null>(null)
  const [showDungeonMaster, setShowDungeonMaster] = useState(false)
  const [showFullLog, setShowFullLog] = useState<boolean>(false)

  const active = tokens.find((t) => t.uid === selected) ?? null
  const selectedOp = active ? turn.operatives[active.uid] : undefined
  const activated = active ? turn.activeOpId === active.uid : false
  const canSelect = active ? active.side === turn.activePlayer : false

  const promptStr = intercept
    ? `⚠️ ${intercept.title}：${intercept.reasons.join(', ')}`
    : !active
      ? `轮到 ${turn.activePlayer.toUpperCase()}：点一名己方特工`
      : !canSelect
        ? `选中了${active.side === 'a' ? 'A' : 'B'}方特工（仅查看）；请激活 ${turn.activePlayer.toUpperCase()} 方`
        : !activated
          ? `${active.name}：先激活才能行动`
          : pendingMove
            ? `${active.name} · ${pendingMove === 'MOVE' ? '转移' : pendingMove === 'DASH' ? '冲刺' : pendingMove === 'FALL_BACK' ? '后撤' : '冲锋'} 已选：拖拽特工移动（再点取消）`
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
    order: selectedOp?.order ?? null,
    apl,
    apUsed: selectedOp?.apUsed ?? 0,
    canDo,
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
      if (movePreview && active && moveOrigin) moveToken(active.uid, moveOrigin)
      setPendingAttack((prev) => (prev === k ? null : k))
      setPendingMove(null); setMoveOrigin(null); setMovePreview(false)
    },
    onUndoAction: () => undoAction(),
    canUndoAction: activationUndo.length > 0,
    onEndActivation: () => { 
      if (active) { 
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
    const m = effectiveMoveOf(uid)
    if (action === 'DASH') return 3
    if (action === 'CHARGE') return m + 2
    return m // MOVE / FALL_BACK
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
  const moveRing = active && pendingMove && moveOrigin ? { center: moveOrigin, r: actionMaxDist(active.uid, pendingMove) } : null
  const rangeRing = moveRing ?? (showViz ? { center: active!.pos, r: viz.range } : null)
  const controlRing = viz.controlRing
  const ownCover = viz.ownCover
  const losLines: LosLine[] = viz.targets.map((tg) => {
    const tok = tokens.find((t) => t.uid === tg.uid)
    if (!tok) return null
    return {
      target: tg.pos,
      stroke: tg.obscured ? '#6b7280' : tg.losFinal ? '#39d98a' : '#ff5c5c',
      dash: tg.obscured ? '2 4' : tg.losAmbiguous ? '4 3' : 'none',
      opacity: tg.obscured ? 0.4 : 0.7,
    }
  }).filter((x): x is LosLine => x !== null)

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
    // 预校验射程和LOS，如果超出射程，不弹骰子界面直接提示且不扣除AP
    const legality = useMatchStore.getState().checkAttackLegality({ attackerUid: attacker.uid, targetUid: target.uid, kind })
    if (!legality.ok) {
      setIntercept({ title: '无法攻击', reasons: legality.missing ?? [] })
      return
    }

    // 行动消费 AP（SHOOT→SHOOT，MELEE→FIGHT）；不通过则拦截
    const actR = doAction(attacker.uid, kind === 'SHOOT' ? 'SHOOT' : 'FIGHT')
    if (!actR.ok) { setIntercept({ title: '行动不可用', reasons: [actR.reason ?? '未知'] }); return }

    // 获取攻击者的武器和属性，唤出 DiceInterface
    const atkData = getMatchOperativeData(attacker.uid)
    const atkPack = atkData?.pack
    const weapon = atkData?.weapons.find(w => w.kind === (kind === 'SHOOT' ? 'RANGED' : 'MELEE'))
    if (!weapon) { setIntercept({ title: '无武器', reasons: [`阵营包缺 ${kind} 武器`] }); return }

    const lethalRule = weapon.profile.weaponRules?.find((r: string) => r.startsWith('Lethal '))
    const critTarget = lethalRule ? parseInt(lethalRule.replace('Lethal ', '')) || 6 : 6;
    const context: RollContext = { hitTarget: weapon.profile.hit, critTarget }

    const defData = getMatchOperativeData(target.uid)
    const defPack = defData?.pack
    const defWeapon = defData?.weapons.find(w => w.kind === (kind === 'SHOOT' ? 'RANGED' : 'MELEE'))

    // 防御方数据准备 (近战时使用其武器；射击时防御方使用 save 值作为目标，防守骰数固定3或根据规则)
    const defCount = kind === 'SHOOT' ? 3 : (defWeapon?.profile.attacks ?? 0)
    let defContext: any = { hitTarget: 3, critTarget: 6 }
    if (kind === 'MELEE' && defWeapon) {
      const defLethal = defWeapon.profile.weaponRules?.find((r: string) => r.startsWith('Lethal '))
      const defCritTarget = defLethal ? parseInt(defLethal.replace('Lethal ', '')) || 6 : 6
      defContext = { hitTarget: defWeapon.profile.hit, critTarget: defCritTarget }
    } else if (kind === 'SHOOT') {
      defContext = { hitTarget: defData?.operative.stats.save || 3, critTarget: 6 }
    }

    let defModifiers: string[] = []
    let defRetainedDice: any[] = [] // Using any[] to bypass import DiceRoll issues if not imported, or just cast

    if (kind === 'SHOOT') {
      const coverType = useMatchStore.getState().overrideValue(attacker.uid, target.uid, 'COVER_TYPE')
      const isVantage = useMatchStore.getState().overrideValue(attacker.uid, target.uid, 'VANTAGE')
      const isObscured = useMatchStore.getState().overrideValue(attacker.uid, target.uid, 'OBSCURED')
      const atkFloor = useMatchStore.getState().overrideValue(attacker.uid, target.uid, 'ATTACKER_FLOOR') as number || 0
      const defFloor = useMatchStore.getState().overrideValue(attacker.uid, target.uid, 'DEFENDER_FLOOR') as number || 0

      if (isVantage) {
        const diff = atkFloor - defFloor
        const heightText = diff === 1 ? '1层/2"' : `${diff}层/${diff * 2}"`
        if (coverType === 'HEAVY') {
          defModifiers.push(`制高点 (高出 ${heightText}): 目标处于重型掩体中，制高点无法抵消掩护豁免和隐蔽(Conceal)状态。`)
        } else {
          defModifiers.push(`制高点 (高出 ${heightText}): 目标未受重型掩体保护，忽略其掩护豁免及隐蔽(Conceal)状态。`)
        }
      }
      
      const retainsCover = (coverType === 'HEAVY') || (coverType === 'LIGHT' && !isVantage)
      if (retainsCover) {
        defRetainedDice.push({ nat: defContext.hitTarget, grade: 'NORMAL', isRetained: true })
      }

      if (coverType === 'LIGHT') defModifiers.push(`轻微掩体 (Light Cover): 投骰前或投骰后，可保留1个普通掩护豁免。${retainsCover ? '已自动保留。' : '但被制高点抵消。'}`)
      if (coverType === 'HEAVY') defModifiers.push(`重型掩体 (Heavy Cover): 可保留1个普通掩护豁免。提供掩体同时能阻挡视线(Obscuring)。${retainsCover ? '已自动保留。' : ''}`)
      if (isObscured) defModifiers.push("遮挡 (Obscured): 目标通常不可被射击 (简化模式下强制允许)。")
    }

    setPendingAsk(null)
    setCombatCollect({
      attacker, target, kind,
      atkCount: weapon.profile.attacks,
      atkContext: context,
      atkTheme: atkPack?.faction.theme?.dice || { baseColor: '#1e1e1e', pipColor: '#e0e0e0' },
      atkDamage: { normal: weapon.profile.normalDamage, critical: weapon.profile.criticalDamage },
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
      // 硬 clamp 到「起点为圆心、行动最大距离为半径」的圆内（确认前可反复拖）
      const max = actionMaxDist(dragging, pendingMove)
      const dx = p.x - moveOrigin.x, dy = p.y - moveOrigin.y
      const dist = Math.hypot(dx, dy)
      const cl = dist > max ? { x: moveOrigin.x + (dx / dist) * max, y: moveOrigin.y + (dy / dist) * max } : p
      moveToken(dragging, clampPos(cl))
      setHoverInch(`${pendingMove === 'DASH' ? '冲刺' : pendingMove === 'CHARGE' ? '冲锋' : pendingMove === 'FALL_BACK' ? '后撤' : '转移'} ${Math.min(dist, max).toFixed(1)}/${max}"`)
    }
  }
  function onPointerUp() {
    if (dragging) {
      const t = tokens.find((x) => x.uid === dragging)
      if (t && moveOrigin && pendingMove) {
        const d = Math.hypot(t.pos.x - moveOrigin.x, t.pos.y - moveOrigin.y)
        if (d > 0.1) setMovePreview(true) // 待确认：不立即消费 AP，可再拖
      }
      setDragging(null)
      setHoverInch(null)
    }
  }
  // 确认移动：校验落点 → 消费 AP；失败回退到起点
  function confirmMove() {
    if (!active || !pendingMove || !moveOrigin) return
    const t = active
    const isMapless = useMatchStore.getState().maplessMode
    
    if (!isMapless) {
      if (pendingMove === 'CHARGE') {
        const inEng = tokens.some((e) => e.alive && e.placed && e.side !== t.side && Math.hypot(e.pos.x - t.pos.x, e.pos.y - t.pos.y) <= t.baseRadius + e.baseRadius + 1)
        if (!inEng) { setIntercept({ title: '冲锋非法', reasons: ['冲锋须结束在敌方 1" 控制范围内'] }); return }
      }
      const overlap = tokens.filter((o) => o.alive && o.placed && o.uid !== t.uid).find((o) => circlesOverlap(t.pos, t.baseRadius, o.pos, o.baseRadius))
      const wall = mapPack ? circleHitsBlockingTerrain(t.pos, t.baseRadius, mapPack.terrain) : false
      if (overlap || wall) {
        setIntercept({ title: overlap ? '与特工重叠' : '与墙体重叠', reasons: [`${t.name} ${overlap ? `与 ${overlap.name} 底座重叠` : '压在阻拦地形上'}`] })
        return
      }
    }

    const r = doAction(t.uid, pendingMove)
    if (!r.ok) { setIntercept({ title: '行动不可用', reasons: [r.reason ?? '未知'] }); return }
    setPendingMove(null); setMoveOrigin(null); setMovePreview(false)
  }
  function cancelMove() {
    if (active && moveOrigin) moveToken(active.uid, moveOrigin)
    setPendingMove(null); setMoveOrigin(null); setMovePreview(false)
  }
  /** 选移动行动：切换行动时先把上一次预览回退到真实起点，避免累计距离。 */
  function pickMove(a: ActionType) {
    setPendingAttack(null)
    const truePos = movePreview && moveOrigin ? moveOrigin : active?.pos ?? null
    if (pendingMove === a) { // 再点当前行动 → 取消（回退预览）
      if (movePreview && active && moveOrigin) moveToken(active.uid, moveOrigin)
      setPendingMove(null); setMoveOrigin(null); setMovePreview(false)
      return
    }
    if (movePreview && active && moveOrigin) moveToken(active.uid, moveOrigin) // 切换：回退旧预览
    const isMapless = useMatchStore.getState().maplessMode
    setMoveOrigin(truePos); setMovePreview(isMapless); setPendingMove(a)
  }

  return (
    <div className="play-view">
      <StatusStrip prompt={promptStr} isError={!!intercept} onConfirm={confirmCasualties} onQueryRule={onQueryRule} onEndTP={() => scoreAndEndTP()} />
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
          <UnitPanel sideFilter="a" startWoundsOf={(uid) => tokens.find((t) => t.uid === uid)?.maxWounds ?? 1} onPortraitClick={(uid) => setShowDataCardUid(uid)} actionBarProps={turn.activePlayer === 'a' ? actionBarProps : undefined} />
        </div>

        {/* Center Column: Board, Actions, Logs */}
        <div className="play-center-col" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* TOP AREA: Active Op & Stratagems */}
          <div className="play-mid-col" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <StratagemPanel />
              </div>
            </div>
          </div>

          {/* MID AREA: Board (or Hidden for maplessMode) */}
          <div className="play-board-col" style={{ flex: 1, minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
            {maplessMode ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                <p className="muted" style={{ textAlign: 'center' }}>
                  简化对局模式<br/>
                  无需地图。<br/>
                  在两侧面板选择单位，点击命令与行动进行测试。<br/>
                  攻击时将弹出目标选择窗口。
                </p>
              </div>
            ) : (
              <>
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
                      terrain={mapPack!.terrain}
                      tokens={tokens}
                      objectives={mapPack!.objectives}
                      phase="play"
                      selected={selected}
                      rangeRing={rangeRing}
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
                      onTokenDoubleClick={(t) => rotateToken(t.uid)}
                      onTokenClick={onClickToken}
                    />
                  </div>
                </div>
                {hoverInch && <div className="inch-readout">{hoverInch}</div>}
                <p className="muted" style={{ margin: '4px 0 0 0' }}>激活 → 选命令 → 选行动（转移/冲刺/…）→ 拖特工移动 · 射击/近战点敌方目标 · 双击旋转</p>
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
          <UnitPanel sideFilter="b" startWoundsOf={(uid) => tokens.find((t) => t.uid === uid)?.maxWounds ?? 1} onPortraitClick={(uid) => setShowDataCardUid(uid)} actionBarProps={turn.activePlayer === 'b' ? actionBarProps : undefined} />
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
      {combatCollect && (
        <div className="overlay-backdrop" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', background: '#111', padding: '0', borderRadius: '12px', border: '1px solid #333', boxShadow: '0 10px 40px rgba(0,0,0,0.8)', width: '95vw', maxWidth: '1000px', height: '95vh', maxHeight: '900px', display: 'flex', flexDirection: 'column' }}>
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
                if (!r.ok) setIntercept({ title: '结算失败', reasons: r.missing ?? [] })
              }}
              onCancel={() => {
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
                    factionRuleSelections={{}} 
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
          kind={pendingAttack}
          onClose={() => setPendingAttack(null)}
          onConfirm={(targetUid) => {
            const t = tokens.find((x) => x.uid === targetUid)
            if (t) {
              setPendingAttack(null)
              runKind(active, t, pendingAttack)
            }
          }}
        />
      )}
    </div>
  )
}

// 1.14 T5：几何 finding 内联翻转（D-24）— 读 store 算的 LOS，翻转写 store.setOverride。
function FindingStrip({
  active,
  targets,
}: {
  active: MatchToken
  targets: { uid: string; pos: Point; losFinal: boolean; losAmbiguous: boolean }[]
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
            title={tg.losAmbiguous ? '⚠ 可翻转（咨询式，1 击翻转假设，不弹框）' : 'CLEAR（可手动翻转）'}
          >
            {tg.losAmbiguous ? '⚠ ' : ''}{tok.name} LOS={displayed ? '可见' : '阻挡'}{overridden ? ' ⟲' : ''}
          </button>
        )
      })}
    </div>
  )
}
