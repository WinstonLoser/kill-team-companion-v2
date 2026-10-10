import { useState, useEffect } from 'react'
import { useMatchStore, type MatchToken, type Side } from '../../state/matchStore'
import { circleInsidePolygon, circlesOverlap, circleHitsBlockingTerrain, type Point } from '../../geometry'
import { Board, BoardLegend, SCALE } from './Board'
import { TeamWargearSummary } from './TeamWargearSummary'
import { getAvatarUrl } from '../../utils/avatars'
import { useVisualFxStore } from '../../state/visualFxStore'
import { assignedDropZones, mapWithDeploymentMode } from '../../data/maps'
import { VolkusTerrainPanel } from './VolkusTerrainPanel'
import { VOLKUS_MAPS } from '../../data/packs/maps/volkus'

// 部署阶段（对齐 lite rule §部署）：
//  1. 部署前掷先手权；棋子落地与批次交接给出视觉反馈。
//  2. 从先手方开始，轮流部署本队 1/3（向上取整）；放满本批后点「完成本批部署」交对方。
//  3. 落点须完全在己方降落区 + 不与他单位/墙体重叠；部署即隐匿（token.order=CONCEAL）。
//  只有当前批已放置的 token 可微调；回退会撤销上一批及其后的落子。

function clampPos(p: Point, bounds: { w: number; h: number }): Point {
  return { x: Math.max(0.5, Math.min(bounds.w - 0.5, p.x)), y: Math.max(0.5, Math.min(bounds.h - 0.5, p.y)) }
}

function defaultBoardZoom(boardWidth: number): number {
  return Math.min(2.2, Math.max(1.3, Math.floor((window.innerWidth - 48) / boardWidth * 100) / 100))
}

interface DeployTurn { side: Side; count: number; round: number }

/** 按规则生成分批部署序列：每轮先手方先手，各方各放 ceil(N/3)。 */
function buildSequence(nA: number, nB: number, initiative: Side): DeployTurn[] {
  const chunk = (n: number) => Math.max(1, Math.ceil(n / 3))
  const ca = chunk(nA), cb = chunk(nB)
  const order: Side[] = initiative === 'a' ? ['a', 'b'] : ['b', 'a']
  const seq: DeployTurn[] = []
  let placedA = 0, placedB = 0
  for (let round = 0; round < 3; round++) {
    for (const side of order) {
      const placed = side === 'a' ? placedA : placedB
      const n = side === 'a' ? nA : nB
      const c = side === 'a' ? ca : cb
      const remaining = n - placed
      if (remaining > 0) {
        const count = Math.min(c, remaining)
        seq.push({ side, count, round })
        if (side === 'a') placedA += count; else placedB += count
      }
    }
  }
  return seq
}

