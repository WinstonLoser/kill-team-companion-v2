import { useState, useRef, useEffect } from 'react'
import { useMatchStore, type MatchToken } from '../../state/matchStore'
import type { ActionType } from '../../state/turnStateMachine'
import { circlesOverlap, circleHitsBlockingTerrain, type Point } from '../../geometry'
import { Board, type LosLine, type ObjControl } from './Board'
import { StatusStrip } from './StatusStrip'
import { ActionBar } from './ActionBar'
import { UnitPanel } from './UnitPanel'
import { PipelineDrawer } from './PipelineDrawer'
import { LogPanel } from './LogPanel'
import { InterceptorCard } from './InterceptorCard'
import { CombatResolver } from '../components/Combat/CombatResolver'
import { UnitPortrait } from '../components/UnitPortrait/UnitPortrait'
import { StratagemPanel } from './StratagemPanel'
import { packOfOp, weaponOfPack } from '../../state/matchStore'
import { type RollContext } from '../../dice/source'

// 对局主界面（1.13-1.16）。AR-9：UI 只 dispatch intent + 读 store，不直接调引擎/几何/骰源。
// 一击结算经 matchStore.resolveAttack；几何可视化经 store.attackViz；翻转经 store.setOverride。

function clampPos(p: Point): Point {
  const b = useMatchStore.getState().mapPack?.bounds ?? { w: 30, h: 20 }
  return { x: Math.max(0.5, Math.min(b.w - 0.5, p.x)), y: Math.max(0.5, Math.min(b.h - 0.5, p.y)) }
}

