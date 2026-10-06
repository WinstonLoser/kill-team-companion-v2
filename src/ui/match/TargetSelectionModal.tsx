import { useState } from 'react'
import { useMatchStore, packOfFaction } from '../../state/matchStore'
import { UnitPortrait } from '../components/UnitPortrait/UnitPortrait'
import { getAvatarUrl } from '../../utils/avatars'

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
  const attacker = tokens.find((t) => t.uid === attackerUid)

  const [coverType, setCoverType] = useState<'NONE' | 'LIGHT' | 'HEAVY'>('NONE')
  const [isObscured, setIsObscured] = useState(false)
  const [attackerFloor, setAttackerFloor] = useState<number>(0)
  const [defenderFloor, setDefenderFloor] = useState<number>(0)
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
      if (!heightOnly) {
        setOverride(`${attackerUid}>${selectedTarget}>COVER`, coverType !== 'NONE')
        setOverride(`${attackerUid}>${selectedTarget}>COVER_TYPE`, coverType)
        setOverride(`${attackerUid}>${selectedTarget}>OBSCURED`, isObscured)
      }
      // Vantage is generally defined as attacker being on a higher floor
      setOverride(`${attackerUid}>${selectedTarget}>VANTAGE`, heightMode === 'elevation' && attackerFloor > defenderFloor)
      setOverride(`${attackerUid}>${selectedTarget}>ATTACKER_FLOOR`, heightMode === 'elevation' ? attackerFloor : 0)
      setOverride(`${attackerUid}>${selectedTarget}>DEFENDER_FLOOR`, heightMode === 'elevation' ? defenderFloor : 0)
    }

    onConfirm(selectedTarget)
  }

  const selectedToken = selectedTarget ? enemies.find((t) => t.uid === selectedTarget) : null

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
            {heightMode === 'elevation' && <div style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9rem', flex: 1 }}>
                <span style={{ marginBottom: '4px', color: 'var(--text-muted)' }}>进攻方楼层 (Vantage)</span>
                <select
                  value={attackerFloor}
                  disabled={!selectedToken}
                  onChange={(e) => setAttackerFloor(Number(e.target.value))}
                  style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#333', border: '1px solid #555', color: '#fff' }}
                >
                  <option value={0}>地面 (0层)</option>
                  <option value={1}>高点 (1层 / 2")</option>
                  <option value={2}>高点 (2层 / 4")</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9rem', flex: 1 }}>
                <span style={{ marginBottom: '4px', color: 'var(--text-muted)' }}>目标楼层</span>
                <select
                  value={defenderFloor}
                  disabled={!selectedToken}
                  onChange={(e) => setDefenderFloor(Number(e.target.value))}
                  style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#333', border: '1px solid #555', color: '#fff' }}
                >
                  <option value={0}>地面 (0层)</option>
                  <option value={1}>高点 (1层 / 2")</option>
                  <option value={2}>高点 (2层 / 4")</option>
                </select>
              </label>
            </div>}

            {/* 制高点提示：预留固定高度，切换楼层不改变弹窗尺寸 */}
            {heightMode === 'elevation' && <div style={{ minHeight: '52px', marginBottom: '10px' }}>
              {attackerFloor > defenderFloor && (
                <div style={{ fontSize: '0.8rem', color: atkThemeColor, padding: '6px 8px', backgroundColor: `rgba(${atkUiTheme.primaryRgb}, 0.1)`, borderRadius: '4px' }}>
                  <strong>制高点 (Vantage Point) 生效</strong>: 进攻方比目标高，若目标具有隐蔽(Conceal)且在轻微掩体中，其将被视为处于交战(Engage)状态。
                </div>
              )}
            </div>}

            {!heightOnly && <div style={{ marginBottom: '14px' }}>
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
            {!heightOnly && <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" disabled={!selectedToken} checked={isObscured} onChange={(e) => setIsObscured(e.target.checked)} style={{ marginRight: '8px', width: '16px', height: '16px' }} />
              <span>目标被遮挡 (Obscured)</span>
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
