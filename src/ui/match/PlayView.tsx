import { useState } from 'react'
import { loadPack, runShooting, runMelee, losFinding, coverFinding, engagementFinding, validateTarget, ElectronicDiceSource, ManualDiceSource, hashSeed, type FactionPack, type Effect } from '../..'
import { useMatchStore, type MatchToken, type Side } from '../../state/matchStore'
import { useRosterStore } from '../../state/rosterStore'
import { buildShootingLog, buildMeleeLog, type ResolutionLog } from '../../engine'
import type { Point, OperativePlacement, Board as BoardT } from '../../geometry'
import type { ObjectiveMarker } from '../../data/maps'
import angelsPack from '../../data/packs/angels_of_death.v1.json'
import { Board, type LosLine, type ObjControl } from './Board'
import { StatusStrip } from './StatusStrip'
import { ActionBar } from './ActionBar'
import { UnitPanel } from './UnitPanel'
import { PipelineDrawer } from './PipelineDrawer'
import { LogPanel } from './LogPanel'
import { InterceptorCard } from './InterceptorCard'
import { ManualDiceEntry } from './ManualDiceEntry'

const pack: FactionPack = loadPack(angelsPack)
const RANGED = pack.weapons.find((w) => w.kind === 'RANGED')!
const MELEE = pack.weapons.find((w) => w.kind === 'MELEE')!

function clampPos(p: Point): Point {
  const b = useMatchStore.getState().mapPack?.bounds ?? { w: 30, h: 20 }
  return { x: Math.max(0.5, Math.min(b.w - 0.5, p.x)), y: Math.max(0.5, Math.min(b.h - 0.5, p.y)) }
}

