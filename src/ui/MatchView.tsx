import { useState } from 'react'
import { loadPack, runShooting, losFinding, rangeFinding, coverFinding } from '../'
import { ElectronicDiceSource, hashSeed } from '../dice'
import angelsPack from '../data/packs/angels_of_death.v1.json'
import {
  createInitialTurnState,
  turnReducer,
  type TurnState,
} from '../state/turnStateMachine'
import type { Board, OperativePlacement, Point, TerrainFeature } from '../geometry'

const pack = loadPack(angelsPack)
const weapon = pack.weapons.find((w) => w.kind === 'RANGED')!
const BASE_R = 0.63 // ~32mm/25.4 英寸
const SCALE = 20 // px/英寸
const BOARD_W = 30 // 英寸
const BOARD_H = 20

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

function mkToken(side: 'a' | 'b', idx: number, x: number, y: number): Token {
  return { uid: `${side}${idx}`, side, name: `战术兵${side.toUpperCase()}${idx}`, pos: { x, y }, wounds: 13, alive: true }
}

function initialTokens(): Token[] {
  return [
    mkToken('a', 1, 3, 6),
    mkToken('a', 2, 3, 14),
    mkToken('b', 1, 27, 6),
    mkToken('b', 2, 27, 14),
  ]
}

export function MatchView() {
  const [tokens, setTokens] = useState<Token[]>(initialTokens)
  const [objectives] = useState<Point[]>([{ x: 15, y: 10 }])
  const [turn, setTurn] = useState<TurnState>(createInitialTurnState())
  const [vp, setVp] = useState<{ a: number; b: number }>({ a: 0, b: 0 })
  const [log, setLog] = useState<string[]>(['战斗开始（占领目标点）'])
  const [selected, setSelected] = useState<string | null>(null)
  const [winner, setWinner] = useState<string | null>(null)

  const activeToken = tokens.find((t) => t.uid === selected) ?? null
  const pushLog = (s: string) => setLog((l) => [s, ...l].slice(0, 30))

  function toBoard(): Board {
    const ops: OperativePlacement[] = tokens
      .filter((t) => t.alive)
      .map((t) => ({ operativeId: t.uid, pos: t.pos, baseRadius: BASE_R }))
    return { terrain: TERRAIN, operatives: ops }
  }

  function activate() {
    if (!activeToken || activeToken.side !== turn.activePlayer) return
    setTurn((s) => {
      const next = { ...s, operatives: { ...s.operatives, [activeToken.uid]: { order: 'ENGAGED' as const, ready: true, apUsed: 0, actionsThisActivation: [], fallBackDone: false, chargeDone: false, moveDone: false } } }
      return turnReducer(next, { type: 'ACTIVATE', opId: activeToken.uid, player: activeToken.side })
    })
    pushLog(`${activeToken.name} 激活`)
  }

  function moveSelectedTo(p: Point) {
    if (!activeToken) return
    setTokens((ts) => ts.map((t) => (t.uid === activeToken.uid ? { ...t, pos: clampPos(p) } : t)))
    pushLog(`${activeToken.name} 移动 → ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  }

  function shoot(targetUid: string) {
    if (!activeToken) return
    const target = tokens.find((t) => t.uid === targetUid)
    if (!target || target.side === activeToken.side) return
    const board = toBoard()
    const aPl: OperativePlacement = { operativeId: activeToken.uid, pos: activeToken.pos, baseRadius: BASE_R }
    const dPl: OperativePlacement = { operativeId: target.uid, pos: target.pos, baseRadius: BASE_R }
    const los = losFinding(activeToken.pos, target.pos, board)
    const range = rangeFinding(aPl, dPl, weapon.profile.range ?? 99)
    const others = tokens.filter((t) => t.alive && t.uid !== target.uid).map((t) => t.pos)
    const cover = coverFinding(target.pos, board, others)
    if (!los.finalValue) { pushLog(`⚠ ${target.name} 不可见（LOS 阻断）`); return }
    if (!range.finalValue) { pushLog(`⚠ ${target.name} 超射程`); return }
    const dice = new ElectronicDiceSource(hashSeed(`${activeToken.uid}->${target.uid}`, 'SHOOT', log.length))
    const r = runShooting({
      attacker: { operativeId: activeToken.uid, weapon },
      defender: { operativeId: target.uid, save: 3, wounds: target.wounds },
      effects: [],
      dice,
      hasCover: cover.finalValue,
    })
    const newWounds = Math.max(0, target.wounds - r.woundsDealt)
    setTokens((ts) => ts.map((t) => (t.uid === target.uid ? { ...t, wounds: newWounds, alive: newWounds > 0 } : t)))
    pushLog(`${activeToken.name} 射击 ${target.name} → 造伤 ${r.woundsDealt}${newWounds <= 0 ? '（残废）' : `（剩${newWounds}）`}${cover.finalValue ? ' [掩护]' : ''}${los.confidence === 'AMBIGUOUS' ? ' [LOS模糊可翻]' : ''}`)
  }

  function endActivation() {
    if (!activeToken) return
    setTurn((s) => turnReducer(s, { type: 'END_ACTIVATION', opId: activeToken.uid }))
    setSelected(null)
    pushLog(`${activeToken.name} 结束激活`)
  }

  function scoreAndEndTP() {
    // 占领目标点：范围内友方数优势 → +1 VP
    const scored = { a: vp.a, b: vp.b }
    for (const o of objectives) {
      const nearA = tokens.filter((t) => t.alive && t.side === 'a' && dist(t.pos, o) <= 3).length
      const nearB = tokens.filter((t) => t.alive && t.side === 'b' && dist(t.pos, o) <= 3).length
      if (nearA > nearB) scored.a++
      else if (nearB > nearA) scored.b++
    }
    setVp(scored)
    const next = turnReducer(turn, { type: 'END_TURNING_POINT' })
    setTurn(next)
    pushLog(`转折点 ${turn.turningPoint} 结束 — 控制 VP A:${scored.a} B:${scored.b}`)
    if (next.phase === 'BATTLE_END') {
      setWinner(scored.a > scored.b ? 'A 胜' : scored.b > scored.a ? 'B 胜' : '平局')
      pushLog(`战斗结束 → ${scored.a > scored.b ? 'A 胜' : scored.b > scored.a ? 'B 胜' : '平局'}`)
    } else {
      // 切换先手（简化：交替）
      setTurn((s) => ({ ...s, activePlayer: s.activePlayer === 'a' ? 'b' : 'a' }))
    }
  }

  if (winner) {
    return (
      <div className="demo">
        <h2>战斗结束</h2>
        <p className="outcome">胜负：<strong>{winner}</strong> — VP A:{vp.a} B:{vp.b}</p>
        <button className="primary" onClick={() => { setTokens(initialTokens()); setTurn(createInitialTurnState()); setVp({ a: 0, b: 0 }); setWinner(null); setLog(['战斗开始（占领目标点）']) }}>再开一局</button>
      </div>
    )
  }

  return (
    <div className="demo">
      <h2>对局 · 转折点 {turn.turningPoint}/4 · 主动 {turn.activePlayer.toUpperCase()} · VP A:{vp.a} B:{vp.b}</h2>
      <div className="row">
        <button onClick={activate} disabled={!activeToken || activeToken.side !== turn.activePlayer}>激活选中</button>
        <button onClick={endActivation} disabled={!activeToken}>结束激活</button>
        <button className="primary" onClick={scoreAndEndTP}>结束转折点（计分）</button>
      </div>
      <div
        className="board"
        style={{ width: BOARD_W * SCALE, height: BOARD_H * SCALE }}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          moveSelectedTo({ x: (e.clientX - rect.left) / SCALE, y: (e.clientY - rect.top) / SCALE })
        }}
      >
        {/* 地形 */}
        {TERRAIN.filter((t) => t.kind === 'BLOCKING').map((t) => {
          const xs = t.polygon.map((p) => p.x); const ys = t.polygon.map((p) => p.y)
          const l = Math.min(...xs) * SCALE, tp = Math.min(...ys) * SCALE
          const w = (Math.max(...xs) - Math.min(...xs)) * SCALE, h = (Math.max(...ys) - Math.min(...ys)) * SCALE
          return <div key={t.id} className="terrain" style={{ left: l, top: tp, width: w, height: h }} />
        })}
        {/* 目标点 */}
        {objectives.map((o, i) => (
          <div key={i} className="objective" style={{ left: o.x * SCALE - 8, top: o.y * SCALE - 8 }} title="目标点 控制3英寸" />
        ))}
        {/* 特工 */}
        {tokens.filter((t) => t.alive).map((t) => (
          <button
            key={t.uid}
            className={`token ${t.side} ${selected === t.uid ? 'sel' : ''}`}
            style={{ left: t.pos.x * SCALE - 11, top: t.pos.y * SCALE - 11 }}
            onClick={(e) => {
              e.stopPropagation()
              if (activeToken && t.side !== activeToken.side) shoot(t.uid)
              else setSelected(t.uid)
            }}
            title={`${t.name} 耐伤${t.wounds}`}
          >
            {t.side.toUpperCase()}
          </button>
        ))}
      </div>
      <p className="muted">点空地=移动选中特工；点敌方=射击；点己方=选中。控制范围 3 英寸。</p>
      <ul className="trace">
        {log.map((l, i) => <li key={i}><span className="sum">{l}</span></li>)}
      </ul>
    </div>
  )
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
function clampPos(p: Point): Point {
  return { x: Math.max(0.5, Math.min(BOARD_W - 0.5, p.x)), y: Math.max(0.5, Math.min(BOARD_H - 0.5, p.y)) }
}