export function PlayView({ onQueryRule }: { onQueryRule: (hint: string) => void }) {
  const mapPack = useMatchStore((s) => s.mapPack)!
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

  // P1：React onWheel 是 passive → preventDefault 失效。用 useEffect + addEventListener {passive:false}。
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])
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

  const active = tokens.find((t) => t.uid === selected) ?? null
  const selectedOp = active ? turn.operatives[active.uid] : undefined
  const activated = active ? Boolean(selectedOp?.ready) : false
  const apl = active ? effectiveAplOf(active.uid) : 0
  // 各行动合法性（激活后才需算）
  const canDo = (() => {
    const z: Record<ActionType, boolean> = { MOVE: false, DASH: false, FALL_BACK: false, CHARGE: false, SHOOT: false, FIGHT: false }
    if (active && activated) (['MOVE', 'DASH', 'FALL_BACK', 'CHARGE', 'SHOOT', 'FIGHT'] as ActionType[]).forEach((a) => { z[a] = checkAction(active.uid, a).ok })
    return z
  })()

  /** 行动最大移动距离（英寸）。 */
  function actionMaxDist(uid: string, action: ActionType): number {
    const m = effectiveMoveOf(uid)
    if (action === 'DASH') return 3
    if (action === 'CHARGE') return m + 2
    return m // MOVE / FALL_BACK
  }

  // ===== 目标控制（1.16）— 读 store.controlOf（P7：store 当下 tokens） =====
  const objControl: ObjControl[] = mapPack.objectives.map((o) => {
    const nA = tokens.filter((t) => t.alive && t.placed && t.side === 'a' && Math.hypot(t.pos.x - o.pos.x, t.pos.y - o.pos.y) <= o.controlRange).length
    const nB = tokens.filter((t) => t.alive && t.placed && t.side === 'b' && Math.hypot(t.pos.x - o.pos.x, t.pos.y - o.pos.y) <= o.controlRange).length
    return { id: o.id, ctrl: controlOf(o), nA, nB }
  })

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
    // 行动消费 AP（SHOOT→SHOOT，MELEE→FIGHT）；不通过则拦截
    const actR = doAction(attacker.uid, kind === 'SHOOT' ? 'SHOOT' : 'FIGHT')
    if (!actR.ok) { setIntercept({ title: '行动不可用', reasons: [actR.reason ?? '未知'] }); return }

    // 获取攻击者的武器和属性，唤出 DiceInterface
    const atkPack = packOfOp(attacker.opId)
    const weapon = weaponOfPack(atkPack, kind === 'SHOOT' ? 'RANGED' : 'MELEE')
    if (!weapon) { setIntercept({ title: '无武器', reasons: [`阵营包缺 ${kind} 武器`] }); return }

    const lethalRule = weapon.profile.weaponRules?.find((r: string) => r.startsWith('Lethal '))
    const critTarget = lethalRule ? parseInt(lethalRule.replace('Lethal ', '')) || 6 : 6;
    const context: RollContext = { hitTarget: weapon.profile.hit, critTarget }

    const defPack = packOfOp(target.opId)
    const defWeapon = weaponOfPack(defPack, kind === 'SHOOT' ? 'RANGED' : 'MELEE')

    // 防御方数据准备 (近战时使用其武器；射击时防御方使用 save 值作为目标，防守骰数固定3或根据规则)
    const defCount = kind === 'SHOOT' ? 3 : (defWeapon?.profile.attacks ?? 0)
    let defContext: any = { hitTarget: 3, critTarget: 6 }
    if (kind === 'MELEE' && defWeapon) {
      const defLethal = defWeapon.profile.weaponRules?.find((r: string) => r.startsWith('Lethal '))
      const defCritTarget = defLethal ? parseInt(defLethal.replace('Lethal ', '')) || 6 : 6
      defContext = { hitTarget: defWeapon.profile.hit, critTarget: defCritTarget }
    } else if (kind === 'SHOOT') {
      defContext = { hitTarget: 3, critTarget: 6 } // Simplified default save target
    }

    setPendingAsk(null)
    setCombatCollect({
      attacker, target, kind,
      atkCount: weapon.profile.attacks,
      atkContext: context,
      atkTheme: atkPack.faction.theme?.dice || { baseColor: '#1e1e1e', pipColor: '#e0e0e0' },
      atkDamage: { normal: weapon.profile.normalDamage, critical: weapon.profile.criticalDamage },
      defCount,
      defContext,
      defTheme: defPack.faction.theme?.dice || { baseColor: '#444', pipColor: '#fff' },
      defDamage: defWeapon ? { normal: defWeapon.profile.normalDamage, critical: defWeapon.profile.criticalDamage } : { normal: 0, critical: 0 },
      defSave: 3, // DEFENDER_SAVE
      defWounds: target.wounds
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
    if (pendingMove === 'CHARGE') {
      const inEng = tokens.some((e) => e.alive && e.placed && e.side !== t.side && Math.hypot(e.pos.x - t.pos.x, e.pos.y - t.pos.y) <= t.baseRadius + e.baseRadius + 1)
      if (!inEng) { setIntercept({ title: '冲锋非法', reasons: ['冲锋须结束在敌方 1" 控制范围内'] }); return }
    }
    const overlap = tokens.filter((o) => o.alive && o.placed && o.uid !== t.uid).find((o) => circlesOverlap(t.pos, t.baseRadius, o.pos, o.baseRadius))
    const wall = circleHitsBlockingTerrain(t.pos, t.baseRadius, mapPack.terrain)
    if (overlap || wall) {
      setIntercept({ title: overlap ? '与特工重叠' : '与墙体重叠', reasons: [`${t.name} ${overlap ? `与 ${overlap.name} 底座重叠` : '压在阻拦地形上'}`] })
      return
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
    setMoveOrigin(truePos); setMovePreview(false); setPendingMove(a)
  }

  return (
    <div className="play-view">
      <StatusStrip />
      {showViz && <FindingStrip active={active!} targets={viz.targets} />}
      {movePreview && active && moveOrigin && (
        <div className="pending-banner">
          🎯 {active.name} 移动至 {active.pos.x.toFixed(1)},{active.pos.y.toFixed(1)}（{Math.hypot(active.pos.x - moveOrigin.x, active.pos.y - moveOrigin.y).toFixed(1)}"）
          <button className="primary" onClick={confirmMove}>确认移动 ▶</button>
          <button onClick={cancelMove}>取消（回退）</button>
        </div>
      )}
      {lastShot && (
        <div className="pending-banner">
          ⏳ 待确认伤亡：{lastShot.targetName} −{lastShot.woundsDealt}
          <button className="primary" onClick={confirmCasualties}>确认伤亡 ▶</button>
          <button onClick={undoPending}>取消</button>
        </div>
      )}
      {pushMsg && (
        <div className="push-banner">
          {pushMsg}
          <button className="link-btn" onClick={() => setPushMsg(null)}>✕</button>
        </div>
      )}

      <div className="play-main">
        <div className="play-board-col">
          <button className="reset-view-btn" onClick={() => setViewport({ scale: 1, offsetX: 0, offsetY: 0 })} title="重置视口缩放/平移">⟳ 重置视图</button>
          <div
            ref={viewportRef}
            className="board-viewport"
            onTouchStart={(e) => {
              if (e.touches.length >= 2) { setInteracting(true); setDragging(null) /* P4：双指取消 token 拖 */ }
            }}
            onTouchMove={(e) => {
              if (e.touches.length >= 2) {
                e.preventDefault()
                const t1 = e.touches[0]!, t2 = e.touches[1]!
                const r = e.currentTarget.getBoundingClientRect()
                const cx = ((t1.clientX + t2.clientX) / 2) - r.left
                const cy = ((t1.clientY + t2.clientY) / 2) - r.top
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
                if (lastPinchDist.current > 0) zoomAt(dist / lastPinchDist.current, cx, cy)
                lastPinchDist.current = dist
              }
            }}
            onTouchEnd={(e) => { if (e.touches.length === 0) { lastPinchDist.current = 0; setInteracting(false) } /* P7：仅全指松开才清 */ }}
            onTouchCancel={() => { lastPinchDist.current = 0; setInteracting(false) /* P6：OS 取消 */ }}
          >
            <div style={{ transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`, transformOrigin: '0 0' }}>
              <Board
                mapPack={mapPack}
                terrain={mapPack.terrain}
                tokens={tokens}
                objectives={mapPack.objectives}
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
          <p className="muted">激活 → 选命令 → 选行动（转移/冲刺/…）→ 拖特工移动 · 射击/近战点敌方目标 · 双击旋转</p>
        </div>

        <div className="play-mid-col">
          {active && (
            <div style={{ marginBottom: '16px' }}>
              <UnitPortrait
                name={active.name}
                maxWounds={active.maxWounds}
                currentWounds={active.wounds}
                statuses={active.markers}
                themeColor={active.side === 'a' ? '#ff5a00' : '#5cff8c'}
              />
            </div>
          )}
          <ActionBar
            active={turn.activePlayer}
            selectedName={active?.name ?? null}
            selectedSide={active?.side ?? null}
            activated={activated}
            order={selectedOp?.order ?? null}
            apl={apl}
            apUsed={selectedOp?.apUsed ?? 0}
            canDo={canDo}
            pendingMove={pendingMove}
            pendingAttack={pendingAttack}
            hasLastShot={Boolean(lastShot)}
            onActivate={() => {
              if (active) {
                activate(active.uid, active.side)
                pushLog('turn', `${active.name} 激活（APL ${effectiveAplOf(active.uid)}）`)
              }
            }}
            onSelectOrder={(o) => { if (active) selectOrder(active.uid, o) }}
            onPickMove={pickMove}
            onPickAttack={(k) => {
              if (movePreview && active && moveOrigin) moveToken(active.uid, moveOrigin)
              setPendingAttack((prev) => (prev === k ? null : k))
              setPendingMove(null); setMoveOrigin(null); setMovePreview(false)
            }}
            onUndoAction={() => undoAction()}
            canUndoAction={activationUndo.length > 0}
            onEndActivation={() => { if (active) { endActivation(active.uid); pushLog('turn', `${active.name} 结束激活`); setSelected(null); setPendingMove(null); setPendingAttack(null); setMoveOrigin(null); setMovePreview(false) } }}
            onEndTP={() => scoreAndEndTP()}
            onUndo={undoPending}
          />
          <UnitPanel startWoundsOf={(uid) => tokens.find((t) => t.uid === uid)?.maxWounds ?? 1} />
          <StratagemPanel />
        </div>

        <div className="play-right-col">
          <PipelineDrawer onConfirm={confirmCasualties} onQueryRule={onQueryRule} />
          <LogPanel onReplay={replayLast} onRollbackToHere={rewindLast} />
        </div>
      </div>

      {intercept && (
        <div className="intercept-floating">
          <InterceptorCard title={intercept.title} reasons={intercept.reasons} onClose={() => setIntercept(null)} onQueryRule={() => onQueryRule(intercept.title)} />
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
        <div className="overlay-backdrop" style={{ zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '2vh' }}>
          <div style={{ position: 'relative', background: '#111', padding: '0', borderRadius: '12px', border: '1px solid #333', boxShadow: '0 10px 40px rgba(0,0,0,0.8)', width: '95vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>
            <CombatResolver
              mode={combatCollect.kind}
              attackerName={combatCollect.attacker.name}
              attackerPortrait={{
                name: combatCollect.attacker.name,
                maxWounds: combatCollect.attacker.maxWounds,
                currentWounds: combatCollect.attacker.wounds,
                statuses: combatCollect.attacker.markers,
                themeColor: combatCollect.attacker.side === 'a' ? '#ff5a00' : '#5cff8c',
                scale: 2
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
                themeColor: combatCollect.target.side === 'a' ? '#ff5a00' : '#5cff8c',
                scale: 2
              }}
              defenderCount={combatCollect.defCount}
              defenderContext={combatCollect.defContext}
              defenderTheme={combatCollect.defTheme}
              defenderDamage={(combatCollect as any).defDamage}
              rollMode={diceSource === 'electronic' ? 'AUTO' : 'MANUAL'}
              onComplete={(result) => {
                const { attacker, target, kind } = combatCollect
                setCombatCollect(null)
                const r = resolveAttack({
                  attackerUid: attacker.uid,
                  targetUid: target.uid,
                  kind,
                  manualNats: [...result.atkNats, ...(result.defNats || [])],
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