function tacticEffects(): Effect[] {
  return useRosterStore.getState().rosterA.subFactionSelection
    .map((id) => pack.effects.find((e) => e.effectId === id))
    .filter((e): e is Effect => Boolean(e))
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
  const undoLastShot = useMatchStore((s) => s.undoLastShot)
  const applyDamage = useMatchStore((s) => s.applyDamage)
  const setLastShot = useMatchStore((s) => s.setLastShot)
  const setCurrentLog = useMatchStore((s) => s.setCurrentLog)
  const nextShotSeq = useMatchStore((s) => s.nextShotSeq)
  const diceSource = useMatchStore((s) => s.diceSource)
  const overrides = useMatchStore((s) => s.overrides)
  const toggleOverride = useMatchStore((s) => s.toggleOverride)
  const intercept = useMatchStore((s) => s.intercept)
  const setIntercept = useMatchStore((s) => s.setIntercept)
  const pushLog = useMatchStore((s) => s.pushLog)
  const lastShot = useMatchStore((s) => s.lastShot)

  const [pendingAttack, setPendingAttack] = useState<{ attacker: MatchToken; target: MatchToken; mode: 'ask' } | null>(null)
  const [manualCollect, setManualCollect] = useState<{ attacker: MatchToken; target: MatchToken; kind: 'SHOOT' | 'MELEE'; needed: number } | null>(null)
  const [hoverInch, setHoverInch] = useState<string | null>(null)

  const active = tokens.find((t) => t.uid === selected) ?? null
  const activated = active ? Boolean(turn.operatives[active.uid]?.ready) : false

  function toBoard(): BoardT {
    return {
      terrain: mapPack.terrain,
      operatives: tokens.filter((t) => t.alive && t.placed).map((t) => ({ operativeId: t.uid, pos: t.pos, baseRadius: t.baseRadius })),
    }
  }

  // ===== 目标控制（1.16） =====
  function controlOf(o: ObjectiveMarker): Side | null {
    const nA = tokens.filter((t) => t.alive && t.placed && t.side === 'a' && Math.hypot(t.pos.x - o.pos.x, t.pos.y - o.pos.y) <= o.controlRange).length
    const nB = tokens.filter((t) => t.alive && t.placed && t.side === 'b' && Math.hypot(t.pos.x - o.pos.x, t.pos.y - o.pos.y) <= o.controlRange).length
    if (nA > nB && nA > 0) return 'a'
    if (nB > nA && nB > 0) return 'b'
    return null
  }
  const objControl: ObjControl[] = mapPack.objectives.map((o) => ({ id: o.id, ctrl: controlOf(o) }))

  // ===== 几何可视化（1.14）：选中已激活特工 → 射程环 + LOS 射线 =====
  const showViz = active && activated && active.side === turn.activePlayer
  const rangeRing = showViz ? { center: active!.pos, r: RANGED.profile.range ?? 24 } : null
  const losLines: LosLine[] = showViz
    ? tokens
        .filter((t) => t.alive && t.placed && t.side !== active!.side)
        .map((t) => {
          const los = losFinding(active!.pos, t.pos, toBoard())
          const stroke = los.finalValue ? '#39d98a' : '#ff5c5c'
          const dash = los.confidence === 'AMBIGUOUS' ? '4 3' : 'none'
          return { target: t.pos, stroke, dash, opacity: 0.7 }
        })
    : []

  // ===== 一击交互（1.13 T4） =====
  function onClickToken(t: MatchToken) {
    if (t.side === turn.activePlayer) {
      setSelected(t.uid)
      setIntercept(null)
      return
    }
    // 点敌方 → 一击结算
    if (!active || active.side !== turn.activePlayer || !activated) {
      setIntercept({ title: '未激活', reasons: ['须先激活己方特工再攻击'] })
      return
    }
    startAttackWithDice(active, t)
  }

  function startAttack(attacker: MatchToken, target: MatchToken) {
    const aPl: OperativePlacement = { operativeId: attacker.uid, pos: attacker.pos, baseRadius: attacker.baseRadius, facing: attacker.facing }
    const dPl: OperativePlacement = { operativeId: target.uid, pos: target.pos, baseRadius: target.baseRadius }
    const board = toBoard()
    const others = tokens.filter((t) => t.alive && t.placed && t.uid !== target.uid).map((t) => t.pos)
    const elig = validateTarget(aPl, dPl, RANGED.profile.range ?? 24, board, others)
    if (!elig.ok) {
      setIntercept({ title: '不可攻击', reasons: elig.missing })
      return
    }
    // 近战/射击歧义：控制范围内 → 给 chips
    const engaged = engagementFinding(aPl, dPl, losFinding(attacker.pos, target.pos, board).finalValue).finalValue
    setIntercept(null)
    if (engaged) {
      setPendingAttack({ attacker, target, mode: 'ask' })
    } else {
      resolveShoot(attacker, target)
    }
  }

  function resolveShoot(attacker: MatchToken, target: MatchToken, manualNats?: number[]) {
    const board = toBoard()
    const others = tokens.filter((t) => t.alive && t.placed && t.uid !== target.uid).map((t) => t.pos)
    const cover = coverFinding(target.pos, board, others).finalValue
    const effects = attacker.side === 'a' ? tacticEffects() : []
    const dice = manualNats
      ? (() => { const m = new ManualDiceSource(); m.provide(manualNats); return m })()
      : new ElectronicDiceSource(hashSeed(`${attacker.uid}>${target.uid}`, 'SHOOT', nextShotSeq()))
    const r = runShooting({
      attacker: { operativeId: attacker.uid, weapon: RANGED },
      defender: { operativeId: target.uid, save: 3, wounds: target.wounds },
      effects,
      dice,
      hasCover: cover,
    })
    finalize(attacker, target, r.woundsDealt, buildShootingLog(`${attacker.uid}>${target.uid}`, { attacker: { operativeId: attacker.uid, weapon: RANGED }, defender: { operativeId: target.uid, save: 3, wounds: target.wounds }, effects, dice, hasCover: cover }, r), 'shoot')
  }

  function resolveMelee(attacker: MatchToken, target: MatchToken, manualNats?: number[]) {
    const effects = attacker.side === 'a' ? tacticEffects() : []
    const dice = manualNats
      ? (() => { const m = new ManualDiceSource(); m.provide(manualNats); return m })()
      : new ElectronicDiceSource(hashSeed(`${attacker.uid}>${target.uid}`, 'MELEE', nextShotSeq()))
    const input = {
      attacker: { operativeId: attacker.uid, weapon: MELEE, save: 3, wounds: attacker.wounds },
      defender: { operativeId: target.uid, weapon: MELEE, save: 3, wounds: target.wounds },
      effects,
      dice,
    }
    const r = runMelee(input)
    finalize(attacker, target, r.woundsToDefender, buildMeleeLog(`${attacker.uid}>${target.uid}`, input, r), 'melee')
  }

  function finalize(attacker: MatchToken, target: MatchToken, woundsDealt: number, log: ResolutionLog, kind: 'shoot' | 'melee') {
    setLastShot({ targetUid: target.uid, targetName: target.name, woundsDealt, prevWounds: target.wounds, attackerUid: attacker.uid, kind })
    setCurrentLog(log)
    // 1.13 §4.1：唯一强制确认 = 确认伤亡。damage 在确认时写回（见 onConfirm）。
    pushLog(kind, `${attacker.name} → ${target.name}：待确认伤亡 ${woundsDealt}`)
    setPendingAttack(null)
  }

  function onConfirm() {
    if (!lastShot) return
    const t = tokens.find((x) => x.uid === lastShot.targetUid)
    const nw = Math.max(0, (t?.wounds ?? 0) - lastShot.woundsDealt)
    applyDamage(lastShot.targetUid, lastShot.woundsDealt)
    pushLog(lastShot.kind, `${lastShot.targetName} 确认伤亡 ${lastShot.woundsDealt}${nw <= 0 ? '（残废）' : `（剩 ${nw}）`}`)
    setCurrentLog(null)
  }

  // manual 模式：先收集骰（攻击+防御上限 2×attacks），电子模式直接结算
  function startAttackWithDice(attacker: MatchToken, target: MatchToken) {
    if (diceSource !== 'manual') { startAttack(attacker, target); return }
    const aPl: OperativePlacement = { operativeId: attacker.uid, pos: attacker.pos, baseRadius: attacker.baseRadius }
    const dPl: OperativePlacement = { operativeId: target.uid, pos: target.pos, baseRadius: target.baseRadius }
    const elig = validateTarget(aPl, dPl, RANGED.profile.range ?? 24, toBoard(), tokens.filter((t) => t.alive && t.placed && t.uid !== target.uid).map((t) => t.pos))
    if (!elig.ok) { setIntercept({ title: '不可攻击', reasons: elig.missing }); return }
    const engaged = engagementFinding(aPl, dPl, losFinding(attacker.pos, target.pos, toBoard()).finalValue).finalValue
    if (engaged) { setPendingAttack({ attacker, target, mode: 'ask' }); return }
    setManualCollect({ attacker, target, kind: 'SHOOT', needed: RANGED.profile.attacks * 2 })
  }

  function onPointerMove(p: Point) {
    if (dragging && dragOrigin) {
      moveToken(dragging, clampPos(p))
      const d = Math.hypot(p.x - dragOrigin.x, p.y - dragOrigin.y)
      setHoverInch(`移动 ${d.toFixed(1)}"`)
    }
  }
  function onPointerUp() {
    if (dragging) {
      const t = tokens.find((x) => x.uid === dragging)
      if (t && dragOrigin) {
        const d = Math.hypot(t.pos.x - dragOrigin.x, t.pos.y - dragOrigin.y)
        if (d > 0.1) pushLog('turn', `${t.name} 移动 ${d.toFixed(1)}"`)
      }
      setDragging(null)
      setHoverInch(null)
    }
  }

  function onEndTP() {
    scoreAndEndTP(controlOf)
  }

  return (
    <div className="play-view">
      <StatusStrip />

      {/* 几何 finding 内联翻转（1.14 T5 / 1.15 咨询式）：显示当前选中→目标的关键 finding */}
      {showViz && <FindingStrip active={active!} tokens={tokens} board={toBoard()} overrides={overrides} onToggle={toggleOverride} />}

      <div className="play-main">
        <div className="play-board-col">
          <Board
            mapPack={mapPack}
            terrain={mapPack.terrain}
            tokens={tokens}
            objectives={mapPack.objectives}
            phase="play"
            selected={selected}
            rangeRing={rangeRing}
            losLines={losLines}
            objControl={objControl}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onTokenPointerDown={(t) => { if (t.side === turn.activePlayer) { setSelected(t.uid); setDragging(t.uid, t.pos); setIntercept(null) } }}
            onTokenDoubleClick={(t) => rotateToken(t.uid)}
            onTokenClick={onClickToken}
          />
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
            onActivate={() => { if (active) { activate(active.uid, active.side); pushLog('turn', `${active.name} 激活`) } }}
            onEndActivation={() => { if (active) { endActivation(active.uid); pushLog('turn', `${active.name} 结束激活`); setSelected(null) } }}
            onEndTP={onEndTP}
            onUndo={undoLastShot}
          />
          <UnitPanel startWoundsOf={(uid) => tokens.find((t) => t.uid === uid)?.maxWounds ?? 1} />
        </div>

        <div className="play-right-col">
          <PipelineDrawer onConfirm={onConfirm} onQueryRule={onQueryRule} />
          <LogPanel onReplay={() => { /* currentLog 已展 */ }} onRollbackToHere={undoLastShot} />
        </div>
      </div>

      {intercept && <div className="intercept-floating"><InterceptorCard title={intercept.title} reasons={intercept.reasons} onClose={() => setIntercept(null)} onQueryRule={() => onQueryRule(intercept.title)} /></div>}

      {/* 近战/射击歧义 chips（零模态） */}
      {pendingAttack?.mode === 'ask' && (
        <div className="chips-ask">
          <span>{pendingAttack.attacker.name} 控制范围内有 {pendingAttack.target.name}：</span>
          <button className="primary" onClick={() => { const a = pendingAttack.attacker, t = pendingAttack.target; if (diceSource === 'manual') setManualCollect({ attacker: a, target: t, kind: 'SHOOT', needed: RANGED.profile.attacks * 2 }); else resolveShoot(a, t) }}>射击 ▸</button>
          <button className="primary" onClick={() => { const a = pendingAttack.attacker, t = pendingAttack.target; if (diceSource === 'manual') setManualCollect({ attacker: a, target: t, kind: 'MELEE', needed: MELEE.profile.attacks * 2 }); else resolveMelee(a, t) }}>近战 ▸</button>
          <button onClick={() => setPendingAttack(null)}>取消</button>
        </div>
      )}

      {/* 物理骰录入浮层 */}
      {manualCollect && (
        <ManualDiceEntry
          needed={manualCollect.needed}
          label={`${manualCollect.kind === 'SHOOT' ? '射击' : '近战'}：攻击+防御骰共 ${manualCollect.needed} 枚`}
          onClose={() => setManualCollect(null)}
          onConfirm={(nats) => {
            const { attacker, target, kind } = manualCollect
            setManualCollect(null)
            if (kind === 'SHOOT') resolveShoot(attacker, target, nats)
            else resolveMelee(attacker, target, nats)
          }}
        />
      )}
    </div>
  )
}

