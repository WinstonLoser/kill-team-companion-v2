import { useState } from 'react'
import { getAvatarUrl } from '../../utils/avatars'
import { isChapterVeteran, personalAbilities, psychicRangedWeapons, rosterOptionLabel } from '../../rules/rosterOptions'
import '../../styles/roster-builder.css'
import type { FactionPack, Operative, Weapon } from '../../rules'
import { fmtWeapon } from '../weaponDisplay'

/** 默认装备配置：每个 loadout 槽取首个 option 的武器。 */

function defaultLoadoutFor(pack: FactionPack, opId: string): string[] {
  const op = pack.operatives.find((o) => o.operativeId === opId)
  if (!op) return []
  const out: string[] = []
  for (const slot of op.loadouts) {
    const first = slot.options[0]
    if (first) for (const wid of first) out.push(wid)
  }
  return out
}

function weaponProfileGroups(weapons: Weapon[]) {
  const groups = new Map<string, Weapon[]>()
  for (const weapon of weapons) {
    const englishName = weapon.name.split(' / ')[0] ?? weapon.name
    const key = `${weapon.kind}:${englishName.replace(/\s*\([^)]*\)$/, '')}`
    groups.set(key, [...(groups.get(key) ?? []), weapon])
  }
  return [...groups.values()].map(profiles => {
    const name = profiles[0]!.name.split(' / ').at(-1) ?? profiles[0]!.name
    return { name: profiles.length > 1 ? name.replace(/\s*[（(][^()（）]*[）)]$/, '') : name, profiles }
  })
}

/** Enumerate whole legal kits before presenting separate ranged/melee choices. */
export function legalLoadoutBundles(op: Operative): string[][] {
  let bundles: string[][] = [[]]
  for (const slot of op.loadouts) bundles = bundles.flatMap(before => slot.options.map(option => [...before, ...option]))
  return bundles
}

function weaponIdsOfKind(pack: FactionPack, ids: string[], kind: Weapon['kind']) {
  return ids.filter(id => pack.weapons.find(weapon => weapon.weaponId === id)?.kind === kind)
}

function sameWeapons(a: string[], b: string[]) {
  return [...a].sort().join('|') === [...b].sort().join('|')
}

/** Preserve the other weapon category when possible; otherwise use a legal fixed pairing. */
export function chooseLoadoutByKind(pack: FactionPack, op: Operative, current: string[], kind: Weapon['kind'], chosen: string[]): string[] {
  const bundles = legalLoadoutBundles(op).filter(bundle => sameWeapons(weaponIdsOfKind(pack, bundle, kind), chosen))
  const otherKind = kind === 'RANGED' ? 'MELEE' : 'RANGED'
  const previousOther = weaponIdsOfKind(pack, current, otherKind)
  return bundles.find(bundle => sameWeapons(weaponIdsOfKind(pack, bundle, otherKind), previousOther)) ?? bundles[0] ?? current
}

