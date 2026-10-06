import { VOLKUS_CITYFIGHT_REFERENCE, VOLKUS_TERRAIN_REFERENCE } from '../../data/volkusReference'

export function VolkusTerrainPanel({ mapId }: { mapId: string | null }) {
  if (!mapId?.startsWith('volkus-')) return null
  return <details className="volkus-rules-panel">
    <summary>沃库斯地形速查 <span>建筑、门、瓦砾与现场裁定</span></summary>
    <div className="volkus-rules-content">
      <p>图中 A–N 对应地形模型。高低差模式下，墙体、瓦砾和上层顶盖参与立体视线、掩护与遮蔽预判；移动可攀爬已标出的高台。模型头部姿态、窗户及要塞特殊互动仍由玩家按实物裁定。</p>
      <div className="volkus-rules-grid">
        {VOLKUS_TERRAIN_REFERENCE.map((rule) => <article key={rule.pieces}>
          <strong>{rule.pieces} · {rule.name}</strong><small>{rule.terrainClass}</small>
          <p>{rule.summary}</p>
        </article>)}
      </div>
      <strong>巷战规则提醒</strong>
      <ul>{VOLKUS_CITYFIGHT_REFERENCE.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      <p className="muted">地形高度按地图模型近似记录；立体射线为辅助判定，实体模型视线可在目标选择时人工裁定。门战仍由玩家现场裁定。</p>
    </div>
  </details>
}
