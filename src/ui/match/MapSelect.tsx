import type { MapPack } from '../../data/maps'

// 1.12 T1：地图选择视图。预设模板网格（缩略图 + 名称 + 预览）+ 「空白板」进自定义画地形。
function Thumb({ map }: { map: MapPack }) {
  const tw = 120
  const th = (map.bounds.h / map.bounds.w) * tw
  const sx = tw / map.bounds.w
  const sy = th / map.bounds.h
  return (
    <svg width={tw} height={th} className="map-thumb">
      {/* 降落区底色 */}
      <polygon points={map.dropZones.a.map((p) => `${p.x * sx},${p.y * sy}`).join(' ')} fill="rgba(199,93,58,0.18)" />
      <polygon points={map.dropZones.b.map((p) => `${p.x * sx},${p.y * sy}`).join(' ')} fill="rgba(58,123,199,0.18)" />
      {/* 地形 */}
      {map.terrain.map((t) => {
        const fill = t.kind === 'BLOCKING' ? '#5a4030' : t.kind === 'COVER' ? '#3a5a3a' : '#4a4a6a'
        return (
          <polygon
            key={t.id}
            points={t.polygon.map((p) => `${p.x * sx},${p.y * sy}`).join(' ')}
            fill={fill}
            opacity={0.8}
          />
        )
      })}
      {/* 目标点 */}
      {map.objectives.map((o) => (
        <circle key={o.id} cx={o.pos.x * sx} cy={o.pos.y * sy} r={2.5} fill="var(--accent)" />
      ))}
    </svg>
  )
}

export function MapSelect({
  maps,
  onLoad,
  onBlank,
}: {
  maps: MapPack[]
  onLoad: (m: MapPack) => void
  onBlank: () => void
}) {
  return (
    <div className="map-select">
      <h2>选图开局</h2>
      <p className="muted">载入预设模板，或选「空白板」自定义画地形（会话内有效，刷新重置 D-20）。</p>
      <div className="map-grid">
        {maps.map((m) => (
          <button key={m.mapId} className="map-card" onClick={() => onLoad(m)} title={`载入「${m.name}」`}>
            <Thumb map={m} />
            <div className="map-card-name">
              <strong>{m.name}</strong>
              <span className="muted"> {m.objectives.length} 目标点 · {m.terrain.length} 地形</span>
            </div>
          </button>
        ))}
        <button className="map-card blank" onClick={onBlank} title="空白板，自定义画地形">
          <div className="blank-thumb">＋</div>
          <div className="map-card-name"><strong>空白板</strong><span className="muted"> 自定义地形</span></div>
        </button>
      </div>
    </div>
  )
}
