import { beforeEach, describe, expect, it } from 'vitest'
import { ALL_PACKS } from '../../src/data/packs'
import { evaluateLegality } from '../../src/rules/legality'
import { psychicRangedWeapons } from '../../src/rules/rosterOptions'
import { buildMatchTokens, canStartMatch, rosterLegal } from '../../src/state/setup'
import { emptyRoster, useRosterStore, type RosterEntry } from '../../src/state/rosterStore'
import { computeDefaultRoster } from '../../src/ui/roster/OperativePicker'

const pack = (id: string) => ALL_PACKS.find(p => p.faction.id === id)!
const entry = (id: string): RosterEntry => {
  const faction = pack(id)
  return { ...emptyRoster(), factionId: id, ...computeDefaultRoster(faction), perOperativeMarks: {}, subFactionSelection: [] }
}

beforeEach(() => useRosterStore.getState().reset())

describe('建队通用约束与协商能力', () => {
  it('五个阵营的默认阵容都有合法卡面武器组合', () => {
    for (const faction of ALL_PACKS) {
      const roster = entry(faction.faction.id)
      expect(evaluateLegality({ pack: faction, ...roster }).checks.find(c => c.key === 'loadout')?.status, faction.faction.id).toBe('ok')
    }
  })

  it('军士战团老兵战术按实例必选，且与全队战术分别传入', () => {
    const roster = entry('angels_of_death')
    roster.operativeIds[0] = 'intercessor_sergeant'
    roster.loadout = { ...roster.loadout, 'intercessor_sergeant#0': pack('angels_of_death').operatives.find(op => op.operativeId === 'intercessor_sergeant')!.loadouts.flatMap(slot => slot.options[0] ?? []) }
    delete roster.loadout['space_marine_captain#0']
    roster.personalRulesEnabled = true
    roster.teamRulesEnabled = true
    roster.subFactionSelection = ['chapterTactic_relentless', 'chapterTactic_duelist']
    roster.personalAbilityIds['intercessor_sergeant#0'] = ['chapter_veteran']
    expect(evaluateLegality({ pack: pack('angels_of_death'), ...roster }).checks.find(c => c.key === 'personal-options')?.status).toBe('warn')
    roster.personalTactics['intercessor_sergeant#0'] = 'chapterTactic_resolute'
    expect(evaluateLegality({ pack: pack('angels_of_death'), ...roster }).legal).toBe(true)
    useRosterStore.getState().setRoster('a', roster)
    useRosterStore.getState().setRoster('b', entry('plague_marines'))
    expect(buildMatchTokens().find(t => t.opId === 'intercessor_sergeant')?.selections).toContain('chapterTactic_resolute')
  })

  it('死亡天使战团战术属于可选的全队个性化规则', () => {
    const a = entry('angels_of_death')
    useRosterStore.getState().setRoster('a', a)
    useRosterStore.getState().setRoster('b', entry('plague_marines'))
    expect(canStartMatch()).toBe(true)
    expect(buildMatchTokens().filter(t => t.side === 'a').every(t => t.selections?.length === 0)).toBe(true)

    useRosterStore.getState().patchRoster('a', { teamRulesEnabled: true })
    expect(canStartMatch()).toBe(false)
    useRosterStore.getState().patchRoster('a', { subFactionSelection: ['chapterTactic_relentless', 'chapterTactic_duelist'] })
    expect(canStartMatch()).toBe(true)
    expect(buildMatchTokens().filter(t => t.side === 'a').every(t => t.selections?.includes('chapterTactic_relentless'))).toBe(true)

    useRosterStore.getState().patchRoster('a', { teamRulesEnabled: false })
    expect(canStartMatch()).toBe(true)
    expect(buildMatchTokens().filter(t => t.side === 'a').every(t => !t.selections?.includes('chapterTactic_relentless'))).toBe(true)
  })

  it('星爆术仅接受该巫师已装备的灵能远程武器', () => {
    const roster = entry('warpcoven')
    const sorcerer = roster.operativeIds.find(id => pack('warpcoven').operatives.find(op => op.operativeId === id)?.keywords.includes('SORCERER'))!
    const key = `${sorcerer}#0`
    roster.perOperativeMarks[key] = 'boon_starburst'
    expect(evaluateLegality({ pack: pack('warpcoven'), ...roster }).checks.find(c => c.key === 'personal-options')?.status).toBe('warn')
    const psychic = psychicRangedWeapons(pack('warpcoven'), roster.loadout[key]!)[0]!
    roster.boonWeaponTargets[key] = psychic.weaponId
    expect(evaluateLegality({ pack: pack('warpcoven'), ...roster }).checks.find(c => c.key === 'personal-options')?.status).toBe('ok')
    roster.boonWeaponTargets[key] = 'wc_inferno_bolt_pistol'
    expect(evaluateLegality({ pack: pack('warpcoven'), ...roster }).checks.find(c => c.key === 'personal-options')?.status).toBe('warn')
  })

  it('启用个性化规则后逐人印记和恩惠仍可不选，但非法武器仍被拦截', () => {
    for (const id of ['legionaries', 'warpcoven']) {
      const roster = entry(id)
      roster.personalRulesEnabled = true
      expect(evaluateLegality({ pack: pack(id), ...roster }).legal).toBe(true)
      const first = roster.operativeIds[0]!
      roster.loadout[`${first}#0`] = ['not-on-card']
      expect(evaluateLegality({ pack: pack(id), ...roster }).checks.find(c => c.key === 'loadout')?.status).toBe('warn')
    }
  })

  it('各方独立启用个性化规则，无额外确认即可开局；能力按实例交给对局', () => {
    useRosterStore.getState().setRoster('a', entry('legionaries'))
    useRosterStore.getState().setRoster('b', entry('plague_marines'))
    const store = useRosterStore.getState()
    expect(rosterLegal(useRosterStore.getState().rosterA).legal).toBe(true)
    expect(canStartMatch()).toBe(true)
    const a = useRosterStore.getState().rosterA
    const key = `${a.operativeIds[0]}#0`
    store.patchRoster('a', { personalRulesEnabled: true, personalAbilityIds: { [key]: ['in_the_eyes_of_the_gods'] } })
    expect(canStartMatch()).toBe(true)
    const token = buildMatchTokens().find(t => t.side === 'a' && t.opId === a.operativeIds[0])!
    expect(token.enabledAbilityIds).toEqual(['in_the_eyes_of_the_gods'])
    expect(token.selections).toEqual([])
    expect(buildMatchTokens().filter(t => t.side === 'b').every(t => t.enabledAbilityIds?.length === 0)).toBe(true)
    store.patchRoster('a', { personalRulesEnabled: false, personalAbilityIds: {} })
    expect(canStartMatch()).toBe(true)
    expect(buildMatchTokens().find(t => t.side === 'a' && t.opId === a.operativeIds[0])?.enabledAbilityIds).toEqual([])
  })

  it('阵营装备按整队可选，非法或重复装备阻止开局，选择传入对局', () => {
    const roster = entry('plague_marines')
    roster.selectedWargearIds = ['plague_bell', 'plague_ammo']
    expect(evaluateLegality({ pack: pack('plague_marines'), ...roster }).legal).toBe(true)
    useRosterStore.getState().setRoster('a', roster)
    useRosterStore.getState().setRoster('b', entry('legionaries'))
    const tokens = buildMatchTokens().filter(token => token.side === 'a')
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens.every(token => token.teamWargearIds?.join(',') === 'plague_bell,plague_ammo')).toBe(true)
    roster.selectedWargearIds = ['plague_bell', 'plague_bell']
    expect(evaluateLegality({ pack: pack('plague_marines'), ...roster }).checks.find(check => check.key === 'faction-wargear')?.status).toBe('warn')
    roster.selectedWargearIds = ['unknown']
    expect(evaluateLegality({ pack: pack('plague_marines'), ...roster }).legal).toBe(false)
  })
})
