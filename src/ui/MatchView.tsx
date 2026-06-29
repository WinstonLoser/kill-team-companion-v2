import { useState } from 'react'
import { loadPack, runShooting, losFinding, rangeFinding, coverFinding } from '../'
import { ElectronicDiceSource, hashSeed } from '../dice'
import { createInitialTurnState, turnReducer, type TurnState } from '../state/turnStateMachine'
import type { ShootResult } from '../engine'
import type { Board, OperativePlacement, Point, TerrainFeature } from '../geometry'
import angelsPack from '../data/packs/angels_of_death.v1.json'

const pack = loadPack(angelsPack)
const weapon = pack.weapons.find((w) => w.kind === 'RANGED')!
const BASE_R = 0.63
const SCALE = 20
const BOARD_W = 30
const BOARD_H = 20
const RANGE = weapon.profile.range ?? 24

interface Token {
  uid: string
  side: 'a' | 'b'
  name: string
  pos: Point
  wounds: number
  alive: boolean
  placed: boolean
}
const MAPS: Record<string, TerrainFeature[]> = {
  open: [],
  ruin: [{ id: 'ruin', kind: 'BLOCKING', polygon: [{ x: 13, y: 6 }, { x: 17, y: 6 }, { x: 17, y: 14 }, { x: 13, y: 14 }] }],
  corridor: [
    { id: 'w1', kind: 'BLOCKING', polygon: [{ x: 8, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 9 }, { x: 8, y: 9 }] },
    { id: 'w2', kind: 'BLOCKING', polygon: [{ x: 20, y: 11 }, { x: 22, y: 11 }, { x: 22, y: 18 }, { x: 20, y: 18 }] },
  ],
}
const mk = (side: 'a' | 'b', i: number): Token => ({ uid: `${side}${i}`, side, name: `战术兵${side.toUpperCase()}${i}`, pos: { x: -1, y: -1 }, wounds: 13, alive: true, placed: false })
const initialTokens = (): Token[] => [mk('a', 1), mk('a', 2), mk('b', 1), mk('b', 2)]

interface LastShot {
  result: ShootResult
  targetUid: string
  targetName: string
  woundsDealt: number
  prevWounds: number
}

