import { useMatchStore, type MatchToken, type Side } from '../../state/matchStore'
import { circleInsidePolygon, circlesOverlap, type Point } from '../../geometry'
import { Board } from './Board'

// 部署阶段（对齐 lite rule §部署）：
//  1. 部署前掷先手权（按钮即时出结果；动画后续补）。
//  2. 从先手方开始，轮流部署本队 1/3（向上取整），3 轮放完。
//  3. 落点须完全在己方降落区 + 不重叠；部署即隐匿（token.order=CONCEAL，建队时已置）。

function clampPos(p: Point, bounds: { w: number; h: number }): Point {
  return { x: Math.max(0.5, Math.min(bounds.w - 0.5, p.x)), y: Math.max(0.5, Math.min(bounds.h - 0.5, p.y)) }
}

interface DeployTurn { side: Side; count: number; round: number }

/** 按规则生成分批部署序列：每轮先手方先手，各方各放 ceil(N/3)。 */
function buildSequence(nA: number, nB: number, initiative: Side): DeployTurn[] {
  const chunk = (n: number) => Math.max(1, Math.ceil(n / 3))
  const ca = chunk(nA), cb = chunk(nB)
  const order: Side[] = initiative === 'a' ? ['a', 'b'] : ['b', 'a']
  const seq: DeployTurn[] = []
  let placedA = 0, placedB = 0
  for (let round = 0; round < 3; round++) {
    for (const side of order) {
      const placed = side === 'a' ? placedA : placedB
      const n = side === 'a' ? nA : nB
      const c = side === 'a' ? ca : cb
      const remaining = n - placed
      if (remaining > 0) {
        const count = Math.min(c, remaining)
        seq.push({ side, count, round })
        if (side === 'a') placedA += count; else placedB += count
      }
    }
  }
  return seq
}

/** 由已放置总数推算当前轮到谁、本轮已放几名。 */
function currentTurn(seq: DeployTurn[], totalPlaced: number): { turn: DeployTurn; placedInTurn: number } | null {
  let acc = 0
  for (const turn of seq) {
    if (totalPlaced < acc + turn.count) return { turn, placedInTurn: totalPlaced - acc }
    acc += turn.count
  }
  return null
}

