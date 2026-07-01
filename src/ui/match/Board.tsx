import type { Point, TerrainFeature } from '../../geometry'
import type { ObjectiveMarker, MapPack } from '../../data/maps'
import type { MatchToken, Side } from '../../state/matchStore'

export const SCALE = 20 // 像素/英寸

export interface LosLine { target: Point; stroke: string; dash: string; opacity: number }
export interface ObjControl { id: string; ctrl: Side | null }

export function Board({
  mapPack,
  terrain,
  tokens,
  objectives,
  phase,
  selected,
  rangeRing,
  losLines,
  objControl,
  onBoardPointerDown,
  onBoardClick,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onTokenPointerDown,
  onTokenDoubleClick,
  onTokenClick,
  onObjectiveHover,
}: {
  mapPack: MapPack | null
  terrain: TerrainFeature[]
  tokens: MatchToken[]
  objectives: ObjectiveMarker[]
  phase: string
  selected: string | null
  rangeRing: { center: Point; r: number } | null
  losLines: LosLine[]
  objControl: ObjControl[]
  onBoardPointerDown?: (p: Point) => void
  onBoardClick?: (p: Point) => void
  onPointerMove?: (p: Point) => void
  onPointerUp?: () => void
  onPointerLeave?: () => void
  onTokenPointerDown?: (t: MatchToken) => void
  onTokenDoubleClick?: (t: MatchToken) => void
  onTokenClick?: (t: MatchToken) => void
  onObjectiveHover?: (o: ObjectiveMarker | null) => void
}) {
  const bounds = mapPack?.bounds ?? { w: 30, h: 20 }
  const W = bounds.w * SCALE
  const H = bounds.h * SCALE
  const ctrlColor = (c: Side | null) => (c === 'a' ? 'var(--side-a)' : c === 'b' ? 'var(--side-b)' : '#6b7280')

  function evtPoint(e: { clientX: number; clientY: number; currentTarget: HTMLDivElement }): Point {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / SCALE, y: (e.clientY - r.top) / SCALE }
  }

  return (
    <div
      className={`board ${phase === 'deploy' ? 'deploying' : ''}`}
      style={{ width: W, height: H }}
      onPointerMove={(e) => onPointerMove?.(evtPoint(e))}
      onPointerUp={() => onPointerUp?.()}
      onPointerLeave={() => onPointerLeave?.()}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onBoardPointerDown?.(evtPoint(e))
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onBoardClick?.(evtPoint(e))
      }}
    >
      {/* 网格背景 */}
      <div className="grid-bg" style={{ width: W, height: H }} />

      <svg className="overlay" width={W} height={H}>
        {/* 降落区 */}
        {phase === 'deploy' && mapPack && (
          <>
            <polygon
              points={mapPack.dropZones.a.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')}
              fill="rgba(199,93,58,0.10)"
              stroke="var(--side-a)"
              strokeDasharray="4 3"
            />
            <polygon
              points={mapPack.dropZones.b.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')}
              fill="rgba(58,123,199,0.10)"
              stroke="var(--side-b)"
              strokeDasharray="4 3"
            />
          </>
        )}

        {/* 射程环 */}
        {rangeRing && (
          <circle
            cx={rangeRing.center.x * SCALE}
            cy={rangeRing.center.y * SCALE}
            r={rangeRing.r * SCALE}
            className="rangedot"
          />
        )}

        {/* LOS 射线 */}
        {losLines.map((l, i) => (
          <line
            key={i}
            x1={rangeRing ? rangeRing.center.x * SCALE : 0}
            y1={rangeRing ? rangeRing.center.y * SCALE : 0}
            x2={l.target.x * SCALE}
            y2={l.target.y * SCALE}
            stroke={l.stroke}
            strokeWidth={2}
            strokeDasharray={l.dash}
            opacity={l.opacity}
          />
        ))}
      </svg>

      {/* 地形 */}
      {terrain.map((t) => {
        const xs = t.polygon.map((p) => p.x)
        const ys = t.polygon.map((p) => p.y)
        const left = Math.min(...xs) * SCALE
        const top = Math.min(...ys) * SCALE
        const w = (Math.max(...xs) - Math.min(...xs)) * SCALE
        const h = (Math.max(...ys) - Math.min(...ys)) * SCALE
        const cls = t.kind === 'BLOCKING' ? 'terrain blocking' : t.kind === 'COVER' ? 'terrain cover' : 'terrain obscuring'
        return (
          <div
            key={t.id}
            className={cls}
            style={{ left, top, width: w, height: h }}
            title={`${t.kind}${t.vantage ? ' · 制高点' : ''}${t.climbable ? ' · 可攀爬' : ''}`}
          />
        )
      })}

      {/* 目标点（1.16 控制染色） */}
      {phase !== 'map-select' &&
        objectives.map((o, i) => {
          const ctrl = objControl.find((c) => c.id === o.id)?.ctrl ?? null
          return (
            <div
              key={o.id}
              className="objective-wrap"
              style={{ left: o.pos.x * SCALE, top: o.pos.y * SCALE }}
              onMouseEnter={() => onObjectiveHover?.(o)}
              onMouseLeave={() => onObjectiveHover?.(null)}
            >
              <svg width={o.controlRange * 2 * SCALE} height={o.controlRange * 2 * SCALE}
                style={{ position: 'absolute', left: -o.controlRange * SCALE, top: -o.controlRange * SCALE }}
                className="overlay">
                <circle cx={o.controlRange * SCALE} cy={o.controlRange * SCALE} r={o.controlRange * SCALE}
                  fill="none" stroke={ctrlColor(ctrl)} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6} />
              </svg>
              <div className="objective-diamond" style={{ borderColor: ctrlColor(ctrl) }}>
                {i + 1}
              </div>
            </div>
          )
        })}

      {/* 特工 token */}
      {tokens
        .filter((t) => t.placed && (phase === 'deploy' || t.alive))
        .map((t) => {
          const r = t.baseRadius * SCALE
          const isSel = selected === t.uid
          return (
            <button
              key={t.uid}
              className={`token ${t.side} ${isSel ? 'sel' : ''} ${t.alive ? '' : 'dead'}`}
              style={{
                left: t.pos.x * SCALE,
                top: t.pos.y * SCALE,
                width: r * 2,
                height: r * 2,
                marginLeft: -r,
                marginTop: -r,
                borderRadius: '50%',
              }}
              onPointerDown={(e) => { e.stopPropagation(); onTokenPointerDown?.(t) }}
              onDoubleClick={(e) => { e.stopPropagation(); onTokenDoubleClick?.(t) }}
              onClick={(e) => { e.stopPropagation(); onTokenClick?.(t) }}
              title={`${t.name} · 耐伤 ${t.wounds}${!t.alive ? '（残废）' : ''}`}
            >
              {/* 朝向三角 */}
              <svg className="facing" width={r * 2} height={r * 2} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
                <polygon
                  points={`${r},${r * 0.2} ${r * 0.6},${r * 0.9} ${r * 1.4},${r * 0.9}`}
                  fill="rgba(255,255,255,0.85)"
                  transform={`rotate(${t.facing} ${r} ${r})`}
                />
              </svg>
              <span className="token-label">{t.side.toUpperCase()}</span>
            </button>
          )
        })}
    </div>
  )
}
