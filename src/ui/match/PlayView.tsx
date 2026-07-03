import { useState, useRef, useEffect } from 'react'
import { useMatchStore, type MatchToken } from '../../state/matchStore'
import type { Point } from '../../geometry'
import { Board, type LosLine, type ObjControl } from './Board'
import { StatusStrip } from './StatusStrip'
import { ActionBar } from './ActionBar'
import { UnitPanel } from './UnitPanel'
import { PipelineDrawer } from './PipelineDrawer'
import { LogPanel } from './LogPanel'
import { InterceptorCard } from './InterceptorCard'
import { ManualDiceEntry } from './ManualDiceEntry'

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
  const dragOrigin = useMatchStore((s) => s.dragOrigin)
  const setDragging = useMatchStore((s) => s.setDragging)
  const moveToken = useMatchStore((s) => s.moveToken)
  const rotateToken = useMatchStore((s) => s.rotateToken)
  const activate = useMatchStore((s) => s.activate)
  const endActivation = useMatchStore((s) => s.endActivation)
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
  const manualDiceNeeded = useMatchStore((s) => s.manualDiceNeeded)

  const [pendingAsk, setPendingAsk] = useState<{ attacker: MatchToken; target: MatchToken } | null>(null)
  const [manualCollect, setManualCollect] = useState<{ attacker: MatchToken; target: MatchToken; kind: 'SHOOT' | 'MELEE'; needed: number } | null>(null)
  const [hoverInch, setHoverInch] = useState<string | null>(null)

  const active = tokens.find((t) => t.uid === selected) ?? null
  const activated = active ? Boolean(turn.operatives[active.uid]?.ready) : false

  // ===== 目标控制（1.16）— 读 store.controlOf（P7：store 当下 tokens） =====
  const objControl: ObjControl[] = mapPack.objectives.map((o) => {
    const nA = tokens.filter((t) => t.alive && t.placed && t.side === 'a' && Math.hypot(t.pos.x - o.pos.x, t.pos.y - o.pos.y) <= o.controlRange).length
    const nB = tokens.filter((t) => t.alive && t.placed && t.side === 'b' && Math.hypot(t.pos.x - o.pos.x, t.pos.y - o.pos.y) <= o.controlRange).length
    return { id: o.id, ctrl: controlOf(o), nA, nB }
  })

  // ===== 几何可视化（1.14）— 读 store.attackViz（AR-9：不在 UI 调 geometry） =====
  const showViz = active && activated && active.side === turn.activePlayer && !interacting
  const viz = showViz ? attackViz(active!.uid) : { range: 0, controlRing: null, ownCover: null, targets: [] }
  const rangeRing = showViz ? { center: active!.pos, r: viz.range } : null
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
      setSelected(t.uid)
      setIntercept(null)
      return
    }
    if (!active || active.side !== turn.activePlayer || !activated) {
      setIntercept({ title: '未激活', reasons: ['须先激活己方特工再攻击'] })
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
    if (diceSource === 'manual') {
      setManualCollect({ attacker, target, kind, needed: manualDiceNeeded(kind) })
      return
    }
    const r = resolveAttack({ attackerUid: attacker.uid, targetUid: target.uid, kind })
    if (!r.ok) setIntercept({ title: '不可攻击', reasons: r.missing ?? [] })
    else setPendingAsk(null)
  }

  function rewindLast() {
    // D3：回退到最近一次确认/计分前（全局恢复棋盘+VP+回合）
    const last = snapshots[snapshots.length - 1]
    if (last) rewindToSnapshot(last.id)
  }

  function onPointerMove(p: Point) {
    if (dragging && dragOrigin) {
      moveToken(dragging, clampPos(p))
      setHoverInch(`移动 ${Math.hypot(p.x - dragOrigin.x, p.y - dragOrigin.y).toFixed(1)}"`)
    }
  }
  function onPointerUp() {
    if (dragging) {
      const t = tokens.find((x) => x.uid === dragging)
      if (t && dragOrigin) {
        const d = Math.hypot(t.pos.x - dragOrigin.x, t.pos.y - dragOrigin.y)
        if (d > 0.1) {
          const maxMove = effectiveMoveOf(t.uid)
          const over = d > maxMove
          pushLog('turn', `${t.name} 移动 ${d.toFixed(1)}"${over ? `（⚠ 超 ${maxMove}" 移动上限）` : `（上限 ${maxMove}"）`}`)
        }
      }
      setDragging(null)
      setHoverInch(null)
    }
  }

  return (
    <div className="play-view">
      <StatusStrip />
      {showViz && <FindingStrip active={active!} targets={viz.targets} />}
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
            onTokenPointerDown={(t) => { if (t.side === turn.activePlayer) { setSelected(t.uid); setDragging(t.uid, t.pos); setIntercept(null) } }}
            onTokenDoubleClick={(t) => rotateToken(t.uid)}
            onTokenClick={onClickToken}
          />
          </div>
          </div>
          {hoverInch && <div className="inch-readout">{hoverInch}</div>}
          <p className="muted">拖己方特工移动（实时英寸数）· 双击旋转 45° · 点敌方一击结算（绿=可见 红=阻挡 虚=模糊）</p>
        </div>

        <div className="play-mid-col">
          <ActionBar
            active={turn.activePlayer}
            selectedName={active?.name ?? null}
            selectedSide={active?.side ?? null}
            activated={activated}
            hasLastShot={Boolean(lastShot)}
            onActivate={() => {
              if (active) {
                activate(active.uid, active.side)
                const apl = effectiveAplOf(active.uid)
                pushLog('turn', `${active.name} 激活（APL ${apl}）`)
              }
            }}
            onEndActivation={() => { if (active) { endActivation(active.uid); pushLog('turn', `${active.name} 结束激活`); setSelected(null) } }}
            onEndTP={() => scoreAndEndTP()}
            onUndo={undoPending}
          />
          <UnitPanel startWoundsOf={(uid) => tokens.find((t) => t.uid === uid)?.maxWounds ?? 1} />
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

      {manualCollect && (
        <ManualDiceEntry
          needed={manualCollect.needed}
          label={`${manualCollect.kind === 'SHOOT' ? '射击' : '近战'}：攻击+防御骰共 ${manualCollect.needed} 枚`}
          onClose={() => setManualCollect(null)}
          onConfirm={(nats) => {
            const { attacker, target, kind } = manualCollect
            setManualCollect(null)
            const r = resolveAttack({ attackerUid: attacker.uid, targetUid: target.uid, kind, manualNats: nats })
            if (!r.ok) setIntercept({ title: '不可攻击', reasons: r.missing ?? [] })
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
