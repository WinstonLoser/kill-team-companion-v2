import { useState } from 'react'
import { useMatchStore, packOfFaction, geometryBoard, geometryPlacement } from '../../state/matchStore'
import { UnitPortrait } from '../components/UnitPortrait/UnitPortrait'
import { getAvatarUrl } from '../../utils/avatars'
import { sharedCoverObscuredTerrain, validateTarget } from '../../geometry'

export function TargetSelectionModal({
  attackerUid,
  kind,
  heightOnly = false,
  initialTargetUid = null,
  onClose,
  onConfirm
}: {
  attackerUid: string
  kind: 'SHOOT' | 'MELEE'
  heightOnly?: boolean
  initialTargetUid?: string | null
  onClose: () => void
  onConfirm: (targetUid: string) => void
}) {
  const tokens = useMatchStore((s) => s.tokens)
  const heightMode = useMatchStore((s) => s.heightMode)
  const setOverride = useMatchStore((s) => s.setOverride)
  const clearOverride = useMatchStore((s) => s.clearOverride)
  const mapPack = useMatchStore((s) => s.mapPack)
  const attacker = tokens.find((t) => t.uid === attackerUid)

  const [coverType, setCoverType] = useState<'NONE' | 'LIGHT' | 'HEAVY'>('NONE')
  const [isObscured, setIsObscured] = useState(false)
  // 此弹窗用于无地图模式；没有可自动计算的地形时默认由玩家裁定。
  const [manualTerrain, setManualTerrain] = useState(true)
  const [terrainChoice, setTerrainChoice] = useState<'COVER' | 'OBSCURED'>('COVER')
  const [selectedTarget, setSelectedTarget] = useState<string | null>(initialTargetUid)

  if (!attacker) return null

  const atkPack = packOfFaction(attacker.factionId)
  const atkUiTheme = atkPack?.faction.theme?.ui || { primaryRgb: '255, 90, 0' }
  const atkThemeColor = `rgb(${atkUiTheme.primaryRgb})`

  // Enemies that are alive and placed
  const enemies = tokens.filter((t) => t.side !== attacker.side && t.alive && t.placed)

  const handleConfirm = () => {
    if (!selectedTarget) return

    // Set overrides for cover, obscured, and vantage
    if (kind === 'SHOOT') {
      if (!heightOnly && manualTerrain) {
        setOverride(`${attackerUid}>${selectedTarget}>COVER`, coverType !== 'NONE')
        setOverride(`${attackerUid}>${selectedTarget}>COVER_TYPE`, coverType)
        setOverride(`${attackerUid}>${selectedTarget}>OBSCURED`, isObscured)
      } else if (!heightOnly) {
        for (const key of ['COVER', 'COVER_TYPE', 'OBSCURED']) clearOverride(`${attackerUid}>${selectedTarget}>${key}`)
      }
      if (!heightOnly) setOverride(`${attackerUid}>${selectedTarget}>TERRAIN_CHOICE`, terrainChoice)
    }

    onConfirm(selectedTarget)
  }

  const selectedToken = selectedTarget ? enemies.find((t) => t.uid === selectedTarget) : null
  const conflictingTerrain = !!(heightMode === 'elevation' && attacker && selectedToken && mapPack && sharedCoverObscuredTerrain(
    geometryPlacement(attacker, heightMode),
    geometryPlacement(selectedToken, heightMode),
    geometryBoard(mapPack, heightMode),
  ))
  const autoFindings = attacker && selectedToken && mapPack ? validateTarget(
    geometryPlacement(attacker, heightMode),
    geometryPlacement(selectedToken, heightMode),
    Math.hypot(mapPack.bounds.w, mapPack.bounds.h),
    geometryBoard(mapPack, heightMode), [attacker.pos], { terrainChoice },
  ).findings : []
  const autoCover = autoFindings.find(f => f.kind === 'COVER')?.finalValue ?? false
  const autoObscured = autoFindings.find(f => f.kind === 'OBSCURED')?.finalValue ?? false

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" style={{ backgroundColor: 'var(--bg-card, #222)', padding: '24px', borderRadius: '8px', width: 'min(840px, 94vw)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', border: `2px solid ${atkThemeColor}`, boxShadow: `0 0 20px rgba(${atkUiTheme.primaryRgb}, 0.3)` }}>
        <h2 style={{ marginTop: 0, marginBottom: '4px', color: atkThemeColor, flexShrink: 0 }}>选择目标 ({kind === 'SHOOT' ? '射击' : '近战'})</h2>
        <p className="muted" style={{ marginBottom: '16px', flexShrink: 0 }}>请选择你要攻击的敌方单位</p>

        {/* 目标网格：三列，随内容自适应高度 */}
        <div
          className="target-grid"
          style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', alignContent: 'start', marginBottom: '16px' }}
        >
          {enemies.map((t) => {
            const pack = packOfFaction(t.factionId)
            const uiTheme = pack?.faction.theme?.ui || { primaryRgb: '255, 90, 0' }
            const themeColor = `rgb(${uiTheme.primaryRgb})`
            const avatarUrl = getAvatarUrl(t.factionId, t.opId)
            const isSelected = selectedTarget === t.uid

            return (
              <div key={t.uid} onClick={() => setSelectedTarget(t.uid)} style={{ cursor: 'pointer', minWidth: 0 }}>
                <UnitPortrait
                  name={t.name}
                  maxWounds={t.maxWounds}
                  currentWounds={t.wounds}
                  statuses={t.markers}
                  themeColor={themeColor}
                  themeColorRgb={uiTheme.primaryRgb}
                  avatarUrl={avatarUrl}
                  selected={isSelected}
                  scale={0.75}
                  onClick={() => setSelectedTarget(t.uid)}
                />
              </div>
            )
          })}
        </div>

        {/* 环境因素：仅射击。全部选项一屏展示，无滚动；切换选项不改变弹窗尺寸 */}
        {kind === 'SHOOT' && (
          <div style={{ flexShrink: 0, padding: '16px 20px', marginBottom: '16px', backgroundColor: 'var(--bg-panel, #111)', borderRadius: '8px', border: `1px solid ${atkThemeColor}`, opacity: selectedToken ? 1 : 0.5 }}>
            <h4 style={{ margin: '0 0 14px 0', color: atkThemeColor }}>
              环境因素 (规则修正){selectedToken ? ` — ${selectedToken.name}` : '（请先选择目标）'}
            </h4>

            {heightMode === 'uniform' && <p className="muted" style={{ margin: '0 0 14px' }}>统一高度：双方均按地面高度处理，不触发制高点修正。</p>}
            {!heightOnly && <label style={{ display: 'block', marginBottom: '12px' }}><input type="checkbox" checked={manualTerrain} onChange={e => setManualTerrain(e.target.checked)} /> 人工裁定掩护与遮蔽（无地图时默认开启）</label>}
            {!heightOnly && selectedToken && !manualTerrain && <p className="muted">地图预判：{autoCover ? '有掩护' : '无掩护'} · {autoObscured ? '受遮蔽' : '未受遮蔽'}。实体模型视线有异议时可开启人工裁定。</p>}
            {!heightOnly && conflictingTerrain && !manualTerrain && <fieldset style={{ marginBottom: '12px' }}><legend>同一地形同时提供掩护和遮蔽：防守方选择</legend><label><input type="radio" name="terrain-choice" checked={terrainChoice === 'COVER'} onChange={() => setTerrainChoice('COVER')} /> 掩护</label><label style={{ marginLeft: 16 }}><input type="radio" name="terrain-choice" checked={terrainChoice === 'OBSCURED'} onChange={() => setTerrainChoice('OBSCURED')} /> 遮蔽</label></fieldset>}
            {!heightOnly && manualTerrain && <div style={{ marginBottom: '14px' }}>
              <span style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>掩体类型 (Cover)</span>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" name="cover" disabled={!selectedToken} checked={coverType === 'NONE'} onChange={() => setCoverType('NONE')} style={{ marginRight: '6px' }} />
                  无掩体
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" name="cover" disabled={!selectedToken} checked={coverType === 'LIGHT'} onChange={() => setCoverType('LIGHT')} style={{ marginRight: '6px' }} />
                  轻微掩体
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" name="cover" disabled={!selectedToken} checked={coverType === 'HEAVY'} onChange={() => setCoverType('HEAVY')} style={{ marginRight: '6px' }} />
                  重型掩体
                </label>
              </div>
            </div>}
            {!heightOnly && manualTerrain && <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" disabled={!selectedToken} checked={isObscured} onChange={(e) => setIsObscured(e.target.checked)} style={{ marginRight: '8px', width: '16px', height: '16px' }} />
              <span>目标受遮蔽（可射击，但命中削弱）</span>
            </label>}
          </div>
        )}

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 24px', background: 'transparent', border: '1px solid var(--border)', color: 'inherit', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
          <button onClick={handleConfirm} disabled={!selectedTarget} style={{ padding: '8px 24px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '4px', cursor: selectedTarget ? 'pointer' : 'not-allowed', opacity: selectedTarget ? 1 : 0.5 }}>确认结算</button>
        </div>
      </div>
    </div>
  )
}
