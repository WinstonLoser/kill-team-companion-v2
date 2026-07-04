import { Fragment } from 'react'
import type { FactionPack } from '../../rules'

const WEAPON_RULE_ZH: Record<string, string> = {
  PISTOL: '手枪', TORRENT: '洪流', PIERCING1: '穿刺1', PIERCING: '穿刺',
  CONCEAL: '集中', OVERHEAT: '过热', LETHAL5: '致命5+', HEAVY: '重型',
  BLAST1: '爆炸1"', BLAST2: '爆炸2"', DEVASTATING: '严重', DEVASTATING3: '毁灭3',
  SILENT: '安静', BRUTAL: '残暴', STUN: '震荡', CONCUSSIVE: '眩晕',
  RAPID_FIRE: '撕裂', TOXIN: '毒素', VIRULENT: '剧毒', RELENTLESS: '无休',
  SEEKING_LIGHT: '追踪轻型', BALANCED: '平衡', HIT: '重击', PSYCHIC: '灵能',
}
function ruleZh(rule: string): string { return WEAPON_RULE_ZH[rule] ?? rule }

function fmtWeapon(w: FactionPack['weapons'][0]): string {
  const p = w.profile
  return `${p.attacks}攻${p.hit}+ ${p.normalDamage}/${p.criticalDamage}${p.range != null ? ` ${p.range}"` : ''}${p.weaponRules.length ? ` ${p.weaponRules.map(ruleZh).join('/')}` : ''}`
}

/** 默认装备配置：首个远程 + 首个近战武器。 */
function defaultLoadoutFor(pack: FactionPack, opId: string): string[] {
  const op = pack.operatives.find((o) => o.operativeId === opId)
  if (!op) return []
  const out: string[] = []
  const ranged = op.weaponRefs.map((wid) => pack.weapons.find((w) => w.weaponId === wid)).find((w) => w?.kind === 'RANGED')
  const melee = op.weaponRefs.map((wid) => pack.weapons.find((w) => w.weaponId === wid)).find((w) => w?.kind === 'MELEE')
  if (ranged) out.push(ranged.weaponId)
  if (melee) out.push(melee.weaponId)
  return out
}

/** per-operative 选择器（军团兵混沌印记）的默认选项；非 perOperative 阵营返回 undefined。 */
function defaultMarkFor(pack: FactionPack): string | undefined {
  const sel = pack.faction.subFactionSelector
  return sel?.scope === 'perOperative' ? sel.default : undefined
}

