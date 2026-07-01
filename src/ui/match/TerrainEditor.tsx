import { useState, useRef } from 'react'
import type { Point, TerrainFeature, TerrainKind } from '../../geometry'
import { SCALE } from './Board'

// 1.12 T2：自定义画地形。工具：矩形/多边形/橡皮 + 网格吸附；
// 属性标签多选（kind: BLOCKING/COVER/OBSCURING + 制高点/可攀爬）。
// 会话内有效（D-20）。与对局期画地形（1.14 T6）共享 TerrainFeature 产物结构。
type Tool = 'rect' | 'polygon' | 'eraser'

let pieceId = 0

export function TerrainEditor({
  bounds,
  terrain,
  onAdd,
  onRemove,
  onDone,
}: {
  bounds: { w: number; h: number }
  terrain: TerrainFeature[]
  onAdd: (t: TerrainFeature) => void
  onRemove: (id: string) => void
  onDone: () => void
}) {
  const [tool, setTool] = useState<Tool>('rect')
  const [kind, setKind] = useState<TerrainKind>('BLOCKING')
  const [vantage, setVantage] = useState(false)
  const [climbable, setClimbable] = useState(false)
  const [snap, setSnap] = useState(true)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [dragCur, setDragCur] = useState<Point | null>(null)
  const [polyVerts, setPolyVerts] = useState<Point[]>([])
  const svgRef = useRef<SVGSVGElement>(null)

  const W = bounds.w * SCALE
  const H = bounds.h * SCALE

  function snapPt(p: Point): Point {
    return snap ? { x: Math.round(p.x), y: Math.round(p.y) } : p
  }
  function evtPt(e: { clientX: number; clientY: number }): Point {
    const r = svgRef.current!.getBoundingClientRect()
    return snapPt({ x: (e.clientX - r.left) / SCALE, y: (e.clientY - r.top) / SCALE })
  }
  function makePiece(poly: Point[]): TerrainFeature | null {
    if (poly.length < 3) return null
    pieceId += 1
    return { id: `t${pieceId}`, kind, polygon: poly, vantage: vantage || undefined, climbable: climbable || undefined }
  }

  function onDown(e: React.PointerEvent) {
    const p = evtPt(e)
    if (tool === 'rect') setDragStart(p)
    else if (tool === 'polygon') setPolyVerts((v) => [...v, p])
    else if (tool === 'eraser') {
      // 命中删除：点中其 bbox 的最近一块
      const hit = [...terrain].reverse().find((t) => {
        const xs = t.polygon.map((q) => q.x), ys = t.polygon.map((q) => q.y)
        return p.x >= Math.min(...xs) && p.x <= Math.max(...xs) && p.y >= Math.min(...ys) && p.y <= Math.max(...ys)
      })
      if (hit) onRemove(hit.id)
    }
  }
  function onMove(e: React.PointerEvent) {
    if (tool === 'rect' && dragStart) setDragCur(evtPt(e))
  }
  function onUp() {
    if (tool === 'rect' && dragStart && dragCur) {
      const a = dragStart, b = dragCur
      const poly = [
        { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
        { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
        { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
        { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
      ]
      const piece = makePiece(poly)
      if (piece) onAdd(piece)
    }
    setDragStart(null)
    setDragCur(null)
  }
  function finishPolygon() {
    const piece = makePiece(polyVerts)
    if (piece) onAdd(piece)
    setPolyVerts([])
  }

  const previewRect =
    tool === 'rect' && dragStart && dragCur
      ? [
          { x: Math.min(dragStart.x, dragCur.x), y: Math.min(dragStart.y, dragCur.y) },
          { x: Math.max(dragStart.x, dragCur.x), y: Math.min(dragStart.y, dragCur.y) },
          { x: Math.max(dragStart.x, dragCur.x), y: Math.max(dragStart.y, dragCur.y) },
          { x: Math.min(dragStart.x, dragCur.x), y: Math.max(dragStart.y, dragCur.y) },
        ]
      : null

  const fillFor = (k: TerrainKind) => (k === 'BLOCKING' ? '#5a4030' : k === 'COVER' ? '#3a5a3a' : '#4a4a6a')

  return (
    <div className="terrain-editor">
      <h2>画地形（自定义板）</h2>
      <div className="te-toolbar">
        {(['rect', 'polygon', 'eraser'] as Tool[]).map((t) => (
          <button key={t} className={tool === t ? 'active' : ''} onClick={() => { setTool(t); setPolyVerts([]) }}>
            {t === 'rect' ? '矩形' : t === 'polygon' ? '多边形' : '橡皮'}
          </button>
        ))}
        <span className="te-sep" />
        {(['BLOCKING', 'COVER', 'OBSCURING'] as TerrainKind[]).map((k) => (
          <label key={k} className="cover">
            <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
            <span style={{ color: fillFor(k) }}>■</span> {k}
          </label>
        ))}
        <span className="te-sep" />
        <label className="cover"><input type="checkbox" checked={vantage} onChange={(e) => setVantage(e.target.checked)} /> 制高点</label>
        <label className="cover"><input type="checkbox" checked={climbable} onChange={(e) => setClimbable(e.target.checked)} /> 可攀爬</label>
        <label className="cover"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> 网格吸附</label>
        {tool === 'polygon' && (
          <button className="primary" onClick={finishPolygon} disabled={polyVerts.length < 3}>
            完成多边形（{polyVerts.length}）
          </button>
        )}
        <button className="primary" onClick={onDone}>进入部署 ▶</button>
      </div>

      <svg
        ref={svgRef}
        className="te-canvas"
        width={W}
        height={H}
        style={{ cursor: tool === 'eraser' ? 'not-allowed' : 'crosshair' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {/* 网格 */}
        {snap &&
          Array.from({ length: Math.floor(bounds.w) + 1 }, (_, i) => (
            <line key={`vx${i}`} x1={i * SCALE} y1={0} x2={i * SCALE} y2={H} stroke="#22262e" strokeWidth={0.5} />
          ))}
        {snap &&
          Array.from({ length: Math.floor(bounds.h) + 1 }, (_, i) => (
            <line key={`hy${i}`} x1={0} y1={i * SCALE} x2={W} y2={i * SCALE} stroke="#22262e" strokeWidth={0.5} />
          ))}
        {/* 已绘地形 */}
        {terrain.map((t) => (
          <polygon key={t.id} points={t.polygon.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')} fill={fillFor(t.kind)} opacity={0.8} stroke="#000" strokeWidth={0.5} />
        ))}
        {/* 预览矩形 */}
        {previewRect && (
          <polygon points={previewRect.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')} fill={fillFor(kind)} opacity={0.5} />
        )}
        {/* 多边形顶点 */}
        {polyVerts.map((v, i) => (
          <circle key={i} cx={v.x * SCALE} cy={v.y * SCALE} r={3} fill="var(--accent)" />
        ))}
        {polyVerts.length >= 2 && (
          <polyline points={polyVerts.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')} fill="none" stroke={fillFor(kind)} strokeWidth={1} opacity={0.6} />
        )}
      </svg>
      <p className="muted">英寸坐标 {bounds.w}×{bounds.h}。属性标签在下一次绘制生效。橡皮点中地形块即删。</p>
    </div>
  )
}
