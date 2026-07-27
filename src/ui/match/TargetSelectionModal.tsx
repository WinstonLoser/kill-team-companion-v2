import { useState, type CSSProperties } from 'react'
import { useMatchStore, packOfFaction } from '../../state/matchStore'
import { UnitPortrait } from '../components/UnitPortrait/UnitPortrait'
import { getAvatarUrl } from '../../utils/avatars'

export function TargetSelectionModal({
  attackerUid,
  kind,
  onClose,
  onConfirm
}: {
  attackerUid: string
  kind: 'SHOOT' | 'MELEE'
  onClose: () => void
  onConfirm: (targetUid: string) => void
}) {
  const tokens = useMatchStore((s) => s.tokens)
  const setOverride = useMatchStore((s) => s.setOverride)
  const attacker = tokens.find((t) => t.uid === attackerUid)

  const [coverType, setCoverType] = useState<'NONE' | 'LIGHT' | 'HEAVY'>('NONE')
  const [isObscured, setIsObscured] = useState(false)
  const [attackerFloor, setAttackerFloor] = useState<number>(0)
  const [defenderFloor, setDefenderFloor] = useState<number>(0)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)

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
      setOverride(`${attackerUid}>${selectedTarget}>COVER`, coverType !== 'NONE')
      setOverride(`${attackerUid}>${selectedTarget}>COVER_TYPE`, coverType)
      setOverride(`${attackerUid}>${selectedTarget}>OBSCURED`, isObscured)
      // Vantage is generally defined as attacker being on a higher floor
      setOverride(`${attackerUid}>${selectedTarget}>VANTAGE`, attackerFloor > defenderFloor)
      setOverride(`${attackerUid}>${selectedTarget}>ATTACKER_FLOOR`, attackerFloor)
      setOverride(`${attackerUid}>${selectedTarget}>DEFENDER_FLOOR`, defenderFloor)
    }

    onConfirm(selectedTarget)
  }

  const selectedToken = selectedTarget ? enemies.find((t) => t.uid === selectedTarget) : null

  return (
    <div className="ds-scrim tsm-scrim">
      <div className="ds-modal tsm-modal" style={{ '--side-theme': atkThemeColor } as CSSProperties}>
        <div className="ds-modal-head">
          <h2 className="ds-display ds-display--md">选择目标（{kind === 'SHOOT' ? '射击' : '近战'}）</h2>
          <button className="ds-modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="ds-modal-body tsm-body">
        <p className="muted tsm-lead">请选择你要攻击的敌方单位</p>

        {/* 目标网格：三列，随内容自适应高度 */}
        <div
          className="target-grid"
          style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', alignContent: 'start', marginBottom: '16px' }}
        >
          {enemies.map((t) => {
            const pack = packOfFaction(t.factionId)
            const uiTheme = pack?.faction.theme?.ui || { primaryRgb: '209, 69, 28' }
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
          <div className={`tsm-env ${selectedToken ? '' : 'is-idle'}`}>
            <h4 className="ds-eyebrow tsm-env-title">
              环境因素 (规则修正){selectedToken ? ` — ${selectedToken.name}` : '（请先选择目标）'}
            </h4>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
              <label className="ds-field tsm-field">
                <span className="ds-label">进攻方楼层 (Vantage)</span>
                <select
                  value={attackerFloor}
                  disabled={!selectedToken}
                  onChange={(e) => setAttackerFloor(Number(e.target.value))}
                  className="ds-select"
                >
                  <option value={0}>地面 (0层)</option>
                  <option value={1}>高点 (1层 / 2")</option>
                  <option value={2}>高点 (2层 / 4")</option>
                </select>
              </label>

              <label className="ds-field tsm-field">
                <span className="ds-label">目标楼层</span>
                <select
                  value={defenderFloor}
                  disabled={!selectedToken}
                  onChange={(e) => setDefenderFloor(Number(e.target.value))}
                  className="ds-select"
                >
                  <option value={0}>地面 (0层)</option>
                  <option value={1}>高点 (1层 / 2")</option>
                  <option value={2}>高点 (2层 / 4")</option>
                </select>
              </label>
            </div>

            {/* 制高点提示：预留固定高度，切换楼层不改变弹窗尺寸 */}
            <div style={{ minHeight: '52px', marginBottom: '10px' }}>
              {attackerFloor > defenderFloor && (
                <div className="tsm-vantage">
                  <strong>制高点 (Vantage Point) 生效</strong>: 进攻方比目标高，若目标具有隐蔽(Conceal)且在轻微掩体中，其将被视为处于交战(Engage)状态。
                </div>
              )}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span className="ds-label tsm-cover-label">掩体类型 (Cover)</span>
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
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" disabled={!selectedToken} checked={isObscured} onChange={(e) => setIsObscured(e.target.checked)} style={{ marginRight: '8px', width: '16px', height: '16px' }} />
              <span>目标被遮挡 (Obscured)</span>
            </label>
          </div>
        )}

        <div className="modal-actions tsm-actions">
          <button className="ds-btn ds-btn--secondary" onClick={onClose}>取消</button>
          <button className="ds-btn" onClick={handleConfirm} disabled={!selectedTarget}>确认结算</button>
        </div>
        </div>
      </div>
    </div>
  )
}
