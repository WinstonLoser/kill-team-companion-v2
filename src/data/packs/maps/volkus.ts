import type { Polygon, TerrainFeature } from '../../../geometry'
import type { MapPack } from '../../maps'

// 来源：Ambull Mission Pack 的两张 Killzone: Volkus 布置图（PDF 第 5、7 页）。
// 坐标按图中的 30" × 22" 方格近似转录；只保留地形，不导入任务目标、特殊部署区或计分。
// 布局 1 默认采用 Lite 无任务部署：沿左右边缘各 3"。双方可另行约定覆盖要塞的自定义部署区。
type Rect = [number, number, number, number]
const polygon = ([x1, y1, x2, y2]: Rect): Polygon => [
  { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 },
]
const wallHeight = (id: string) => 'AB'.includes(id[0]!) ? 3 : 'CD'.includes(id[0]!) ? 3.5 : 2.5
const wall = (id: string, box: Rect, vantage = false): TerrainFeature => ({ id, kind: 'BLOCKING', terrainClass: 'HEAVY', pieceId: id[0], polygon: polygon(box), vantage, climbable: true, bottom: 0, top: wallHeight(id) })
const door = (id: string, box: Rect): TerrainFeature => ({ id, kind: 'COVER', terrainClass: 'HEAVY', pieceId: id[0], accessible: true, isDoor: true, polygon: polygon(box), bottom: 0, top: wallHeight(id) })
const rubble = (id: string, box: Rect, terrainClass: 'HEAVY' | 'LIGHT' = 'LIGHT'): TerrainFeature => ({ id, kind: 'COVER', terrainClass, pieceId: id[0], polygon: polygon(box), bottom: 0, top: terrainClass === 'HEAVY' ? 1.5 : 0.75 })
const accessory = (id: string, box: Rect): TerrainFeature => ({ id, kind: 'COVER', pieceId: id[0], advisoryOnly: true, polygon: polygon(box) })
const footprint = (id: string, label: string, kind: 'stronghold' | 'ruin', box: Rect) => ({ id, label, kind, polygon: polygon(box) })
// 高台平面仅在大件地形上标示；小废墟/瓦砾没有可站立的上层。
// 沃库斯实体地形约为：要塞首层 3"，大型废墟上层 3.5"。
const platform = (id: string, label: string, box: Rect, height: number) => ({ id: `${id}-upper`, label, pieceId: id, height, targetingHeight: 'CD'.includes(id) ? 3 : height, polygon: polygon(box) })

const dropZones = {
  a: polygon([0, 0, 3, 22]),
  b: polygon([27, 0, 30, 22]),
}
const strongholdDropZones = {
  a: [
    { x: 0, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 14 },
    { x: 10, y: 14 }, { x: 10, y: 22 }, { x: 0, y: 22 },
  ],
  b: [
    { x: 19, y: 3 }, { x: 23, y: 3 }, { x: 23, y: 0 },
    { x: 30, y: 0 }, { x: 30, y: 22 }, { x: 23, y: 22 },
    { x: 23, y: 9 }, { x: 19, y: 9 },
  ],
}