export function DeployPhase({ onBeginPlay }: { onBeginPlay: () => void }) {
  const mapPack = useMatchStore((s) => s.mapPack)!
  const tokens = useMatchStore((s) => s.tokens)
  const placeToken = useMatchStore((s) => s.placeToken)
  const rotateToken = useMatchStore((s) => s.rotateToken)
  const moveToken = useMatchStore((s) => s.moveToken)
  const dragging = useMatchStore((s) => s.dragging)
  const setDragging = useMatchStore((s) => s.setDragging)
  const pushLog = useMatchStore((s) => s.pushLog)
  const setIntercept = useMatchStore((s) => s.setIntercept)
  const intercept = useMatchStore((s) => s.intercept)
  const deployInitiative = useMatchStore((s) => s.deployInitiative)
  const deployDice = useMatchStore((s) => s.deployDice)
  const rollDeployInitiative = useMatchStore((s) => s.rollDeployInitiative)

  const bounds = mapPack.bounds
  const totalA = tokens.filter((t) => t.side === 'a').length
  const totalB = tokens.filter((t) => t.side === 'b').length
  const placedA = tokens.filter((t) => t.side === 'a' && t.placed).length
  const placedB = tokens.filter((t) => t.side === 'b' && t.placed).length
  const totalPlaced = placedA + placedB
  const allPlaced = totalPlaced === tokens.length && tokens.length > 0

  const seq = deployInitiative ? buildSequence(totalA, totalB, deployInitiative) : []
  const cur = currentTurn(seq, totalPlaced)
  const deploySide: Side | null = cur?.turn.side ?? null
  const round = cur?.turn.round ?? 0
  const placedInTurn = cur?.placedInTurn ?? 0
  const needThisTurn = cur?.turn.count ?? 0
  const canReroll = totalPlaced === 0 // 放下第一名后锁定先手

  function tryPlace(side: Side, p: Point) {
    const zone = side === 'a' ? mapPack.dropZones.a : mapPack.dropZones.b
    const pos = clampPos(p, bounds)
    const next = tokens.find((t) => t.side === side && !t.placed)
    if (!next) return
    if (!circleInsidePolygon(pos, next.baseRadius, zone)) {
      setIntercept({ title: '出降落区', reasons: [`落点 ${pos.x.toFixed(1)},${pos.y.toFixed(1)} 底座未完全在 ${side.toUpperCase()} 方降落区内`] })
      return
    }
    const overlap = tokens.filter((t) => t.placed).find((t) => circlesOverlap(pos, next.baseRadius, t.pos, t.baseRadius))
    if (overlap) {
      setIntercept({ title: '与特工重叠', reasons: [`与 ${overlap.name} 底座重叠`] })
      return
    }
    setIntercept(null)
    placeToken(next.uid, pos, next.facing)
    pushLog('deploy', `${next.name} 部署于 ${pos.x.toFixed(1)},${pos.y.toFixed(1)}（隐匿）`)
  }

  function onBoardClick(p: Point) {
    if (allPlaced || !deploySide) return
    if (deploySide !== cur!.turn.side) return
    tryPlace(deploySide, p)
  }

  function onTokenPointerDown(t: MatchToken) {
    if (t.placed) setDragging(t.uid, t.pos)
  }
  function onPointerMove(p: Point) {
    if (dragging) moveToken(dragging, clampPos(p, bounds))
  }
  function onPointerUp() {
    if (dragging) {
      const t = tokens.find((x) => x.uid === dragging)
      if (t) {
        const zone = t.side === 'a' ? mapPack.dropZones.a : mapPack.dropZones.b
        if (!circleInsidePolygon(t.pos, t.baseRadius, zone)) {
          setIntercept({ title: '出降落区', reasons: [`${t.name} 拖出己方降落区，已拉回`] })
        } else pushLog('deploy', `${t.name} 移动至 ${t.pos.x.toFixed(1)},${t.pos.y.toFixed(1)}`)
      }
      setDragging(null)
    }
  }

  return (
    <div className="deploy-phase">
      {/* 先手权未定：掷骰门禁 */}
      {!deployInitiative || !deployDice ? (
        <div className="deploy-init-roll">
          <strong>部署前 · 决定先手权</strong>
          <p className="muted">随机掷骰，胜方先部署并先选降落区。</p>
          <button className="primary dice-btn" onClick={() => rollDeployInitiative()}>🎲 掷 D6 定先手</button>
        </div>
      ) : (
        <div className="pushbar">
          <span className="deploy-init">
            先手骰 A={deployDice.a} B={deployDice.b} → <strong>{deployInitiative.toUpperCase()} 方先手</strong>
            {canReroll && <button className="mini-btn" onClick={() => rollDeployInitiative()} title="重掷（放下第一名后锁定）">重掷</button>}
          </span>
          <span className="deploy-step">
            {allPlaced
              ? `部署完成 · 可开始转折点 1`
              : `第 ${round + 1} 轮 · 轮到 ${deploySide!.toUpperCase()} 方 · 本轮 ${needThisTurn} 名（已放 ${placedInTurn}）`}
          </span>
        </div>
      )}

      <div className="row">
        <button className="primary" disabled={!allPlaced} onClick={onBeginPlay} title={allPlaced ? '开始转折点 1' : `待部署：A×${totalA - placedA} B×${totalB - placedB}`}>
          开始转折点 1 ▶
        </button>
        <span className="muted"> {`进度 A ${placedA}/${totalA} · B ${placedB}/${totalB} · 双击特工旋转朝向 · 拖动微调 · 部署即隐匿`}</span>
      </div>

      {intercept && (
        <div className="intercept-card">
          <strong>⚠ {intercept.title}</strong>
          <button className="intercept-close" onClick={() => setIntercept(null)}>✕</button>
          <ul>{intercept.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}

      <Board
        mapPack={mapPack}
        terrain={mapPack.terrain}
        tokens={tokens}
        objectives={mapPack.objectives}
        phase="deploy"
        selected={null}
        rangeRing={null}
        controlRing={null}
        ownCover={null}
        losLines={[]}
        objControl={mapPack.objectives.map((o) => ({ id: o.id, ctrl: null }))}
        onBoardClick={onBoardClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onTokenPointerDown={onTokenPointerDown}
        onTokenDoubleClick={(t) => rotateToken(t.uid)}
      />
    </div>
  )
}
