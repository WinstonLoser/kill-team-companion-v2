/** 沃库斯地形速查。规则文字为实现用摘要，详见 VOLKUS-RULES-REFERENCE.md。 */
export const VOLKUS_TERRAIN_REFERENCE = [
  {
    pieces: 'A / B', name: '要塞', terrainClass: '重型',
    summary: '上层为制高点兼顶盖；门可穿越且属重型地形。火力台阶有制高点，但不提供普通掩护。B 的最高层有单名友军站位限制。',
  },
  {
    pieces: 'C / D', name: '大型废墟', terrainClass: '重型',
    summary: '上层为制高点兼顶盖，顶部矮墙属轻型；门可穿越且属重型，完整窗户限制穿窗视线。',
  },
  { pieces: 'E / F', name: '小型废墟', terrainClass: '重型', summary: '整体按重型地形裁定。' },
  { pieces: 'G / H', name: '重型瓦砾', terrainClass: '重型', summary: '按重型地形裁定，可作为掩护；无需视为不可通行墙体。' },
  { pieces: 'I / J / K', name: '轻型瓦砾', terrainClass: '轻型', summary: '按轻型地形裁定。' },
  { pieces: 'L / M / N', name: '要塞附件', terrainClass: '依模型', summary: '按照场上对应模型与要塞规则现场裁定；本地图仅标出位置。' },
] as const

export const VOLKUS_CITYFIGHT_REFERENCE = [
  '对完全位于要塞内、处于地面或火力台阶的目标，爆炸、喷射或限定距离的毁灭性武器可能获得致命 5+。',
  '要塞内特工在与要塞外特工近战时，符合条件的守方先结算。',
  '隔门近战与高度、顶盖、窗户相关的视线须由玩家现场裁定。',
] as const