export function OperativePicker({
  pack,
  operativeIds,
  loadout,
  perOperativeMarks,
  wargearAssignment,
  onChange,
}: {
  pack: FactionPack
  operativeIds: string[]
  loadout: Record<string, string[]>
  perOperativeMarks: Record<string, string>
  wargearAssignment: Record<string, string[]>
  onChange: (next: { operativeIds: string[]; loadout: Record<string, string[]>; perOperativeMarks?: Record<string, string>; wargearAssignment?: Record<string, string[]> }) => void
}) {
  const except = new Set(pack.buildConstraints?.maxPerTypeExcept ?? [])
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const maxTotal = pack.buildConstraints?.operatives?.max ?? 99
  const isPerOperativeMarks = pack.faction.subFactionSelector?.id === 'markOfChaos'
  const markOptions = pack.faction.subFactionSelector?.options ?? []
  const wargearList = pack.wargear ?? []
  const maxPerType = (opId: string) => (except.has(opId) ? maxTotal : 1)
  const atCapacity = operativeIds.length >= maxTotal

  // 排序：队长 → 唯一 → 可复选
  const ordered = [
    ...pack.operatives.filter((o) => leaders.has(o.operativeId)),
    ...pack.operatives.filter((o) => !leaders.has(o.operativeId) && !except.has(o.operativeId)),
    ...pack.operatives.filter((o) => !leaders.has(o.operativeId) && except.has(o.operativeId)),
  ]

  function countOf(opId: string): number {
    return operativeIds.filter((x) => x === opId).length
  }

  function getInstances(opId: string): { key: string; instance: number }[] {
    const result: { key: string; instance: number }[] = []
    let inst = 0
    for (const id of operativeIds) {
      if (id === opId) { result.push({ key: `${opId}#${inst}`, instance: inst }); inst++ }
    }
    return result
  }

  function addOp(opId: string) {
    const cnt = countOf(opId)
    const key = `${opId}#${cnt}`
    const mark = defaultMarkFor(pack)
    onChange({
      operativeIds: [...operativeIds, opId],
      loadout: { ...loadout, [key]: defaultLoadoutFor(pack, opId) },
      ...(mark ? { perOperativeMarks: { ...perOperativeMarks, [key]: mark } } : {}),
    })
  }

  // 删除指定 instance，并把后续同 opId 的 instance 编号往前补（保持 loadout/wargear/印记 键连续）
  function removeInstance(opId: string, instance: number) {
    const rebuildIds: string[] = []
    const rebuildLoadout: Record<string, string[]> = {}
    const rebuildWg: Record<string, string[]> = {}
    const rebuildMarks: Record<string, string> = {}
    let removed = false
    for (let i = 0; i < operativeIds.length; i++) {
      const id = operativeIds[i]!
      const oldInst = operativeIds.slice(0, i).filter((x) => x === id).length
      if (id === opId && oldInst === instance && !removed) { removed = true; continue }
      const oldKey = `${id}#${oldInst}`
      const newKey = `${id}#${rebuildIds.filter((x) => x === id).length}`
      rebuildIds.push(id)
      rebuildLoadout[newKey] = loadout[oldKey] ?? []
      if (wargearAssignment[oldKey]) rebuildWg[newKey] = wargearAssignment[oldKey]
      if (perOperativeMarks[oldKey]) rebuildMarks[newKey] = perOperativeMarks[oldKey]
    }
    onChange({ operativeIds: rebuildIds, loadout: rebuildLoadout, wargearAssignment: rebuildWg, perOperativeMarks: rebuildMarks })
  }

  function selectLeader(opId: string) {
    const kept = operativeIds.filter((id) => !leaders.has(id))
    const next = [...kept, opId]
    const newKey = `${opId}#${next.filter((x) => x === opId).length - 1}`
    const mark = defaultMarkFor(pack)
    onChange({
      operativeIds: next,
      loadout: { ...loadout, [newKey]: loadout[newKey] ?? defaultLoadoutFor(pack, opId) },
      ...(mark && !perOperativeMarks[newKey] ? { perOperativeMarks: { ...perOperativeMarks, [newKey]: mark } } : {}),
    })
  }

  // 阵营装备：下拉选「无」即清空（修复 radio 无法取消的问题）
  function setWargear(key: string, wgId: string) {
    onChange({ operativeIds, loadout, wargearAssignment: { ...wargearAssignment, [key]: wgId ? [wgId] : [] } })
  }

  function setWeapon(key: string, weaponId: string, kind: 'RANGED' | 'MELEE') {
    const cur = loadout[key] ?? []
    const filtered = cur.filter((wid) => pack.weapons.find((w) => w.weaponId === wid)?.kind !== kind)
    if (weaponId) filtered.push(weaponId)
    onChange({ operativeIds, loadout: { ...loadout, [key]: filtered } })
  }

  function takenWargearIds(excludeKey: string): Set<string> {
    const s = new Set<string>()
    for (const [k, list] of Object.entries(wargearAssignment)) {
      if (k !== excludeKey) for (const w of list) s.add(w)
    }
    return s
  }

  return (
    <div className="operative-picker">
      <h3>特工配置（{operativeIds.length}/{maxTotal} 名）{atCapacity && <span className="op-full"> 已满</span>}</h3>
      <table className="roster-table">
        <thead>
          <tr>
            <th className="rt-name">特工</th>
            <th className="rt-stat">豁免</th>
            <th className="rt-stat">耐伤</th>
            <th className="rt-stat">移动</th>
            <th className="rt-wg">阵营装备</th>
            <th className="rt-wp">装备配置</th>
            <th className="rt-act">操作</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((op) => {
            const isLeader = leaders.has(op.operativeId)
            const isRepeatable = except.has(op.operativeId)
            const count = countOf(op.operativeId)
            const instances = getInstances(op.operativeId)
            const canAdd = !atCapacity && count < maxPerType(op.operativeId)

            return (
              <Fragment key={op.operativeId}>
                {/* 类型头行：名称 + 属性 + 加号 */}
                <tr className={`rt-type-row ${count > 0 ? 'has' : ''}`}>
                  <td className="rt-name">
                    {isLeader ? (
                      <label className="rt-leader-pick">
                        <input type="radio" name="leader" checked={count > 0} onChange={() => selectLeader(op.operativeId)} />
                        {op.name}
                      </label>
                    ) : (
                      <span>{op.name}</span>
                    )}
                    {isLeader && <span className="rt-tag">队长</span>}
                    {isRepeatable && <span className="rt-tag">可复选</span>}
                  </td>
                  <td className="rt-stat">{op.stats.save}+</td>
                  <td className="rt-stat">{op.stats.wounds}</td>
                  <td className="rt-stat">{op.stats.move}"</td>
                  <td className="rt-wg"></td>
                  <td className="rt-wp"></td>
                  <td className="rt-act">
                    {!isLeader && (
                      <button className="op-btn" onClick={() => addOp(op.operativeId)} disabled={!canAdd} title="添加">＋</button>
                    )}
                    {isRepeatable && count > 0 && <span className="rt-cnt">×{count}</span>}
                  </td>
                </tr>
                {/* 每个已入队实例：独立阵营装备 + 装备配置 */}
                {instances.map(({ key, instance }) => {
                  const myLoadout = loadout[key] ?? []
                  const myWg = (wargearAssignment[key] ?? [])[0] ?? ''
                  const taken = takenWargearIds(key)
                  const ranged = op.weaponRefs.map((wid) => pack.weapons.find((w) => w.weaponId === wid)).filter((w) => w?.kind === 'RANGED')
                  const melee = op.weaponRefs.map((wid) => pack.weapons.find((w) => w.weaponId === wid)).filter((w) => w?.kind === 'MELEE')
                  const selRanged = myLoadout.find((wid) => pack.weapons.find((w) => w.weaponId === wid)?.kind === 'RANGED') ?? ''
                  const selMelee = myLoadout.find((wid) => pack.weapons.find((w) => w.weaponId === wid)?.kind === 'MELEE') ?? ''

                  return (
                    <tr key={key} className="rt-instance-row">
                      <td className="rt-name rt-sub">
                        <span className="rt-inst-name">{op.name}{isRepeatable && instance > 0 ? ` #${instance + 1}` : ''}</span>
                        {isPerOperativeMarks && (
                          <select
                            className="rt-mark-select"
                            value={perOperativeMarks[key] ?? ''}
                            onChange={(e) => onChange({ operativeIds, loadout, perOperativeMarks: { ...perOperativeMarks, [key]: e.target.value } })}
                          >
                            <option value="">印记…</option>
                            {markOptions.map((optId) => {
                              const eff = pack.effects.find((x) => x.effectId === optId)
                              return <option key={optId} value={optId}>{eff?.label.split('（')[0] ?? optId}</option>
                            })}
                          </select>
                        )}
                      </td>
                      <td className="rt-stat muted">{op.stats.save}+</td>
                      <td className="rt-stat muted">{op.stats.wounds}</td>
                      <td className="rt-stat muted">{op.stats.move}"</td>
                      <td className="rt-wg">
                        <select value={myWg} onChange={(e) => setWargear(key, e.target.value)}>
                          <option value="">无</option>
                          {wargearList.map((wg) => (
                            <option key={wg.id} value={wg.id} disabled={taken.has(wg.id)}>
                              {wg.name}{taken.has(wg.id) ? '（已占用）' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="rt-wp">
                        {ranged.length > 0 && (
                          <select value={selRanged} onChange={(e) => setWeapon(key, e.target.value, 'RANGED')}>
                            <option value="">远程…</option>
                            {ranged.map((w) => <option key={w!.weaponId} value={w!.weaponId}>{w!.name} ({fmtWeapon(w!)})</option>)}
                          </select>
                        )}
                        {melee.length > 0 && (
                          <select value={selMelee} onChange={(e) => setWeapon(key, e.target.value, 'MELEE')}>
                            <option value="">近战…</option>
                            {melee.map((w) => <option key={w!.weaponId} value={w!.weaponId}>{w!.name} ({fmtWeapon(w!)})</option>)}
                          </select>
                        )}
                      </td>
                      <td className="rt-act">
                        {isLeader ? (
                          <span className="rt-fixed">队长</span>
                        ) : (
                          <button className="op-btn rt-remove" onClick={() => removeInstance(op.operativeId, instance)} title="移除">✕</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** 建队默认：首名队长 + 各类型一名（可复选类型补足到 min）。供 RosterView 选阵营时调用。 */
export function computeDefaultRoster(pack: FactionPack): { operativeIds: string[]; loadout: Record<string, string[]>; perOperativeMarks: Record<string, string> } {
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const except = new Set(pack.buildConstraints?.maxPerTypeExcept ?? [])
  const maxTotal = pack.buildConstraints?.operatives?.max ?? 99
  const minTotal = pack.buildConstraints?.operatives?.min ?? 0
  const markDefault = defaultMarkFor(pack)
  const ids: string[] = []
  const loadout: Record<string, string[]> = {}
  const marks: Record<string, string> = {}
  const add = (opId: string) => {
    if (ids.length >= maxTotal) return
    const key = `${opId}#${ids.filter((x) => x === opId).length}`
    loadout[key] = defaultLoadoutFor(pack, opId)
    if (markDefault) marks[key] = markDefault
    ids.push(opId)
  }
  const cap = (opId: string) => (except.has(opId) ? maxTotal : 1)
  const count = (opId: string) => ids.filter((x) => x === opId).length

  const firstLeader = pack.operatives.find((o) => leaders.has(o.operativeId))
  if (firstLeader) add(firstLeader.operativeId)
  // 一轮：每个非队长类型各一名
  for (const op of pack.operatives) {
    if (leaders.has(op.operativeId)) continue
    if (count(op.operativeId) < cap(op.operativeId)) add(op.operativeId)
  }
  // 不足 min：用可复选类型补足
  const reps = pack.operatives.filter((o) => except.has(o.operativeId))
  let guard = 0
  while (ids.length < minTotal && reps.length && guard < maxTotal * reps.length) {
    for (const op of reps) {
      if (ids.length >= minTotal) break
      if (count(op.operativeId) < cap(op.operativeId)) add(op.operativeId)
    }
    guard++
  }
  return { operativeIds: ids, loadout, perOperativeMarks: marks }
}