export function DeployPhase({ onBeginPlay }: { onBeginPlay: () => void }) {
  const mapPack = useMatchStore((s) => s.mapPack)!
  const heightMode = useMatchStore((s) => s.heightMode)
  const selectedDeploymentMode = useMatchStore((s) => s.deploymentMode)
  const deploymentMode = mapPack.mapId === 'volkus-ambull-01' && Math.max(...mapPack.dropZones.a.map((point) => point.x)) > 3
    ? 'expanded' : selectedDeploymentMode ?? 'rules'
  const tokens = useMatchStore((s) => s.tokens)
  const placeToken = useMatchStore((s) => s.placeToken)
  const rotateToken = useMatchStore((s) => s.rotateToken)
  const moveToken = useMatchStore((s) => s.moveToken)
  const dragging = useMatchStore((s) => s.dragging)
  const dragOrigin = useMatchStore((s) => s.dragOrigin)
  const setDragging = useMatchStore((s) => s.setDragging)
  const pushLog = useMatchStore((s) => s.pushLog)
  const setIntercept = useMatchStore((s) => s.setIntercept)
  const intercept = useMatchStore((s) => s.intercept)
  const deployInitiative = useMatchStore((s) => s.deployInitiative)
  const deployZoneChoice = useMatchStore((s) => s.deployZoneChoice)
  const chooseDeployZone = useMatchStore((s) => s.chooseDeployZone)
  const deployDice = useMatchStore((s) => s.deployDice)
  const rollDeployInitiative = useMatchStore((s) => s.rollDeployInitiative)
  const resetDeploy = useMatchStore((s) => s.resetDeploy)
  const turnPointer = useMatchStore((s) => s.deployBatchIndex ?? 0)
  const batchUids = useMatchStore((s) => s.deployBatchUids ?? {})
  const recordDeployPlacement = useMatchStore((s) => s.recordDeployPlacement)
  const advanceDeployBatch = useMatchStore((s) => s.advanceDeployBatch)
  const rewindDeployBatch = useMatchStore((s) => s.rewindDeployBatch)
  const restoreDeployBatches = useMatchStore((s) => s.restoreDeployBatches)
  const log = useMatchStore((s) => s.log)
  const refreshMapTemplate = useMatchStore((s) => s.refreshMapTemplate)
  const emitBoardFx = useVisualFxStore(s => s.emitBoardFx)
  const showPhaseNotice = useVisualFxStore(s => s.showPhaseNotice)

  useEffect(() => {
    const current = VOLKUS_MAPS.find((template) => template.mapId === mapPack.mapId)
    if (current && current.version !== mapPack.version) refreshMapTemplate(mapWithDeploymentMode(current, deploymentMode), deploymentMode)
  }, [mapPack.mapId, mapPack.version, deploymentMode, refreshMapTemplate])

  const bounds = mapPack.bounds
  const totalA = tokens.filter((t) => t.side === 'a').length
  const totalB = tokens.filter((t) => t.side === 'b').length
  const placedA = tokens.filter((t) => t.side === 'a' && t.placed).length
  const placedB = tokens.filter((t) => t.side === 'b' && t.placed).length
  const totalPlaced = placedA + placedB
  const allPlaced = totalPlaced === tokens.length && tokens.length > 0

  const seq = deployInitiative ? buildSequence(totalA, totalB, deployInitiative) : []
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState<Point | null>(null)
  const [boardZoom, setBoardZoom] = useState(() => defaultBoardZoom(bounds.w * SCALE))
  // 兼容热更新前只保存棋子位置、未保存批次归属的在途部署。
  useEffect(() => {
    if (totalPlaced === 0 || !seq.length || Object.values(batchUids).some((uids) => uids.length)) return
    const recovered: Record<number, string[]> = {}
    const offset: Record<Side, number> = { a: 0, b: 0 }
    const placed = {
      a: tokens.filter((token) => token.side === 'a' && token.placed),
      b: tokens.filter((token) => token.side === 'b' && token.placed),
    }
    seq.forEach((batch, index) => {
      recovered[index] = placed[batch.side].slice(offset[batch.side], offset[batch.side] + batch.count).map((token) => token.uid)
      offset[batch.side] += batch.count
    })
    let index = 0
    for (const entry of [...log].reverse()) {
      if (entry.text.includes('部署已重置')) index = 0
      else if (entry.text.includes('完成本批部署')) index++
      else if ((entry.text.includes('回退至') && entry.text.includes('上一批部署')) || entry.text.includes('撤回') && entry.text.includes('重新部署')) index--
    }
    restoreDeployBatches(Math.max(0, Math.min(seq.length - 1, index)), recovered)
  }, [totalPlaced, batchUids, tokens, seq, log, restoreDeployBatches])

  const cur = seq[turnPointer] ?? null
  const deploySide: Side | null = cur?.side ?? null
  const round = cur?.round ?? 0
  const placedThisBatch = (batchUids[turnPointer] ?? []).length
  const needThisTurn = cur?.count ?? 0
  const batchDone = cur ? placedThisBatch >= needThisTurn : false
  const currentBatchUids = new Set(batchUids[turnPointer] ?? [])
  const lockedTokenUids = new Set(tokens.filter((t) => t.placed && !currentBatchUids.has(t.uid)).map((t) => t.uid))
  const isLastBatch = turnPointer === seq.length - 1
  const canReroll = totalPlaced === 0 // 放下第一名后锁定先手
  const selectedToken = tokens.find((t) => t.uid === selectedUid && t.side === deploySide && !t.placed)
    ?? tokens.find((t) => t.side === deploySide && !t.placed)
  const assignedZones = deployZoneChoice && deployInitiative
    ? assignedDropZones(mapPack, deployInitiative, deployZoneChoice)
    : mapPack.dropZones
  const boardMap = { ...mapPack, dropZones: assignedZones }
  const previewPos = hoverPos ? clampPos(hoverPos, bounds) : null
  const previewIssue = !previewPos || !selectedToken || !deploySide ? null
    : !circleInsidePolygon(previewPos, selectedToken.baseRadius, assignedZones[deploySide]) ? '底座超出己方部署区'
    : circleHitsBlockingTerrain(previewPos, selectedToken.baseRadius, mapPack.terrain) ? '底座压在墙体上'
    : tokens.some((token) => token.placed && circlesOverlap(previewPos, selectedToken.baseRadius, token.pos, token.baseRadius)) ? '与已部署特工重叠'
    : ''
  const previewValid = previewIssue === ''
  const progressText = !deployZoneChoice ? '等待先手方选择降落区' : allPlaced && isLastBatch
    ? '部署完成 · 可开始转折点 1'
    : cur ? `第 ${round + 1} 轮 · 轮到 ${deploySide!.toUpperCase()} 方 · 本批 ${needThisTurn} 名（已放 ${placedThisBatch}）${batchDone ? ' · 本批已满' : ''}` : '—'
  const nextText = !deployZoneChoice ? '先选择己方降落区' : allPlaced && isLastBatch
    ? '双方已完成部署' : batchDone ? '本批已满，点「完成本批部署」交对方' : `已选择：${selectedToken?.name ?? '—'}`
  const placementText = intercept ? `⚠ ${intercept.title} · ${intercept.reasons.join('；')}`
    : !deployZoneChoice ? '选择降落区后，在地图上放置特工'
    : batchDone ? '本批已放满；确认前仍可调整本批棋子'
    : selectedToken && previewPos ? previewValid ? `✓ ${selectedToken.name} 可放置于此` : `× ${previewIssue}`
    : selectedToken ? `移动到地图上，预览 ${selectedToken.name} 的底座落点` : '选择特工后在地图上部署'

  function tryPlace(side: Side, p: Point) {
    if (!deployZoneChoice) return
    const zone = assignedZones[side]
    const pos = clampPos(p, bounds)
    const next = selectedToken
    if (!next) return
    if (!circleInsidePolygon(pos, next.baseRadius, zone)) {
      setIntercept({ title: '出降落区', reasons: [`落点 ${pos.x.toFixed(1)},${pos.y.toFixed(1)} 底座未完全在 ${side.toUpperCase()} 方降落区内`] })
      return
    }
    const overlap = tokens.filter((t) => t.placed).find((t) => circlesOverlap(pos, next.baseRadius, t.pos, t.baseRadius))
    if (overlap) {
      setIntercept({ title: '与特工重叠', reasons: [`与 ${overlap.name} 底座重叠`] })
      return
    }
    const wall = circleHitsBlockingTerrain(pos, next.baseRadius, mapPack.terrain)
    if (wall) {
      setIntercept({ title: '与墙体重叠', reasons: [`落点在阻拦地形上`] })
      return
    }
    setIntercept(null)
    placeToken(next.uid, pos, next.facing)
    emitBoardFx({ kind: 'DEPLOY', uid: next.uid, factionId: next.factionId, to: pos, label: '已部署', durationMs: 700 })
    recordDeployPlacement(next.uid)
    setHoverPos(null)
    pushLog('deploy', `${next.name} 部署于 ${pos.x.toFixed(1)},${pos.y.toFixed(1)}（隐匿）`)
  }

  function onBoardClick(p: Point) {
    if (!cur || batchDone || !deployZoneChoice) return // 本批已满：需点「完成」交对方
    tryPlace(cur.side, p)
  }

  function onTokenPointerDown(t: MatchToken) {
    if (t.placed && currentBatchUids.has(t.uid)) setDragging(t.uid, t.pos)
  }
  function onPointerMove(p: Point) {
    if (dragging && currentBatchUids.has(dragging)) moveToken(dragging, clampPos(p, bounds))
    else setHoverPos(p)
  }
  function onPointerUp() {
    if (dragging) {
      const t = tokens.find((x) => x.uid === dragging)
      if (t && dragOrigin && currentBatchUids.has(t.uid)) {
        const zone = assignedZones[t.side]
        const overlap = tokens.filter((o) => o.placed && o.uid !== t.uid).find((o) => circlesOverlap(t.pos, t.baseRadius, o.pos, o.baseRadius))
        const wall = circleHitsBlockingTerrain(t.pos, t.baseRadius, mapPack.terrain)
        if (!circleInsidePolygon(t.pos, t.baseRadius, zone)) {
          moveToken(t.uid, dragOrigin)
          setIntercept({ title: '出降落区', reasons: [`${t.name} 拖出己方降落区，已回退`] })
        } else if (overlap) {
          moveToken(t.uid, dragOrigin)
          setIntercept({ title: '与特工重叠', reasons: [`${t.name} 与 ${overlap.name} 底座重叠，已回退`] })
        } else if (wall) {
          moveToken(t.uid, dragOrigin)
          setIntercept({ title: '与墙体重叠', reasons: [`${t.name} 压在阻拦地形上，已回退`] })
        } else {
          setIntercept(null)
          emitBoardFx({ kind: 'MOVE', uid: t.uid, factionId: t.factionId, from: dragOrigin, to: t.pos, path: [dragOrigin, t.pos], durationMs: 520 })
          pushLog('deploy', `${t.name} 移动至 ${t.pos.x.toFixed(1)},${t.pos.y.toFixed(1)}`)
        }
      }
      setDragging(null)
    }
  }
  function onPointerLeave() {
    setHoverPos(null)
    onPointerUp()
  }

  function completeBatch() {
    if (!cur || !batchDone || isLastBatch) return
    const side = cur.side
    setDragging(null)
    setSelectedUid(null)
    setHoverPos(null)
    advanceDeployBatch()
    showPhaseNotice(`${side.toUpperCase()} 方部署完成`, '轮到对方放置下一批特工', tokens.find(token => token.side === side)?.factionId)
    pushLog('deploy', `${side.toUpperCase()} 方完成本批部署`)
  }

  function undoBatch() {
    if (turnPointer === 0) return
    const previous = seq[turnPointer - 1]!
    setDragging(null)
    setSelectedUid(null)
    setHoverPos(null)
    setIntercept(null)
    rewindDeployBatch()
    pushLog('deploy', `撤回 ${previous.side.toUpperCase()} 方上一批及其后的落子，重新部署`)
  }

  return (
    <div className="deploy-phase">
      <div className="team-wargear-pair">{(['a', 'b'] as const).map(side => <TeamWargearSummary key={side} side={side} team={tokens.filter(token => token.side === side)} />)}</div>
      <p className="map-mode-indicator">{heightMode === 'elevation' ? '高低差已启用 · 部署在地面，行动时可攀爬高台' : '统一高度 · 所有单位按同一高度裁定'}<span>{mapPack.mapId === 'volkus-ambull-01' ? deploymentMode === 'expanded' ? '双方约定：要塞部署区（自定义）' : 'Lite 规则：沿己方边缘 3″ 部署' : '底座须完整处于己方部署区内'}</span></p>
      <VolkusTerrainPanel mapId={mapPack.mapId} />
      {/* 先手权未定：掷骰门禁 */}
      {!deployInitiative || !deployDice ? (
        <div className="deploy-init-roll">
          <strong>部署前 · 决定先手权</strong>
          <p className="muted">随机掷骰，胜方先部署并先选降落区。</p>
          <button className="primary dice-btn" onClick={() => rollDeployInitiative()}>🎲 掷 D6 定先手</button>
        </div>
      ) : (
        <>
        {!deployZoneChoice && <div className="deploy-zone-choice">
          <strong>{deployInitiative.toUpperCase()} 方先选择己方降落区</strong>
          <p className="muted">点击一侧降落区后开始部署；另一侧自动分配给对方。</p>
          <div className="deploy-zone-actions">
            <button className="primary" onClick={() => chooseDeployZone('a')}>选择地图 A 区</button>
            <button className="primary" onClick={() => chooseDeployZone('b')}>选择地图 B 区</button>
          </div>
        </div>}
        <div className="pushbar">
          <span className="deploy-init">
            先手骰 A={deployDice.a} B={deployDice.b} → <strong>{deployInitiative.toUpperCase()} 方先手</strong>
            {canReroll && <button className="mini-btn" onClick={() => rollDeployInitiative()} title="重掷（放下第一名后锁定）">重掷</button>}
          </span>
          <span className="deploy-step" title={progressText}>{progressText}</span>
          <span className="deploy-next" title={nextText}>
            <span className={`deploy-next-dot ${deploySide ?? ''}`} />
            <span>{nextText}</span>
          </span>
        </div>
        </>
      )}

      {deployZoneChoice && cur && !(allPlaced && isLastBatch) && <div className="deploy-picker">
        <div className="deploy-picker-heading"><strong>选择本批部署的特工</strong><span>{cur.side.toUpperCase()} 方 · {placedThisBatch}/{needThisTurn} 名</span></div>
        <div className="deploy-picker-list">
          {tokens.filter((t) => t.side === cur.side).map((t) => <button
            key={t.uid}
            type="button"
            className={`deploy-operative ${t.placed ? 'is-placed' : ''} ${selectedToken?.uid === t.uid ? 'is-selected' : ''}`}
            disabled={t.placed || batchDone}
            onClick={() => setSelectedUid(t.uid)}
            aria-pressed={selectedToken?.uid === t.uid && !t.placed}
          >
            <img src={getAvatarUrl(t.factionId, t.opId)} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            <span>{t.name}</span><small>{t.placed ? currentBatchUids.has(t.uid) ? '本批可调整' : '已锁定' : selectedToken?.uid === t.uid ? '待放置' : '未部署'}</small>
          </button>)}
        </div>
        <p className="muted">{batchDone ? '本批已放满，确认前仍可拖动或双击调整本批棋子。' : '选中一名特工，再点击棋盘中的己方降落区。'}</p>
      </div>}

      <div className="deploy-actions">
        <div className="deploy-action-buttons">
        <button className="primary" disabled={!allPlaced || !deployZoneChoice || turnPointer < seq.length - 1} onClick={onBeginPlay} title={allPlaced ? '开始转折点 1' : `待部署：A×${totalA - placedA} B×${totalB - placedB}`}>
          开始转折点 1 ▶
        </button>
        <button
          className="primary"
          disabled={!batchDone || isLastBatch}
          onClick={completeBatch}
          title={batchDone ? '完成本批，交对方部署' : '本批尚未放满'}
        >
          完成本批部署 ▶
        </button>
        <button className="reset-btn" disabled={turnPointer === 0} onClick={undoBatch} title={turnPointer === 0 ? '当前已是第一批' : '移除上一批及当前批已放置棋子，返回上一批重新部署'}>
          ↶ 回退上一批
        </button>
        <button
          className="reset-btn"
          onClick={() => { if (confirm('仅重置部署？（地图和阵营保留）')) resetDeploy() }}
          disabled={totalPlaced === 0 && !deployInitiative}
          title="重置部署：清空落子与先手，保留地图"
        >
          ⟳ 重置部署
        </button>
        </div>
        <span className="muted deploy-action-summary" title="仅当前批可拖动或旋转；回退会撤销上一批及当前批落子">待部署 A×{totalA - placedA} B×{totalB - placedB} · 仅当前批可拖动或旋转 · 回退会撤销上一批及当前批落子</span>
      </div>

      <div className="deploy-map-toolbar">
        <BoardLegend />
        <div className="deploy-map-zoom" aria-label="地图缩放">
          <button type="button" disabled={boardZoom <= 1} onClick={() => setBoardZoom((zoom) => Math.max(1, Math.round((zoom - 0.15) * 100) / 100))} aria-label="缩小地图">−</button>
          <span>{Math.round(boardZoom * 100)}%</span>
          <button type="button" disabled={boardZoom >= 2.2} onClick={() => setBoardZoom((zoom) => Math.min(2.2, Math.round((zoom + 0.15) * 100) / 100))} aria-label="放大地图">＋</button>
          <button type="button" onClick={() => setBoardZoom(defaultBoardZoom(bounds.w * SCALE))}>重置</button>
        </div>
      </div>
      <div className={`deploy-feedback ${intercept ? 'invalid' : previewPos ? previewValid ? 'valid' : 'invalid' : ''}`} role={intercept ? 'alert' : 'status'} aria-live={intercept ? 'assertive' : 'off'}>
        <span title={placementText}>{placementText}</span>
        {intercept && <button type="button" onClick={() => setIntercept(null)} aria-label="关闭部署提示">✕</button>}
      </div>
      <div className="deploy-board-scroll">
        <div className="deploy-board-size" style={{ width: bounds.w * SCALE * boardZoom, height: bounds.h * SCALE * boardZoom }}>
          <div className="deploy-board-stage" style={{ width: bounds.w * SCALE, height: bounds.h * SCALE, transform: `scale(${boardZoom})` }}>
      <Board
        mapPack={boardMap}
        terrain={mapPack.terrain}
        tokens={tokens}
        lockedTokenUids={lockedTokenUids}
        objectives={mapPack.objectives}
        phase="deploy"
        selected={null}
        rangeRing={null}
        controlRing={null}
        ownCover={null}
        losLines={[]}
        objControl={mapPack.objectives.map((o) => ({ id: o.id, ctrl: null }))}
        placementPreview={previewPos && selectedToken && deployZoneChoice && !batchDone && !dragging ? { center: previewPos, radius: selectedToken.baseRadius, valid: previewValid } : null}
        onBoardClick={onBoardClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onTokenPointerDown={onTokenPointerDown}
        onTokenDoubleClick={(t) => { if (currentBatchUids.has(t.uid)) rotateToken(t.uid) }}
      />
          </div>
        </div>
      </div>
    </div>
  )
}
