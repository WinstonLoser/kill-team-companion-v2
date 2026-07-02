import { useMatchStore, type MatchToken, type Side } from '../../state/matchStore'
import { circleInsidePolygon, circlesOverlap, type Point } from '../../geometry'
import { Board } from './Board'

// 1.12 T3-T6：部署阶段。交替 A/B 在己方降落区落子；合法性拦截（底座圆在降落区 + 不重叠）；
// 双击旋转朝向；全部署完 → 「开始转折点 1」门禁。

function clampPos(p: Point, bounds: { w: number; h: number }): Point {
  return { x: Math.max(0.5, Math.min(bounds.w - 0.5, p.x)), y: Math.max(0.5, Math.min(bounds.h - 0.5, p.y)) }
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

  const bounds = mapPack.bounds
  const unplacedA = tokens.filter((t) => t.side === 'a' && !t.placed)
  const unplacedB = tokens.filter((t) => t.side === 'b' && !t.placed)
  const deploySide: Side = unplacedA.length >= unplacedB.length ? 'a' : 'b'
  const allPlaced = unplacedA.length === 0 && unplacedB.length === 0

  function tryPlace(side: Side, p: Point) {
    const zone = side === 'a' ? mapPack.dropZones.a : mapPack.dropZones.b
    const pos = clampPos(p, bounds)
    const next = tokens.find((t) => t.side === side && !t.placed)
    if (!next) return
    // T4 合法性：底座圆完全在降落区 + 不与已部署重叠
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
    pushLog('deploy', `${next.name} 部署于 ${pos.x.toFixed(1)},${pos.y.toFixed(1)}`)
  }

  function onBoardClick(p: Point) {
    if (allPlaced) return
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
        // 拖动落定也校验降落区
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
      <div className="pushbar">
        {allPlaced
          ? `部署完成 · 可开始转折点 1`
          : `部署 · 轮到 ${deploySide.toUpperCase()} 方 · 点击己方降落区放置特工（A 暖 / B 冷）`}
      </div>

      <div className="row">
        <button className="primary" disabled={!allPlaced} onClick={onBeginPlay} title={allPlaced ? '开始转折点 1' : `待部署：A×${unplacedA.length} B×${unplacedB.length}`}>
          开始转折点 1 ▶
        </button>
        <span className="muted"> 待部署 A×{unplacedA.length} B×{unplacedB.length} · 双击特工旋转朝向 · 拖动微调</span>
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
