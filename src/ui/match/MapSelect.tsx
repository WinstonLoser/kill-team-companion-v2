import { useState } from 'react'
import { mapWithDeploymentMode, type DeploymentMode, type MapPack } from '../../data/maps'
import type { HeightMode } from '../../state/matchStore'

function Thumb({ map }: { map: MapPack }) {
  const width = 300
  const height = map.bounds.h / map.bounds.w * width
  const scale = width / map.bounds.w
  const points = (polygon: { x: number; y: number }[]) => polygon.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')
  const volkus = map.mapId.startsWith('volkus-')

  return (
    <svg className="map-thumb" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${map.name} 战场预览`}>
      <defs>
        <linearGradient id="map-ground" x2="1" y2="1"><stop stopColor="#28342f" /><stop offset="1" stopColor="#171d1a" /></linearGradient>
        <pattern id="map-grid-pattern" width={scale} height={scale} patternUnits="userSpaceOnUse"><path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="#a9b8aa" strokeOpacity=".13" strokeWidth=".7" /></pattern>
      </defs>
      <rect width={width} height={height} fill="url(#map-ground)" />
      <rect width={width} height={height} fill="url(#map-grid-pattern)" />
      <polygon points={points(map.dropZones.a)} fill="#d77845" fillOpacity=".19" stroke="#f8ad6d" strokeOpacity=".7" strokeDasharray="3 3" />
      <polygon points={points(map.dropZones.b)} fill="#5b9db8" fillOpacity=".19" stroke="#8dd0eb" strokeOpacity=".7" strokeDasharray="3 3" />
      {map.scenery?.map((piece) => <polygon key={piece.id} points={points(piece.polygon)} fill={piece.kind === 'stronghold' ? '#56645d' : '#485952'} stroke={piece.kind === 'stronghold' ? '#c6bc98' : '#9cae9a'} strokeWidth="2" opacity=".88" />)}
      {map.terrain.map((feature) => <polygon key={feature.id} points={points(feature.polygon)} fill={feature.accessible ? '#f2b56f' : feature.advisoryOnly ? '#798e7e' : feature.kind === 'BLOCKING' ? '#cab391' : feature.terrainClass === 'HEAVY' ? '#9c866c' : '#809783'} opacity={feature.accessible ? 1 : .86} />)}
      {map.scenery?.map((piece) => {
        const x = piece.polygon.reduce((sum, point) => sum + point.x, 0) / piece.polygon.length * scale
        const y = piece.polygon.reduce((sum, point) => sum + point.y, 0) / piece.polygon.length * scale
        return <text key={piece.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="map-thumb-label">{piece.id}</text>
      })}
      {map.objectives.map((objective) => <circle key={objective.id} cx={objective.pos.x * scale} cy={objective.pos.y * scale} r="3" fill="#f9d583" stroke="#fff1cb" />)}
      {volkus && <><text x="9" y="16" className="map-thumb-corner">VOLKUS</text><text x={width - 9} y={height - 9} textAnchor="end" className="map-thumb-corner">30 × 22″</text></>}
    </svg>
  )
}

export function MapSelect({ maps, onLoad, onBlank }: {
  maps: MapPack[]
  onLoad: (map: MapPack, heightMode: HeightMode, deploymentMode: DeploymentMode) => void
  onBlank: () => void
}) {
  const [heightMode, setHeightMode] = useState<HeightMode>('uniform')
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode>('rules')

  return <div className="map-select">
    <div className="map-select-heading">
      <div><span className="map-select-eyebrow">战场准备 / 01</span><h2>选择战场</h2><p>先约定高度与部署范围，再挑选战场。</p></div>
      <span className="map-select-size">30″ × 22″</span>
    </div>

    <fieldset className="height-mode-choice">
      <legend>高度裁定</legend>
      <label className={heightMode === 'uniform' ? 'selected' : ''}>
        <input type="radio" name="height-mode" checked={heightMode === 'uniform'} onChange={() => setHeightMode('uniform')} />
        <span><strong>统一高度</strong><small>使用平面视线、掩护与遮蔽；不计算顶盖、楼层或制高点。</small></span>
      </label>
      <label className={heightMode === 'elevation' ? 'selected' : ''}>
        <input type="radio" name="height-mode" checked={heightMode === 'elevation'} onChange={() => setHeightMode('elevation')} />
        <span><strong>启用高低差</strong><small>移动时选择楼层并计算攀爬；射击按立体地形判断视线、掩护与遮蔽。</small></span>
      </label>
    </fieldset>

    <fieldset className="height-mode-choice deployment-mode-choice">
      <legend>布局 1 部署范围</legend>
      <label className={deploymentMode === 'rules' ? 'selected' : ''}>
        <input type="radio" name="deployment-mode" checked={deploymentMode === 'rules'} onChange={() => setDeploymentMode('rules')} />
        <span><strong>规则部署 · 3″</strong><small>默认。沿左右棋盘边缘各 3″，底座必须完整位于区内。</small></span>
      </label>
      <label className={deploymentMode === 'expanded' ? 'selected' : ''}>
        <input type="radio" name="deployment-mode" checked={deploymentMode === 'expanded'} onChange={() => setDeploymentMode('expanded')} />
        <span><strong>要塞部署 · 自定义</strong><small>双方约定后使用；边缘区域约 7″，局部延伸至要塞内部，最远约 10–11″。</small></span>
      </label>
    </fieldset>

    <div className="map-select-section-heading"><strong>预设战场</strong><span>选择卡片进入部署</span></div>
    <div className="map-grid">
      {maps.map((map, index) => <button key={map.mapId} type="button" className="map-card" onClick={() => onLoad(map, heightMode, map.expandedDropZones ? deploymentMode : 'rules')} title={`载入「${map.name}」`}>
        <span className="map-card-art"><Thumb map={mapWithDeploymentMode(map, deploymentMode)} /><span className="map-card-number">{String(index + 1).padStart(2, '0')}</span></span>
        <span className="map-card-name"><strong>{map.name}</strong><small>{map.expandedDropZones ? deploymentMode === 'expanded' ? '约定玩法 · 要塞部署' : 'Lite 规则 · 3″ 边缘部署' : map.scenery ? '沃库斯地形 · 边缘部署' : `${map.terrain.length} 处地形 · ${map.objectives.length} 个目标`}</small></span>
        <span className="map-card-action">进入战场 <span aria-hidden="true">↗</span></span>
      </button>)}
      <button type="button" className="map-card blank" onClick={onBlank} title="空白板，自定义画地形">
        <span className="blank-thumb"><span>＋</span><strong>绘制自己的战场</strong></span>
        <span className="map-card-name"><strong>空白板</strong><small>自定义地形与部署区 · 默认统一高度</small></span>
        <span className="map-card-action">开始绘制 <span aria-hidden="true">↗</span></span>
      </button>
    </div>
    <p className="map-select-note">沃库斯地形按布置图近似转录，不含任务目标。部署范围选择只影响布局 1；门已标示，隔门近战暂由玩家裁定。</p>
  </div>
}