export function MatchView() {
  const [tokens, setTokens] = useState<Token[]>(initialTokens)
  const [objectives] = useState<Point[]>([{ x: 15, y: 10 }])
  const [turn, setTurn] = useState<TurnState>(createInitialTurnState())
  const [vp, setVp] = useState<{ a: number; b: number }>({ a: 0, b: 0 })
  const [log, setLog] = useState<string[]>(['部署阶段：双方在降落区交替放置特工'])
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [mapKey, setMapKey] = useState('ruin')
  const [phase, setPhase] = useState<'deploy' | 'play'>('deploy')
  const [lastShot, setLastShot] = useState<LastShot | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const terrain = MAPS[mapKey] ?? MAPS.ruin!

  const active = tokens.find((t) => t.uid === selected) ?? null
  const pushLog = (s: string) => setLog((l) => [s, ...l].slice(0, 40))
  const toBoard = (): Board => ({ terrain, operatives: tokens.filter((t) => t.alive && t.placed).map((t) => ({ operativeId: t.uid, pos: t.pos, baseRadius: BASE_R })) })

  // ===== 部署阶段 =====
  const unplacedA = tokens.filter((t) => t.side === 'a' && !t.placed)
  const unplacedB = tokens.filter((t) => t.side === 'b' && !t.placed)
  const deploySide: 'a' | 'b' = unplacedA.length >= unplacedB.length ? 'a' : 'b'
  const allPlaced = unplacedA.length === 0 && unplacedB.length === 0

  function placeAt(p: Point) {
    if (phase !== 'deploy' || allPlaced) return
    // 降落区：A 在 x<10，B 在 x>20
    const inZone = deploySide === 'a' ? p.x < 10 : p.x > 20
    if (!inZone) { pushLog(`⚠ 须在 ${deploySide.toUpperCase()} 方降落区（${deploySide === 'a' ? '左 1/3' : '右 1/3'}）放置`); return }
    const next = tokens.find((t) => t.side === deploySide && !t.placed)
    if (!next) return
    setTokens((ts) => ts.map((t) => (t.uid === next.uid ? { ...t, placed: true, pos: clampPos(p) } : t)))
    pushLog(`${next.name} 部署于 ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  }

  function beginPlay() {
    setPhase('play')
    setSelected(null)
    setTurn((s) => ({ ...s, activePlayer: 'a' }))
    pushLog('部署完成 · 战斗开始（占领目标点）')
  }

  // ===== 对局阶段 =====
  const guidance = !active
    ? `轮到 ${turn.activePlayer.toUpperCase()}：点一名己方特工激活`
    : active.side !== turn.activePlayer
      ? `选中了对方特工；请激活 ${turn.activePlayer.toUpperCase()} 方`
      : `已激活 ${active.name}：点空地移动 / 点敌方射击 / [结束激活]`

  function activate() {
    if (!active || active.side !== turn.activePlayer) return
    setTurn((s) => {
      const next = { ...s, operatives: { ...s.operatives, [active.uid]: { order: 'ENGAGED' as const, ready: true, apUsed: 0, actionsThisActivation: [], fallBackDone: false, chargeDone: false, moveDone: false } } }
      return turnReducer(next, { type: 'ACTIVATE', opId: active.uid, player: active.side })
    })
    pushLog(`${active.name} 激活`)
  }

  function moveToken(uid: string, p: Point) {
    setTokens((ts) => ts.map((t) => (t.uid === uid ? { ...t, pos: clampPos(p) } : t)))
  }

  function shoot(targetUid: string) {
    if (!active) return
    const target = tokens.find((t) => t.uid === targetUid)
    if (!target || target.side === active.side) return
    const board = toBoard()
    const aPl: OperativePlacement = { operativeId: active.uid, pos: active.pos, baseRadius: BASE_R }
    const dPl: OperativePlacement = { operativeId: target.uid, pos: target.pos, baseRadius: BASE_R }
    const los = losFinding(active.pos, target.pos, board)
    const range = rangeFinding(aPl, dPl, RANGE)
    const others = tokens.filter((t) => t.alive && t.placed && t.uid !== target.uid).map((t) => t.pos)
    const cover = coverFinding(target.pos, board, others)
    if (!los.finalValue) { pushLog(`⚠ 拦截：${target.name} 不可见（LOS 阻断）`); return }
    if (!range.finalValue) { pushLog(`⚠ 拦截：${target.name} 超射程 ${RANGE}"`); return }
    const dice = new ElectronicDiceSource(hashSeed(`${active.uid}>${target.uid}`, 'SHOOT', log.length))
    const r = runShooting({ attacker: { operativeId: active.uid, weapon }, defender: { operativeId: target.uid, save: 3, wounds: target.wounds }, effects: [], dice, hasCover: cover.finalValue })
    const prevWounds = target.wounds
    const nw = Math.max(0, target.wounds - r.woundsDealt)
    setLastShot({ result: r, targetUid: target.uid, targetName: target.name, woundsDealt: r.woundsDealt, prevWounds })
    setTokens((ts) => ts.map((t) => (t.uid === target.uid ? { ...t, wounds: nw, alive: nw > 0 } : t)))
    pushLog(`${active.name} → ${target.name}：造伤 ${r.woundsDealt}${nw <= 0 ? '（残废）' : `（剩 ${nw}）`}${cover.finalValue ? ' [掩护]' : ''}${los.confidence === 'AMBIGUOUS' ? ' [LOS模糊]' : ''}`)
  }

  function undoLastShot() {
    // FR-16 回滚：撤销上次结算（恢复目标耐伤/存活）
    if (!lastShot) return
    const restore = lastShot.prevWounds
    setTokens((ts) => ts.map((t) => (t.uid === lastShot.targetUid ? { ...t, wounds: restore, alive: restore > 0 } : t)))
    pushLog(`↶ 回滚：${lastShot.targetName} 耐伤恢复至 ${restore}`)
    setLastShot(null)
  }

  function endActivation() {
    if (!active) return
    setTurn((s) => turnReducer(s, { type: 'END_ACTIVATION', opId: active.uid }))
    setSelected(null)
    pushLog(`${active.name} 结束激活`)
  }

  function scoreAndEndTP() {
    const scored = { a: vp.a, b: vp.b }
    for (const o of objectives) {
      const nA = tokens.filter((t) => t.alive && t.placed && t.side === 'a' && dist(t.pos, o) <= 3).length
      const nB = tokens.filter((t) => t.alive && t.placed && t.side === 'b' && dist(t.pos, o) <= 3).length
      if (nA > nB) scored.a++
      else if (nB > nA) scored.b++
    }
    setVp(scored)
    const next = turnReducer(turn, { type: 'END_TURNING_POINT' })
    setTurn(next)
    pushLog(`转折点 ${turn.turningPoint} 结束 — VP A:${scored.a} B:${scored.b}`)
    if (next.phase === 'BATTLE_END') {
      const w = scored.a > scored.b ? 'A 胜' : scored.b > scored.a ? 'B 胜' : '平局'
      setWinner(w)
      pushLog(`战斗结束 → ${w}`)
    } else {
      setTurn((s) => ({ ...s, activePlayer: s.activePlayer === 'a' ? 'b' : 'a' }))
    }
  }

  function boardPoint(e: { clientX: number; clientY: number; currentTarget: HTMLDivElement }): Point {
    const r = e.currentTarget.getBoundingClientRect()
    return clampPos({ x: (e.clientX - r.left) / SCALE, y: (e.clientY - r.top) / SCALE })
  }

  function reset() {
    setTokens(initialTokens()); setTurn(createInitialTurnState()); setVp({ a: 0, b: 0 }); setWinner(null); setPhase('deploy'); setSelected(null); setLastShot(null); setLog(['部署阶段：双方在降落区交替放置特工'])
  }

  if (winner) {
    return (
      <div className="demo">
        <h2>战斗结束</h2>
        <p className="outcome">胜负：<strong>{winner}</strong> — VP A:{vp.a} B:{vp.b}</p>
        <button className="primary" onClick={reset}>再开一局</button>
      </div>
    )
  }

  const deployGuidance = phase === 'deploy'
    ? `部署 · 轮到 ${deploySide.toUpperCase()} 方 · 点击己方降落区放置${allPlaced ? '（已完成，可开战）' : ''}`
    : guidance

  return (
    <div className="demo">
      <div className="pushbar">{deployGuidance}</div>
      <div className="row">
        {phase === 'deploy' ? (
          <button className="primary" disabled={!allPlaced} onClick={beginPlay}>开始对局 ▶</button>
        ) : (
          <>
            <button onClick={activate} disabled={!active || active.side !== turn.activePlayer}>激活选中</button>
            <button onClick={endActivation} disabled={!active}>结束激活</button>
            <button className="primary" onClick={scoreAndEndTP}>结束转折点（计分）</button>
            {lastShot && <button onClick={undoLastShot}>↶ 回滚上次结算</button>}
          </>
        )}
        <label>地图
          <select value={mapKey} onChange={(e) => setMapKey(e.target.value)} disabled={phase === 'play'}>
            {Object.keys(MAPS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        {phase === 'play' && <span className="muted">TP {turn.turningPoint}/4 · 主动 {turn.activePlayer.toUpperCase()} · VP A:{vp.a} B:{vp.b}</span>}
      </div>

      <div
        className={`board ${phase === 'deploy' ? 'deploying' : ''} ${phase === 'deploy' ? `deploy-${deploySide}` : ''}`}
        style={{ width: BOARD_W * SCALE, height: BOARD_H * SCALE }}
        onPointerMove={(e) => { if (phase === 'play' && dragging) { e.preventDefault(); moveToken(dragging, boardPoint(e)) } }}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
        onClick={(e) => { const p = boardPoint(e); if (phase === 'deploy') placeAt(p); else if (!dragging) moveSelectedTo(p) }}
      >
        <svg className="overlay" width={BOARD_W * SCALE} height={BOARD_H * SCALE}>
          {phase === 'play' && active && (
            <>
              <circle cx={active.pos.x * SCALE} cy={active.pos.y * SCALE} r={RANGE * SCALE} className="rangedot" />
              {tokens.filter((t) => t.alive && t.placed && t.side !== active.side).map((t) => {
                const los = losFinding(active.pos, t.pos, toBoard())
                const stroke = los.finalValue ? '#39d98a' : '#ff5c5c'
                return <line key={t.uid} x1={active.pos.x * SCALE} y1={active.pos.y * SCALE} x2={t.pos.x * SCALE} y2={t.pos.y * SCALE} stroke={stroke} strokeWidth={2} strokeDasharray={los.confidence === 'AMBIGUOUS' ? '4 3' : 'none'} opacity={0.7} />
              })}
            </>
          )}
        </svg>
        {terrain.filter((t) => t.kind === 'BLOCKING').map((t) => {
          const xs = t.polygon.map((p) => p.x); const ys = t.polygon.map((p) => p.y)
          return <div key={t.id} className="terrain" style={{ left: Math.min(...xs) * SCALE, top: Math.min(...ys) * SCALE, width: (Math.max(...xs) - Math.min(...xs)) * SCALE, height: (Math.max(...ys) - Math.min(...ys)) * SCALE }} />
        })}
        {phase === 'play' && objectives.map((o, i) => <div key={i} className="objective" style={{ left: o.x * SCALE - 8, top: o.y * SCALE - 8 }} title="目标点 控制3英寸" />)}
        {tokens.filter((t) => t.placed).map((t) => (
          <button
            key={t.uid}
            className={`token ${t.side} ${selected === t.uid ? 'sel' : ''}`}
            style={{ left: t.pos.x * SCALE - 11, top: t.pos.y * SCALE - 11 }}
            onPointerDown={(e) => { if (phase === 'play') { e.stopPropagation(); setSelected(t.uid); setDragging(t.uid) } }}
            onClick={(e) => { if (phase === 'play') { e.stopPropagation(); if (active && t.side !== active.side) shoot(t.uid) } }}
            title={`${t.name} 耐伤${t.wounds}`}
          >{t.side.toUpperCase()}</button>
        ))}
      </div>
      <p className="muted">
        {phase === 'deploy'
          ? `降落区：A 左 1/3、B 右 1/3。交替放置（当前 ${deploySide.toUpperCase()}）。`
          : '拖特工移动 / 点敌方射击（绿=可见 红=阻挡 虚=模糊）/ 选中有射程环。'}
      </p>

      <div className="cols">
        <div>
          <h3>日志</h3>
          <ul className="trace">{log.map((l, i) => <li key={i}><span className="sum">{l}</span></li>)}</ul>
        </div>
        <div>
          <h3>上次结算{lastShot ? `（${lastShot.targetName}）` : ''}</h3>
          {lastShot ? (
            <>
              <ol className="trace">{lastShot.result.traces.map((t, i) => <li key={i}><span className="sid">{t.stepId}</span><span className="sum">{t.summary}</span></li>)}</ol>
              <button onClick={undoLastShot}>↶ 回滚（恢复耐伤 {lastShot.prevWounds}）</button>
            </>
          ) : <p className="muted">尚无结算</p>}
        </div>
      </div>
    </div>
  )

  function moveSelectedTo(p: Point) {
    if (!active) return
    moveToken(active.uid, p)
    pushLog(`${active.name} 移动 → ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  }
}

function dist(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y) }
function clampPos(p: Point): Point { return { x: Math.max(0.5, Math.min(BOARD_W - 0.5, p.x)), y: Math.max(0.5, Math.min(BOARD_H - 0.5, p.y)) } }
