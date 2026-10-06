import { VOLKUS_CITYFIGHT_REFERENCE, VOLKUS_TERRAIN_REFERENCE } from '../../data/volkusReference'

export function VolkusTerrainPanel({ mapId }: { mapId: string | null }) {
  if (!mapId?.startsWith('volkus-')) return null
  return <details className="volkus-rules-panel">
    <summary>沃库斯地形速查 <span>建筑、门、瓦砾与现场裁定</span></summary>
    <div className="volkus-rules-content">
      <p>图中 A–N 对应地形模型。平面墙体、掩护与可穿越门已标出；高低差模式可在射击时选择双方楼层。顶盖、窗户、攀爬及要塞特殊互动仍按实体模型现场裁定。</p>
      <div className="volkus-rules-grid">
        {VOLKUS_TERRAIN_REFERENCE.map((rule) => <article key={rule.pieces}>
          <strong>{rule.pieces} · {rule.name}</strong><small>{rule.terrainClass}</small>
          <p>{rule.summary}</p>
        </article>)}
      </div>
      <strong>巷战规则提醒</strong>
      <ul>{VOLKUS_CITYFIGHT_REFERENCE.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      <p className="muted">这些提醒不自动改变骰值或行动合法性；遇到立体视线、门战等情况，由玩家现场裁定。</p>
    </div>
  </details>
}