export const VOLKUS_MAPS: MapPack[] = [
  {
    mapId: 'volkus-ambull-01', name: '沃库斯 · 布局 1', version: '1.2.0', bounds: { w: 30, h: 22 },
    objectives: [], dropZones, expandedDropZones: strongholdDropZones,
    scenery: [
      footprint('A', 'A · 要塞', 'stronghold', [19, 3, 27, 9]),
      footprint('B', 'B · 要塞', 'stronghold', [2, 14, 10, 22]),
      footprint('C', 'C · 大型废墟', 'ruin', [20.5, 14.5, 27, 19]),
      footprint('D', 'D · 大型废墟', 'ruin', [3, 3, 7, 9]),
      footprint('E', 'E · 小型废墟', 'ruin', [13, 14, 16, 19]),
      footprint('F', 'F · 小型废墟', 'ruin', [13, 3, 15, 7.5]),
    ],
    platforms: [
      platform('A', 'A · 要塞上层', [19, 3, 27, 9], 3),
      platform('B', 'B · 要塞上层', [2, 14, 10, 22], 3),
      platform('C', 'C · 大型废墟上层', [20.5, 14.5, 27, 19], 3.5),
      platform('D', 'D · 大型废墟上层', [3, 3, 7, 9], 3.5),
    ],
    terrain: [
      wall('A-top', [19, 3, 27, 3.3], true), wall('A-left-upper', [19, 3, 19.3, 4.7], true),
      door('A-door', [19, 4.7, 19.3, 6.3]), wall('A-left-lower', [19, 6.3, 19.3, 9], true), wall('A-right', [26.7, 3, 27, 9], true),
      wall('A-bottom', [19, 8.7, 27, 9], true),
      wall('B-top-left', [2, 14, 4, 14.3], true), door('B-door', [4, 14, 6, 14.3]),
      wall('B-top-right', [6, 14, 10, 14.3], true),
      wall('B-left', [2, 14, 2.3, 22], true), wall('B-right', [9.7, 14, 10, 22], true),
      wall('C-top', [20.5, 14.5, 27, 14.8]), wall('C-left-upper', [20.5, 14.5, 20.8, 16]),
      door('C-door', [20.5, 16, 20.8, 17.5]), wall('C-left-lower', [20.5, 17.5, 20.8, 19]),
      wall('D-right-upper', [6.7, 3, 7, 4.7]), door('D-door', [6.7, 4.7, 7, 6.3]),
      wall('D-right-lower', [6.7, 6.3, 7, 9]),
      wall('D-bottom', [3, 8.7, 7, 9]),
      wall('E-left', [13, 14, 13.3, 19]), wall('E-bottom', [13, 18.7, 16, 19]),
      wall('F-left', [13, 3, 13.3, 7.5]), wall('F-top', [13, 3, 14.5, 3.3]),
      rubble('G-heavy', [14, 13, 17, 14], 'HEAVY'), rubble('H-heavy', [19, 11, 22, 12], 'HEAVY'),
      rubble('I-light', [8.5, 10, 12, 12]), rubble('J-light', [14, 7, 16, 8]), rubble('K-light', [3, 3, 5, 4]),
      accessory('L-stronghold-scrap', [7.8, 20, 10, 22]), accessory('M-stronghold-scrap', [24.5, 3, 27, 5.7]),
      accessory('N-stronghold-scrap', [2.2, 19, 3.5, 22]),
    ],
  },
  {
    mapId: 'volkus-ambull-02', name: '沃库斯 · 布局 2', version: '1.0.0', bounds: { w: 30, h: 22 },
    objectives: [], dropZones,
    scenery: [
      footprint('A', 'A · 要塞', 'stronghold', [24, 3, 30, 11]),
      footprint('B', 'B · 要塞', 'stronghold', [11, 3, 19, 11]),
      footprint('C', 'C · 大型废墟', 'ruin', [9.8, 14, 14, 20]),
      footprint('D', 'D · 大型废墟', 'ruin', [16, 14, 20, 20]),
      footprint('E', 'E · 小型废墟', 'ruin', [6, 0, 9, 8]),
      footprint('F', 'F · 小型废墟', 'ruin', [6, 13, 7.5, 19]),
    ],
    platforms: [
      platform('A', 'A · 要塞上层', [24, 3, 30, 11], 3),
      platform('B', 'B · 要塞上层', [11, 3, 19, 11], 3),
      platform('C', 'C · 大型废墟上层', [9.8, 14, 14, 20], 3.5),
      platform('D', 'D · 大型废墟上层', [16, 14, 20, 20], 3.5),
    ],
    terrain: [
      wall('A-top-left', [24, 3, 27.4, 3.3], true), door('A-door', [27.4, 3, 28.8, 3.3]),
      wall('A-top-right', [28.8, 3, 30, 3.3], true), wall('A-left', [24, 3, 24.3, 11], true),
      wall('A-bottom', [24, 10.7, 30, 11], true),
      wall('B-top-left', [11, 3, 13, 3.3], true), door('B-door', [13, 3, 15, 3.3]),
      wall('B-top-right', [15, 3, 19, 3.3], true),
      wall('B-left', [11, 3, 11.3, 11], true), wall('B-right', [18.7, 3, 19, 11], true),
      wall('B-bottom', [11, 10.7, 19, 11], true),
      wall('C-right-upper', [13.7, 14, 14, 16]), door('C-door', [13.7, 16, 14, 17.5]),
      wall('C-right-lower', [13.7, 17.5, 14, 20]),
      wall('D-right-upper', [19.7, 14, 20, 16]), door('D-door', [19.7, 16, 20, 17.5]),
      wall('D-right-lower', [19.7, 17.5, 20, 20]),
      wall('E-left', [6, 0, 6.3, 8]), wall('E-bottom', [6, 7.7, 9, 8]),
      wall('F-left', [6, 13, 6.3, 19]), wall('F-top', [6, 13, 7.5, 13.3]),
      rubble('G-heavy', [13.5, 16, 16.5, 17], 'HEAVY'), rubble('H-heavy', [23, 16, 24, 19], 'HEAVY'),
      rubble('I-light', [15, 7, 16, 11]), rubble('J-light', [14.7, 11, 15.5, 13.5]),
      rubble('K-light', [6, 20, 7, 22]), accessory('L-stronghold-scrap', [17, 7, 19, 11]),
      accessory('M-stronghold-scrap', [27.4, 9, 30, 11]), accessory('N-stronghold-scrap', [11, 8, 12, 11]),
    ],
  },
]
