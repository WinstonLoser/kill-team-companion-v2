import { useState, useRef } from 'react'
import type { Point, TerrainFeature, TerrainKind } from '../../geometry'
import type { ObjectiveMarker } from '../../data/maps'
import { SCALE } from './Board'

// 1.12 T2（D2 补全）：自定义画地形。
// 工具：矩形/多边形/橡皮/复制/镜像 + 网格吸附；属性标签多选（kind + 制高点/可攀爬/困难地形）；
// 独立放目标点 + 双方降落区多边形。draft 本地编辑，完成时一次性 commit（会话内 D-20）。
type Tool = 'rect' | 'polygon' | 'eraser' | 'copy' | 'mirror' | 'objective' | 'dropzone'

let pieceId = 0

export function TerrainEditor({
  bounds,
  initialTerrain,
  initialObjectives,
  initialDropA,
  initialDropB,
  onCommit,
}: {
  bounds: { w: number; h: number }
  initialTerrain: TerrainFeature[]
  initialObjectives: ObjectiveMarker[]
  initialDropA: Point[]
  initialDropB: Point[]
  onCommit: (draft: { terrain: TerrainFeature[]; objectives: ObjectiveMarker[]; dropA: Point[]; dropB: Point[] }) => void
}) {
  const [tool, setTool] = useState<Tool>('rect')
  const [kind, setKind] = useState<TerrainKind>('BLOCKING')
  const [vantage, setVantage] = useState(false)
  const [climbable, setClimbable] = useState(false)
  const [difficult, setDifficult] = useState(false)
  const [snap, setSnap] = useState(true)
  const [dzSide, setDzSide] = useState<'a' | 'b'>('a')

  const [terrain, setTerrain] = useState<TerrainFeature[]>(initialTerrain)
  const [objectives, setObjectives] = useState<ObjectiveMarker[]>(initialObjectives)
  const [dropA, setDropA] = useState<Point[]>(initialDropA)
  const [dropB, setDropB] = useState<Point[]>(initialDropB)

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
    return { id: `t${pieceId}`, kind, polygon: poly, vantage: vantage || undefined, climbable: climbable || undefined, difficult: difficult || undefined }
  }
  function bboxOf(poly: Point[]) {
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y)
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  }

  function onDown(e: React.PointerEvent) {
    const p = evtPt(e)
    if (tool === 'rect') setDragStart(p)
    else if (tool === 'polygon') setPolyVerts((v) => [...v, p])
    else if (tool === 'eraser') {
      const hit = [...terrain].reverse().find((t) => {
        const b = bboxOf(t.polygon)
        return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY
      })
      if (hit) setTerrain((ts) => ts.filter((t) => t.id !== hit.id))
    } else if (tool === 'copy') {
      const last = terrain[terrain.length - 1]
      if (last) {
        const shifted = last.polygon.map((pt) => ({ x: pt.x + 1, y: pt.y + 1 }))
        const piece = makePiece(shifted)
        if (piece) setTerrain((ts) => [...ts, piece])
      }
    } else if (tool === 'mirror') {
      const last = terrain[terrain.length - 1]
      if (last) {
        const cx = bounds.w / 2
        const mirrored = last.polygon.map((pt) => ({ x: 2 * cx - pt.x, y: pt.y }))
        const piece = makePiece(mirrored)
        if (piece) setTerrain((ts) => [...ts, piece])
      }
    } else if (tool === 'objective') {
      setObjectives((os) => [...os, { id: `obj${os.length + 1}`, pos: p, controlRange: 3 }])
    } else if (tool === 'dropzone') {
      setPolyVerts((v) => [...v, p])
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
      if (piece) setTerrain((ts) => [...ts, piece])
    } else if (tool === 'dropzone' && polyVerts.length >= 3) {
      // 拖放结束不自动闭；用"完成降落区"按钮闭合
    }
    setDragStart(null)
    setDragCur(null)
  }
  function finishPolygon() {
    if (tool === 'polygon') {
      const piece = makePiece(polyVerts)
      if (piece) setTerrain((ts) => [...ts, piece])
      setPolyVerts([])
    } else if (tool === 'dropzone' && polyVerts.length >= 3) {
      const poly = polyVerts
      if (dzSide === 'a') setDropA(poly)
      else setDropB(poly)
      setPolyVerts([])
    }
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
  const drawingPoly = tool === 'polygon' || tool === 'dropzone'

  return (
    <div className="terrain-editor">
      <h2>画地形 + 放目标点/降落区（自定义板）</h2>
      <div className="te-toolbar">
        {(['rect', 'polygon', 'eraser', 'copy', 'mirror', 'objective', 'dropzone'] as Tool[]).map((t) => (
          <button key={t} className={tool === t ? 'active' : ''} onClick={() => { setTool(t); setPolyVerts([]) }}
            title={t === 'copy' ? '复制最后一块（偏移）' : t === 'mirror' ? '镜像最后一块（左右）' : t === 'objective' ? '点击放目标点' : t === 'dropzone' ? '点顶点画降落区多边形' : t}>
            {t === 'rect' ? '矩形' : t === 'polygon' ? '多边形' : t === 'eraser' ? '橡皮' : t === 'copy' ? '复制' : t === 'mirror' ? '镜像' : t === 'objective' ? '目标点' : '降落区'}
          </button>
        ))}
        {tool === 'dropzone' && (
          <label className="cover">方
            <select value={dzSide} onChange={(e) => setDzSide(e.target.value as 'a' | 'b')}>
              <option value="a">A</option>
              <option value="b">B</option>
            </select>
          </label>
        )}
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
        <label className="cover"><input type="checkbox" checked={difficult} onChange={(e) => setDifficult(e.target.checked)} /> 困难地形</label>
        <label className="cover"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> 网格吸附</label>
        {drawingPoly && (
          <button className="primary" onClick={finishPolygon} disabled={polyVerts.length < 3}>
            {tool === 'dropzone' ? `完成降落区${dzSide.toUpperCase()}（${polyVerts.length}）` : `完成多边形（${polyVerts.length}）`}
          </button>
        )}
        <button className="primary" onClick={() => onCommit({ terrain, objectives, dropA, dropB })}>进入部署 ▶</button>
      </div>

      <svg ref={svgRef} className="te-canvas" width={W} height={H}
        style={{ cursor: tool === 'eraser' ? 'not-allowed' : 'crosshair' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
        {/* 网格 */}
        {snap && Array.from({ length: Math.floor(bounds.w) + 1 }, (_, i) => (
          <line key={`vx${i}`} x1={i * SCALE} y1={0} x2={i * SCALE} y2={H} stroke="#22262e" strokeWidth={0.5} />
        ))}
        {snap && Array.from({ length: Math.floor(bounds.h) + 1 }, (_, i) => (
          <line key={`hy${i}`} x1={0} y1={i * SCALE} x2={W} y2={i * SCALE} stroke="#22262e" strokeWidth={0.5} />
        ))}
        {/* 降落区 */}
        {dropA.length >= 3 && <polygon points={dropA.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')} fill="rgba(199,93,58,0.15)" stroke="var(--side-a)" strokeDasharray="4 3" />}
        {dropB.length >= 3 && <polygon points={dropB.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')} fill="rgba(58,123,199,0.15)" stroke="var(--side-b)" strokeDasharray="4 3" />}
        {/* 地形 */}
        {terrain.map((t) => (
          <polygon key={t.id} points={t.polygon.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')} fill={fillFor(t.kind)} opacity={t.difficult ? 0.5 : 0.8} stroke={t.difficult ? '#d9a239' : '#000'} strokeWidth={t.difficult ? 1.5 : 0.5}>
            <title>{t.kind}${t.vantage ? ' · 制高点' : ''}${t.climbable ? ' · 可攀爬' : ''}${t.difficult ? ' · 困难' : ''}</title>
          </polygon>
        ))}
        {/* 目标点 */}
        {objectives.map((o) => (
          <circle key={o.id} cx={o.pos.x * SCALE} cy={o.pos.y * SCALE} r={5} fill="var(--accent)" stroke="#fff" strokeWidth={1} />
        ))}
        {previewRect && <polygon points={previewRect.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')} fill={fillFor(kind)} opacity={0.5} />}
        {polyVerts.map((v, i) => (<circle key={i} cx={v.x * SCALE} cy={v.y * SCALE} r={3} fill="var(--accent)" />))}
        {polyVerts.length >= 2 && (<polyline points={polyVerts.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')} fill="none" stroke={tool === 'dropzone' ? (dzSide === 'a' ? 'var(--side-a)' : 'var(--side-b)') : fillFor(kind)} strokeWidth={1} opacity={0.6} />)}
      </svg>
      <p className="muted">英寸 {bounds.w}×{bounds.h}。属性标签下一次绘制生效。困难地形=橙边半透明。橡皮点中即删。</p>
    </div>
  )
}
