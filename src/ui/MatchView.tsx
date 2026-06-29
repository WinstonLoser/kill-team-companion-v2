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
}
const TERRAIN: TerrainFeature[] = [
  { id: 'ruin', kind: 'BLOCKING', polygon: [{ x: 13, y: 6 }, { x: 17, y: 6 }, { x: 17, y: 14 }, { x: 13, y: 14 }] },
]
const mk = (side: 'a' | 'b', i: number, x: number, y: number): Token => ({ uid: `${side}${i}`, side, name: `战术兵${side.toUpperCase()}${i}`, pos: { x, y }, wounds: 13, alive: true })
const initialTokens = (): Token[] => [mk('a', 1, 3, 6), mk('a', 2, 3, 14), mk('b', 1, 27, 6), mk('b', 2, 27, 14)]

export function MatchView() {
  const [tokens, setTokens] = useState<Token[]>(initialTokens)
  const [objectives] = useState<Point[]>([{ x: 15, y: 10 }])
  const [turn, setTurn] = useState<TurnState>(createInitialTurnState())
  const [vp, setVp] = useState<{ a: number; b: number }>({ a: 0, b: 0 })
  const [log, setLog] = useState<string[]>(['战斗开始（占领目标点）'])
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [lastRes, setLastRes] = useState<{ result: ShootResult; target: string } | null>(null)
  const [winner, setWinner] = useState<string | null>(null)

  const active = tokens.find((t) => t.uid === selected) ?? null
  const pushLog = (s: string) => setLog((l) => [s, ...l].slice(0, 40))
  const toBoard = (): Board => ({ terrain: TERRAIN, operatives: tokens.filter((t) => t.alive).map((t) => ({ operativeId: t.uid, pos: t.pos, baseRadius: BASE_R })) })

  // push 引导（1.13）
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
    const others = tokens.filter((t) => t.alive && t.uid !== target.uid).map((t) => t.pos)
    const cover = coverFinding(target.pos, board, others)
    if (!los.finalValue) { pushLog(`⚠ 拦截：${target.name} 不可见（LOS 阻断）`); return }
    if (!range.finalValue) { pushLog(`⚠ 拦截：${target.name} 超射程 ${RANGE}"`); return }
    const dice = new ElectronicDiceSource(hashSeed(`${active.uid}>${target.uid}`, 'SHOOT', log.length))
    const r = runShooting({ attacker: { operativeId: active.uid, weapon }, defender: { operativeId: target.uid, save: 3, wounds: target.wounds }, effects: [], dice, hasCover: cover.finalValue })
    setLastRes({ result: r, target: target.name })
    const nw = Math.max(0, target.wounds - r.woundsDealt)
    setTokens((ts) => ts.map((t) => (t.uid === target.uid ? { ...t, wounds: nw, alive: nw > 0 } : t)))
    pushLog(`${active.name} → ${target.name}：造伤 ${r.woundsDealt}${nw <= 0 ? '（残废）' : `（剩 ${nw}）`}${cover.finalValue ? ' [掩护]' : ''}${los.confidence === 'AMBIGUOUS' ? ' [LOS模糊·可翻]' : ''}`)
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
      const nA = tokens.filter((t) => t.alive && t.side === 'a' && dist(t.pos, o) <= 3).length
      const nB = tokens.filter((t) => t.alive && t.side === 'b' && dist(t.pos, o) <= 3).length
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

  if (winner) {
    return (
      <div className="demo">
        <h2>战斗结束</h2>
        <p className="outcome">胜负：<strong>{winner}</strong> — VP A:{vp.a} B:{vp.b}</p>
        <button className="primary" onClick={() => { setTokens(initialTokens()); setTurn(createInitialTurnState()); setVp({ a: 0, b: 0 }); setWinner(null); setLog(['战斗开始']); setLastRes(null) }}>再开一局</button>
      </div>
    )
  }

  return (
    <div className="demo">
      <div className="pushbar">{guidance}</div>
      <div className="row">
        <button onClick={activate} disabled={!active || active.side !== turn.activePlayer}>激活选中</button>
        <button onClick={endActivation} disabled={!active}>结束激活</button>
        <button className="primary" onClick={scoreAndEndTP}>结束转折点（计分）</button>
        <span className="muted">TP {turn.turningPoint}/4 · 主动 {turn.activePlayer.toUpperCase()} · VP A:{vp.a} B:{vp.b}</span>
      </div>

      <div
        className="board"
        style={{ width: BOARD_W * SCALE, height: BOARD_H * SCALE }}
        onPointerMove={(e) => { if (dragging) { e.preventDefault(); moveToken(dragging, boardPoint(e)) } }}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
        onClick={(e) => { if (!dragging) moveSelectedTo(boardPoint(e)) }}
      >
        {/* SVG 叠层：射程环 + LOS 射线（1.14 可视化） */}
        <svg className="overlay" width={BOARD_W * SCALE} height={BOARD_H * SCALE}>
          {active && (
            <circle cx={active.pos.x * SCALE} cy={active.pos.y * SCALE} r={RANGE * SCALE} className="rangedot" />
          )}
          {active && tokens.filter((t) => t.alive && t.side !== active.side).map((t) => {
            const los = losFinding(active.pos, t.pos, toBoard())
            const stroke = los.finalValue ? '#39d98a' : '#ff5c5c'
            return <line key={t.uid} x1={active.pos.x * SCALE} y1={active.pos.y * SCALE} x2={t.pos.x * SCALE} y2={t.pos.y * SCALE} stroke={stroke} strokeWidth={2} strokeDasharray={los.confidence === 'AMBIGUOUS' ? '4 3' : 'none'} opacity={0.7} />
          })}
        </svg>
        {TERRAIN.filter((t) => t.kind === 'BLOCKING').map((t) => {
          const xs = t.polygon.map((p) => p.x); const ys = t.polygon.map((p) => p.y)
          return <div key={t.id} className="terrain" style={{ left: Math.min(...xs) * SCALE, top: Math.min(...ys) * SCALE, width: (Math.max(...xs) - Math.min(...xs)) * SCALE, height: (Math.max(...ys) - Math.min(...ys)) * SCALE }} />
        })}
        {objectives.map((o, i) => <div key={i} className="objective" style={{ left: o.x * SCALE - 8, top: o.y * SCALE - 8 }} title="目标点 控制3英寸" />)}
        {tokens.filter((t) => t.alive).map((t) => (
          <button
            key={t.uid}
            className={`token ${t.side} ${selected === t.uid ? 'sel' : ''}`}
            style={{ left: t.pos.x * SCALE - 11, top: t.pos.y * SCALE - 11 }}
            onPointerDown={(e) => { e.stopPropagation(); setSelected(t.uid); setDragging(t.uid) }}
            onClick={(e) => { e.stopPropagation(); if (active && t.side !== active.side) shoot(t.uid) }}
            title={`${t.name} 耐伤${t.wounds}`}
          >{t.side.toUpperCase()}</button>
        ))}
      </div>
      <p className="muted">拖特工移动 / 点敌方射击（绿线=可见 红线=阻挡 虚线=LOS模糊）/ 选中有射程环。</p>

      <div className="cols">
        <div>
          <h3>日志</h3>
          <ul className="trace">{log.map((l, i) => <li key={i}><span className="sum">{l}</span></li>)}</ul>
        </div>
        <div>
          <h3>上一次结算（{lastRes?.target ?? '—'}）</h3>
          {lastRes ? (
            <ol className="trace">{lastRes.result.traces.map((t, i) => <li key={i}><span className="sid">{t.stepId}</span><span className="sum">{t.summary}</span></li>)}</ol>
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