function GuidedWeaponChoices({ pack, op, current, onSelect }: { pack: FactionPack; op: Operative; current: string[]; onSelect: (ids: string[]) => void }) {
  const bundles = legalLoadoutBundles(op)
  const ranged = weaponIdsOfKind(pack, current, 'RANGED')
  const melee = weaponIdsOfKind(pack, current, 'MELEE')
  const uniqueChoices = (list: string[][], kind: Weapon['kind']) => {
    const seen = new Set<string>()
    return list.map(bundle => weaponIdsOfKind(pack, bundle, kind)).filter(ids => {
      const key = [...ids].sort().join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  const rangedChoices = uniqueChoices(bundles, 'RANGED')
  const compatible = bundles.filter(bundle => sameWeapons(weaponIdsOfKind(pack, bundle, 'RANGED'), ranged))
  const meleeChoices = uniqueChoices(compatible, 'MELEE')
  const rangedGroups = weaponProfileGroups(ranged.flatMap(id => { const weapon = pack.weapons.find(item => item.weaponId === id); return weapon ? [weapon] : [] }))
  const renderChoice = (ids: string[], kind: Weapon['kind']) => {
    const selected = sameWeapons(kind === 'RANGED' ? ranged : melee, ids)
    const groups = weaponProfileGroups(ids.flatMap(id => { const weapon = pack.weapons.find(item => item.weaponId === id); return weapon ? [weapon] : [] }))
    return <button type="button" className="recruit-weapon-choice" aria-pressed={selected} key={[...ids].sort().join('|') || 'none'} onClick={() => onSelect(chooseLoadoutByKind(pack, op, current, kind, ids))}>
      <strong>{groups.map(group => `${group.name}${group.profiles.length > 1 ? '（多模式）' : ''}`).join(' + ') || '无'}</strong>
      {groups.map(group => <small key={group.name}>{group.profiles.length > 1 ? `${group.name}：${group.profiles.map(profile => profile.name.split(' / ').at(-1)?.match(/[（(]([^()（）]+)[）)]$/)?.[1] ?? '').join(' / ')}` : fmtWeapon(group.profiles[0]!)}</small>)}
    </button>
  }
  return <div className="recruit-guided-weapons">
    <section className="recruit-weapon-step" aria-label="选择远程武器"><h5>① 远程武器</h5><p>{rangedChoices.length === 1 ? '固定配备；多模式武器在射击时选模式。' : '先选择本特工携带的远程武器。'}{rangedGroups.length > 1 ? ` 当前携带 ${rangedGroups.length} 项远程攻击，射击时选用其中一项。` : ''}</p><div className="recruit-weapon-choices">{rangedChoices.map(ids => renderChoice(ids, 'RANGED'))}</div></section>
    <section className="recruit-weapon-step" aria-label="选择近战武器"><h5>② 近战武器</h5><p>{meleeChoices.length === 1 ? '与当前远程方案固定搭配，已自动匹配。' : '再选择兼容的近战武器。'}</p><div className="recruit-weapon-choices">{meleeChoices.map(ids => renderChoice(ids, 'MELEE'))}</div></section>
  </div>
}

export function OperativePicker({
  pack,
  operativeIds,
  loadout,
  perOperativeMarks,
  personalAbilityIds,
  personalTactics,
  boonWeaponTargets,
  personalRulesEnabled,
  onChange,
}: {
  pack: FactionPack
  operativeIds: string[]
  loadout: Record<string, string[]>
  perOperativeMarks: Record<string, string>
  personalAbilityIds: Record<string, string[]>
  personalTactics: Record<string, string>
  boonWeaponTargets: Record<string, string>
  personalRulesEnabled: boolean
  onChange: (next: { operativeIds: string[]; loadout: Record<string, string[]>; perOperativeMarks?: Record<string, string>; personalAbilityIds?: Record<string, string[]>; personalTactics?: Record<string, string>; boonWeaponTargets?: Record<string, string> }) => void
}) {
  const [filter, setFilter] = useState<'all' | 'selected'>('all')
  const [statusMenu, setStatusMenu] = useState<string | null>(null)
  const displayName = (name: string) => name.split(' / ').at(-1) ?? name
  const except = new Set(pack.buildConstraints?.maxPerTypeExcept ?? [])
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const typeLimits = pack.buildConstraints?.operativeTypeLimits ?? {}
  const ineligible = new Set(pack.buildConstraints?.initialRosterIneligible ?? [])
  const maxTotal = pack.buildConstraints?.operatives?.max ?? 99
  const selector = pack.faction.subFactionSelector
  const isPerOperativeSelector = selector?.scope === 'perOperative'
  const markOptions = selector?.options ?? []
  // 类型数量上限：精确约束优先（固定组成），其次可复选例外，缺省每类 1
  const maxPerType = (opId: string) => {
    const lim = typeLimits[opId]
    if (lim?.max !== undefined) return lim.max
    return except.has(opId) ? maxTotal : 1
  }
  const atCapacity = operativeIds.length >= maxTotal
  const sp = pack.buildConstraints?.selectionPoints
  const costs = pack.buildConstraints?.operativeCosts ?? {}
  const totalPoints = operativeIds.reduce((sum, id) => sum + (costs[id] ?? 1), 0)
  const pointsCap = sp?.exact ?? sp?.max
  const atPointCapacity = pointsCap !== undefined && totalPoints >= pointsCap
  // perOperative 选择器资格（通用化：按关键词而非 selector.id 特判）
  const markEligible = (keywords: string[]) =>
    !selector?.eligibleKeywords || selector.eligibleKeywords.length === 0 ||
    keywords.some((k) => selector.eligibleKeywords!.includes(k))
  const takenMarks = new Set(
    Object.entries(perOperativeMarks).filter(([, v]) => v).map(([, v]) => v as string),
  )
  // 选择器选项展示名：effect 优先，其次阵营规则选项（如诅咒之礼）
  const markLabel = (optId: string) => rosterOptionLabel(pack, optId)

  // 排序：队长 → 唯一 → 可复选；初始不可选（变异者/受难者）不进入建队列表
  const selectable = pack.operatives.filter((o) => !ineligible.has(o.operativeId))
  const ordered = [
    ...selectable.filter((o) => leaders.has(o.operativeId)),
    ...selectable.filter((o) => !leaders.has(o.operativeId) && maxPerType(o.operativeId) <= 1),
    ...selectable.filter((o) => !leaders.has(o.operativeId) && maxPerType(o.operativeId) > 1),
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
    onChange({
      operativeIds: [...operativeIds, opId],
      loadout: { ...loadout, [key]: defaultLoadoutFor(pack, opId) },
    })
  }

  // 删除指定 instance，并把后续同 opId 的 instance 编号往前补（保持武器/印记键连续）
  function removeInstance(opId: string, instance: number) {
    const rebuildIds: string[] = []
    const rebuildLoadout: Record<string, string[]> = {}
    const rebuildMarks: Record<string, string> = {}
    const rebuildAbilities: Record<string, string[]> = {}
    const rebuildTactics: Record<string, string> = {}
    const rebuildBoonTargets: Record<string, string> = {}
    let removed = false
    for (let i = 0; i < operativeIds.length; i++) {
      const id = operativeIds[i]!
      const oldInst = operativeIds.slice(0, i).filter((x) => x === id).length
      if (id === opId && oldInst === instance && !removed) { removed = true; continue }
      const oldKey = `${id}#${oldInst}`
      const newKey = `${id}#${rebuildIds.filter((x) => x === id).length}`
      rebuildIds.push(id)
      rebuildLoadout[newKey] = loadout[oldKey] ?? []
      if (perOperativeMarks[oldKey]) rebuildMarks[newKey] = perOperativeMarks[oldKey]
      if (personalAbilityIds[oldKey]) rebuildAbilities[newKey] = personalAbilityIds[oldKey]
      if (personalTactics[oldKey]) rebuildTactics[newKey] = personalTactics[oldKey]
      if (boonWeaponTargets[oldKey]) rebuildBoonTargets[newKey] = boonWeaponTargets[oldKey]
    }
    onChange({ operativeIds: rebuildIds, loadout: rebuildLoadout, perOperativeMarks: rebuildMarks, personalAbilityIds: rebuildAbilities, personalTactics: rebuildTactics, boonWeaponTargets: rebuildBoonTargets })
  }

  function selectLeader(opId: string) {
    const kept = operativeIds.filter((id) => !leaders.has(id))
    const next = [...kept, opId]
    const newKey = `${opId}#${next.filter((x) => x === opId).length - 1}`
    const keepKey = (key: string) => !leaders.has(key.split('#')[0]!)
    const keep = <T,>(record: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([key]) => keepKey(key)))
    onChange({
      operativeIds: next,
      loadout: { ...keep(loadout), [newKey]: loadout[newKey] ?? defaultLoadoutFor(pack, opId) },
      perOperativeMarks: keep(perOperativeMarks),
      personalAbilityIds: { ...keep(personalAbilityIds), ...(personalAbilityIds[newKey] ? { [newKey]: personalAbilityIds[newKey] } : {}) },
      personalTactics: { ...keep(personalTactics), ...(personalTactics[newKey] ? { [newKey]: personalTactics[newKey] } : {}) },
      boonWeaponTargets: keep(boonWeaponTargets),
    })
  }

  function setWholeLoadout(key: string, selected: string[]) {
    const targets = { ...boonWeaponTargets }
    if (targets[key] && !psychicRangedWeapons(pack, selected).some(weapon => weapon.weaponId === targets[key])) delete targets[key]
    onChange({ operativeIds, loadout: { ...loadout, [key]: selected }, boonWeaponTargets: targets })
  }

  // 点数制建队（次元密会）：显示已用点数
  return (
    <section className="operative-picker roster-builder">
      <header className="builder-heading">
        <div><span className="builder-eyebrow">OPERATIVE SELECTION</span><h3>组建你的杀戮小队</h3><p>{personalRulesEnabled ? '选择成员，展开卡片配置武器；额外能力只给本局需要的特工选。' : '选择成员，展开卡片配置武器。'}</p></div>
        <div className="builder-count" aria-live="polite"><strong>{operativeIds.length}<small>{sp ? ' 名' : ` / ${maxTotal}`}</small></strong><span>已入队{atCapacity ? ' · 人数已满' : atPointCapacity ? ' · 点数已满' : ''}</span>{sp && pointsCap !== undefined && <span>点数 {totalPoints} / {pointsCap}</span>}</div>
      </header>
      <div className="builder-toolbar" aria-label="特工筛选">
        <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>全部特工 · {ordered.length} 类</button>
        <button aria-pressed={filter === 'selected'} onClick={() => setFilter('selected')}>已入队 · {operativeIds.length} 名</button>
        <span>金色边框表示已入队</span>
      </div>
      {filter === 'selected' && operativeIds.length === 0 && <p className="builder-empty">小队还没有成员。切换到「全部特工」开始选择。</p>}
      <div className="builder-grid">
        {ordered.filter(op => filter === 'all' || countOf(op.operativeId) > 0).map(op => {
          const isLeader = leaders.has(op.operativeId)
          const isRepeatable = maxPerType(op.operativeId) > 1
          const count = countOf(op.operativeId)
          const name = displayName(op.name)
          const canAdd = !atCapacity && count < maxPerType(op.operativeId) && (pointsCap === undefined || totalPoints + (costs[op.operativeId] ?? 1) <= pointsCap)
          const canChooseLeader = operativeIds.some(id => leaders.has(id)) || canAdd
          return <article key={op.operativeId} className={`recruit-card ${count ? 'recruited' : ''}`} aria-label={name}>
            <div className="recruit-portrait">
              <div className="recruit-art-fallback" aria-hidden="true"><span>KT</span><small>{name}</small></div>
              <img key={`${pack.faction.id}/${op.operativeId}`} src={getAvatarUrl(pack.faction.id, op.operativeId)} alt={name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />
              <span className="recruit-role">{isLeader ? '队长' : isRepeatable ? '可复选成员' : '独立成员'}{sp ? ` · ${costs[op.operativeId] ?? 1} 点` : ''}</span>
              <div className="recruit-status-group">
                <button type="button" className="recruit-status" aria-pressed={count > 0} aria-expanded={isRepeatable && count > 1 ? statusMenu === op.operativeId : undefined} aria-label={count ? `${name} 已入队${isRepeatable ? ` ${count} 名；${count > 1 ? '点击选择要退出的成员' : '点击退出小队'}` : '；点击退出小队'}` : `${name} 未入队；点击加入小队`} disabled={!count && !(isLeader ? canChooseLeader : canAdd)} onClick={() => {
                  if (isRepeatable && count > 1) setStatusMenu(statusMenu === op.operativeId ? null : op.operativeId)
                  else if (count) { removeInstance(op.operativeId, 0); setStatusMenu(null) }
                  else if (isLeader) selectLeader(op.operativeId)
                  else addOp(op.operativeId)
                }}>{count ? `✓ 已入队${isRepeatable ? ` ×${count}` : ''}` : '＋ 未入队'}</button>
                {isRepeatable && count > 0 && <button type="button" className="recruit-add-one" disabled={!canAdd} aria-label={`再加入一名 ${name}`} onClick={() => addOp(op.operativeId)}>＋1</button>}
              </div>
              <div className="recruit-title"><small>{op.name.includes(' / ') ? op.name.split(' / ')[0] : 'KILL TEAM OPERATIVE'}</small><h4>{name}</h4></div>
            </div>
            <dl className="recruit-stats">
              <div><dt>行动点</dt><dd>{op.stats.apl}<small> APL</small></dd></div>
              <div><dt>移动</dt><dd>{op.stats.move}<small>″</small></dd></div>
              <div><dt>豁免</dt><dd>{op.stats.save}<small>+</small></dd></div>
              <div><dt>耐伤</dt><dd>{op.stats.wounds}<small> W</small></dd></div>
            </dl>
            <div className="recruit-body">
              <p className="recruit-count-note">{isLeader ? '每队 1 名队长' : sp && isRepeatable ? `已选 ${count} 名 · 每名 ${costs[op.operativeId] ?? 1} 点` : `已选 ${count} / ${maxPerType(op.operativeId)}`}{isRepeatable && count > 0 ? ' · 右上角 ＋1 增员，点「已入队」选择退出成员' : ''}</p>
              {isRepeatable && count > 1 && statusMenu === op.operativeId && <div className="recruit-member-menu" role="group" aria-label={`${name} 已入队成员`}><strong>选择要退出的成员</strong>{getInstances(op.operativeId).map(({ key, instance }) => <button type="button" key={key} onClick={() => { removeInstance(op.operativeId, instance); setStatusMenu(null) }}>成员 {String(instance + 1).padStart(2, '0')} · ✓ 已入队</button>)}</div>}
              {!count && <div className="recruit-preview"><span>默认武器</span>{defaultLoadoutFor(pack, op.operativeId).map(wid => <small key={wid}>{displayName(pack.weapons.find(w => w.weaponId === wid)?.name ?? wid)}</small>)}</div>}
              {getInstances(op.operativeId).map(({ key, instance }) => {
                const myLoadout = loadout[key] ?? []
                const equipped = myLoadout.flatMap(wid => { const weapon = pack.weapons.find(w => w.weaponId === wid); return weapon ? [weapon] : [] })
                const rangedWeapons = equipped.filter(weapon => weapon.kind === 'RANGED')
                const meleeWeapons = equipped.filter(weapon => weapon.kind === 'MELEE')
                const rangedGroups = weaponProfileGroups(rangedWeapons)
                const meleeGroups = weaponProfileGroups(meleeWeapons)
                return <div className="recruit-member" key={key}>
                  <details>
                    <summary><span><strong>{isRepeatable ? `成员 ${String(instance + 1).padStart(2, '0')}` : '武器与配置'}</strong><small>远程：{rangedGroups.map(group => `${group.name}${group.profiles.length > 1 ? '（多模式）' : ''}`).join(' · ') || '无'}</small><small>近战：{meleeGroups.map(group => group.name).join(' · ') || '无'}</small></span><span className="recruit-expand">配置</span></summary>
                    <div className="recruit-config">
                      {personalRulesEnabled && isPerOperativeSelector && markEligible(op.keywords) && <label>{selector!.label.split('（')[0]}<small>可选；按你们面对面约定启用</small><select aria-label={`${name} ${instance + 1} ${selector!.label}`} value={perOperativeMarks[key] ?? ''} onChange={e => {
                        const boonWeaponTargetsNext = { ...boonWeaponTargets }
                        if (e.target.value !== 'boon_starburst') delete boonWeaponTargetsNext[key]
                        onChange({ operativeIds, loadout, perOperativeMarks: { ...perOperativeMarks, [key]: e.target.value }, boonWeaponTargets: boonWeaponTargetsNext })
                      }}>
                        <option value="">不启用此项能力</option>{markOptions.map(optId => { const used = selector!.uniqueAcrossTeam && takenMarks.has(optId) && perOperativeMarks[key] !== optId; const forbidden = pack.faction.id === 'legionaries' && op.operativeId === 'balefire_acolyte' && optId === 'mark_khorne'; return <option key={optId} value={optId} disabled={used || forbidden}>{markLabel(optId)}{forbidden ? '（邪火使徒不可选）' : used ? '（已选）' : ''}</option> })}
                      </select></label>}
                      {personalRulesEnabled && perOperativeMarks[key] === 'boon_starburst' && <label>星爆术作用武器<select aria-label={`${name} ${instance + 1} 星爆术作用武器`} value={boonWeaponTargets[key] ?? ''} onChange={e => onChange({ operativeIds, loadout, boonWeaponTargets: { ...boonWeaponTargets, [key]: e.target.value } })}>
                        <option value="">请选择已装备的灵能远程武器…</option>{psychicRangedWeapons(pack, myLoadout).map(w => <option key={w.weaponId} value={w.weaponId}>{displayName(w.name)}</option>)}
                      </select></label>}
                      {personalRulesEnabled && personalAbilities(pack, op.operativeId).length > 0 && <div className="recruit-abilities"><strong>个性化能力</strong><small>面对面协商后逐项启用；未启用的不参与对局</small>
                        {personalAbilities(pack, op.operativeId).map(ability => {
                          const enabled = (personalAbilityIds[key] ?? []).includes(ability.abilityId)
                          return <label className="recruit-ability" key={ability.abilityId}><input type="checkbox" checked={enabled} onChange={e => {
                            const current = personalAbilityIds[key] ?? []
                            const next = e.target.checked ? [...current, ability.abilityId] : current.filter(id => id !== ability.abilityId)
                            const tactics = { ...personalTactics }
                            if (ability.abilityId === 'chapter_veteran' && !e.target.checked) delete tactics[key]
                            onChange({ operativeIds, loadout, personalAbilityIds: { ...personalAbilityIds, [key]: next }, personalTactics: tactics })
                          }} /><span><b>{ability.name.split(' / ').at(-1)}</b>{ability.description && <small>{ability.description}</small>}</span></label>
                        })}
                      </div>}
                      {personalRulesEnabled && isChapterVeteran(pack, op.operativeId) && (personalAbilityIds[key] ?? []).includes('chapter_veteran') && <label>战团老兵 · 额外战术<select aria-label={`${name} ${instance + 1} 战团老兵战术`} value={personalTactics[key] ?? ''} onChange={e => onChange({ operativeIds, loadout, personalTactics: { ...personalTactics, [key]: e.target.value } })}>
                        <option value="">请选择一项战团战术…</option>{(pack.faction.subFactionSelector?.options ?? []).map(id => <option key={id} value={id}>{markLabel(id)}</option>)}
                      </select></label>}
                      <GuidedWeaponChoices pack={pack} op={op} current={myLoadout} onSelect={selected => setWholeLoadout(key, selected)} />
                      <div className="recruit-weapon-groups">
                        {([['RANGED', '远程武器', rangedGroups], ['MELEE', '近战武器', meleeGroups]] as const).map(([kind, title, groups]) => <section className="recruit-weapon-group" key={kind} aria-label={title}>
                          <h5>{title}</h5>
                          {groups.length ? groups.map(group => <div className="recruit-weapon-profile-group" key={group.name}>
                            {group.profiles.length > 1 && <div className="recruit-weapon-profile-heading"><strong>{group.name}</strong><small>{kind === 'RANGED' ? '每次射击时选择一种模式' : '每次近战时选择一种模式'}</small></div>}
                            {group.profiles.map(weapon => <div className="recruit-weapon" key={weapon.weaponId}><strong>{displayName(weapon.name)}</strong><small>{fmtWeapon(weapon)}</small></div>)}
                          </div>) : <p>无</p>}
                        </section>)}
                      </div>
                    </div>
                  </details>
                </div>
              })}
            </div>
          </article>
        })}
      </div>
    </section>
  )
}

/** 建队默认：按通用约束生成合法默认阵容。固定组成（operativeTypeLimits）精确补满；
 *  点数制（selectionPoints）下按点数截断并优先满足 minimumByKeyword；
 *  其余沿用“首名队长 + 各类型一名 + 可复选补足”策略；跳过 initialRosterIneligible。 */
export function computeDefaultRoster(pack: FactionPack): { operativeIds: string[]; loadout: Record<string, string[]>; perOperativeMarks: Record<string, string> } {
  const leaders = new Set(pack.buildConstraints?.leaderFrom ?? [])
  const except = new Set(pack.buildConstraints?.maxPerTypeExcept ?? [])
  const typeLimits = pack.buildConstraints?.operativeTypeLimits ?? {}
  const ineligible = new Set(pack.buildConstraints?.initialRosterIneligible ?? [])
  const costs = pack.buildConstraints?.operativeCosts ?? {}
  const sp = pack.buildConstraints?.selectionPoints
  const kwMin = pack.buildConstraints?.minimumByKeyword ?? {}
  const maxTotal = pack.buildConstraints?.operatives?.max ?? 99
  const minTotal = pack.buildConstraints?.operatives?.min ?? 0
  const pointsTarget = sp?.exact ?? sp?.max
  const ids: string[] = []
  const loadout: Record<string, string[]> = {}
  const marks: Record<string, string> = {}
  const usedMarks = new Set<string>()
  const add = (opId: string) => {
    if (ids.length >= maxTotal) return
    const key = `${opId}#${ids.filter((x) => x === opId).length}`
    loadout[key] = defaultLoadoutFor(pack, opId)
    const opDef = pack.operatives.find((o) => o.operativeId === opId)
    const mark = nextDefaultMark(pack, usedMarks, opDef?.keywords)
    if (mark) { marks[key] = mark; usedMarks.add(mark) }
    ids.push(opId)
  }
  const cost = (opId: string) => costs[opId] ?? 1
  const totalCost = () => ids.reduce((sum, id) => sum + cost(id), 0)
  /** 点数制下还能否再容纳该特工 */
  const pointsAllow = (opId: string) => pointsTarget === undefined || totalCost() + cost(opId) <= pointsTarget
  const cap = (opId: string) => {
    const lim = typeLimits[opId]
    if (lim?.max !== undefined) return lim.max
    return except.has(opId) ? maxTotal : 1
  }
  const need = (opId: string) => typeLimits[opId]?.min ?? 0
  const count = (opId: string) => ids.filter((x) => x === opId).length
  const opById = new Map(pack.operatives.map((o) => [o.operativeId, o]))
  const selectable = pack.operatives.filter((o) => !ineligible.has(o.operativeId))

  const firstLeader = selectable.find((o) => leaders.has(o.operativeId))
  if (firstLeader) add(firstLeader.operativeId)

  // 固定组成：精确补满各类型 min（如混沌教派 2 祝福战刃 + 9 虔信者）
  for (const op of selectable) {
    while (count(op.operativeId) < need(op.operativeId) && count(op.operativeId) < cap(op.operativeId) && ids.length < maxTotal) {
      add(op.operativeId)
    }
  }

  // 关键词下限（如次元密会至少 1 名巫师）：点数允许时优先补足
  for (const [kw, needKw] of Object.entries(kwMin)) {
    let have = ids.filter((id) => opById.get(id)?.keywords.includes(kw)).length
    for (const op of selectable) {
      if (have >= needKw) break
      if (!op.keywords.includes(kw)) continue
      while (have < needKw && count(op.operativeId) < cap(op.operativeId) && pointsAllow(op.operativeId)) {
        add(op.operativeId)
        have++
      }
    }
  }

  // 一轮：无精确约束的唯一类型（原 AC3 行为；点数制下按点数截断）
  for (const op of selectable) {
    if (leaders.has(op.operativeId) || typeLimits[op.operativeId]) continue
    if (except.has(op.operativeId)) continue
    if (count(op.operativeId) < cap(op.operativeId) && pointsAllow(op.operativeId)) add(op.operativeId)
  }

  // 填补空位：可复选类型补足（固定组成类型优先，其次 except 列表）
  const reps = selectable.filter((o) => cap(o.operativeId) > 1 && !leaders.has(o.operativeId))
  const target = sp ? Math.ceil(pointsTarget ?? 0) : (maxTotal <= 20 ? maxTotal : minTotal)
  const reachedTarget = () => (sp ? totalCost() >= (pointsTarget ?? 0) : ids.length >= target)
  let guard = 0
  while (!reachedTarget() && reps.length > 0 && guard < target * reps.length + 20) {
    for (const op of reps) {
      if (reachedTarget()) break
      if (count(op.operativeId) < cap(op.operativeId) && pointsAllow(op.operativeId)) add(op.operativeId)
    }
    guard++
  }
  return { operativeIds: ids, loadout, perOperativeMarks: marks }
}

/** perOperative 选择器的默认选项：仅合格特工分配；uniqueAcrossTeam 时取首个未占用选项，否则取 default。 */
function nextDefaultMark(pack: FactionPack, used: Set<string>, opKeywords?: string[]): string | undefined {
  const sel = pack.faction.subFactionSelector
  if (!sel || sel.scope !== 'perOperative') return undefined
  if (opKeywords && sel.eligibleKeywords && sel.eligibleKeywords.length > 0) {
    const eligible = opKeywords.some((k) => sel.eligibleKeywords!.includes(k))
    if (!eligible) return undefined
  }
  if (sel.uniqueAcrossTeam) {
    return sel.options.find((o) => !used.has(o))
  }
  return sel.default
}