// 1.14 T5：几何 finding 内联翻转条（咨询式 D-24，不弹框）
function FindingStrip({
  active,
  tokens,
  board,
  overrides,
  onToggle,
}: {
  active: MatchToken
  tokens: MatchToken[]
  board: BoardT
  overrides: Record<string, boolean>
  onToggle: (key: string) => void
}) {
  const enemies = tokens.filter((t) => t.alive && t.placed && t.side !== active.side).slice(0, 4)
  const items: { key: string; label: string; ambiguous: boolean }[] = []
  for (const e of enemies) {
    const los = losFinding(active.pos, e.pos, board)
    const k = `${active.uid}>${e.uid}>LOS`
    items.push({ key: k, label: `${e.name} LOS=${los.finalValue ? '可见' : '阻挡'}`, ambiguous: los.confidence === 'AMBIGUOUS' })
  }
  if (items.length === 0) return null
  return (
    <div className="finding-strip">
      {items.map((it) => (
        <button
          key={it.key}
          className={`chip finding ${it.ambiguous ? 'ambiguous' : ''} ${overrides[it.key] ? 'flipped' : ''}`}
          onClick={() => onToggle(it.key)}
          title={it.ambiguous ? '⚠ 可翻转（咨询式，1 击翻转假设，不弹框）' : 'CLEAR（可手动翻转）'}
        >
          {it.ambiguous ? '⚠ ' : ''}{it.label}{overrides[it.key] ? ' ⟲' : ''}
        </button>
      ))}
    </div>
  )
}
