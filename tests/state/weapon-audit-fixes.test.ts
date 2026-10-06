import { beforeEach, describe, expect, it } from 'vitest'
import { ALL_PACKS } from '../../src/data/packs'
import { useMatchStore, type MatchToken } from '../../src/state/matchStore'
import { chooseLoadoutByKind, legalLoadoutBundles } from '../../src/ui/roster/OperativePicker'
import { getWeaponRuleDescription } from '../../src/data/universalWeaponRules'
import { playerRulingRules, ruleZh } from '../../src/ui/weaponDisplay'
import { createInitialTurnState, turnReducer } from '../../src/state/turnStateMachine'

const pack = (id: string) => ALL_PACKS.find(item => item.faction.id === id)!
const op = (faction: string, id: string) => pack(faction).operatives.find(item => item.operativeId === id)!
const weapon = (faction: string, id: string) => pack(faction).weapons.find(item => item.weaponId === id)!

describe('武器配置审计修正', () => {
  it('赦罪之爪手枪有撕裂，其他军团兵普通手枪不受影响', () => {
    expect(legalLoadoutBundles(op('legionaries', 'shrivetalon'))[0]).toContain('shrivetalon_bolt_pistol')
    expect(weapon('legionaries', 'shrivetalon_bolt_pistol').profile.weaponRules).toContain('Rending')
    expect(weapon('legionaries', 'bolt_pistol').profile.weaponRules).not.toContain('Rending')
  })

  it('瘟疫士兵同时携带两把远程武器，小刀固定，剧毒只属于士兵爆矢枪', () => {
    expect(legalLoadoutBundles(op('plague_marines', 'warrior'))).toEqual([['warrior_boltgun', 'bolt_pistol', 'plague_knife_melee']])
    expect(weapon('plague_marines', 'warrior_boltgun').profile.weaponRules).toContain('Toxic')
    expect(weapon('plague_marines', 'boltgun').profile.weaponRules).not.toContain('Toxic')
  })

  it('其他阵营引导选择保留固定携带项，并自动切换跨远程近战的套装', () => {
    const gunner = op('legionaries', 'gunner')
    expect(chooseLoadoutByKind(pack('legionaries'), gunner, gunner.loadouts[0]!.options[0]!, 'RANGED', ['bolt_pistol', 'plasma_gun_std', 'plasma_gun_sup']))
      .toEqual(['bolt_pistol', 'plasma_gun_std', 'plasma_gun_sup', 'fists'])

    const sorcerer = op('warpcoven', 'wc_sorcerer_destiny')
    const current = legalLoadoutBundles(sorcerer)[0]!
    expect(chooseLoadoutByKind(pack('warpcoven'), sorcerer, current, 'RANGED', ['wc_doombolt']))
      .toEqual(['wc_force_stave', 'wc_doombolt', 'wc_prosperine_khopesh'])
  })

  it('重型、过热与穿刺的帮助文案与本地规则一致', () => {
    expect(getWeaponRuleDescription('Heavy (Dash only)', 'zh')).toContain('仅可执行冲刺')
    expect(getWeaponRuleDescription('Heavy (Reposition only)', 'zh')).toContain('仅可执行转移')
    expect(getWeaponRuleDescription('Hot', 'zh')).toContain('掷一枚 D6')
    expect(getWeaponRuleDescription('Piercing 1', 'zh')).toContain('防御骰数量减少')
    expect(getWeaponRuleDescription('Shock', 'zh')).toContain('首次使用关键成功出击')
    expect(ruleZh('Torrent 2"')).toBe('洪流 2″')
    expect(playerRulingRules(['Piercing 1', 'Heavy (Dash only)', 'Torrent 2"', 'Hot']))
      .toEqual(['洪流 2″', '过热'])
  })
})

beforeEach(() => useMatchStore.getState().reset())

describe('无射程限制的远程武器', () => {
  const token = (uid: string, side: 'a' | 'b', x: number, weapons: string[]): MatchToken => ({
    uid, side, factionId: 'plague_marines', opId: 'warrior', name: uid,
    pos: { x, y: 1 }, facing: 0, baseRadius: 0.5, wounds: 14, maxWounds: 14,
    markers: [], alive: true, placed: true, order: 'ENGAGE', weapons, selections: [],
  })

  it('15″ 外可用爆矢枪射击，不能用 8″ 爆矢手枪射击', () => {
    const s = useMatchStore.getState()
    s.startBlank({ w: 30, h: 22 })
    useMatchStore.setState({ tokens: [token('a1', 'a', 1, ['warrior_boltgun', 'bolt_pistol', 'plague_knife_melee']), token('b1', 'b', 16, ['warrior_boltgun', 'bolt_pistol', 'plague_knife_melee'])] })
    expect(useMatchStore.getState().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).ok).toBe(true)
    useMatchStore.getState().setCombatWeapon('a1', 'RANGED', 'bolt_pistol')
    expect(useMatchStore.getState().checkAttackLegality({ attackerUid: 'a1', targetUid: 'b1', kind: 'SHOOT' }).missing).toContain('超出射程')
  })
})

describe('重型武器的移动限制', () => {
  const ready = (weaponId: string, factionId = 'angels_of_death', opId = 'intercessor_sergeant') => {
    const equipped = pack(factionId).weapons.find(item => item.weaponId === weaponId)!
    const token: MatchToken = {
      uid: 'a1', side: 'a', factionId, opId, name: '测试特工', pos: { x: 1, y: 1 }, facing: 0,
      baseRadius: 0.5, wounds: 14, maxWounds: 14, markers: [], alive: true, placed: true,
      order: 'ENGAGE', weapons: [equipped.weaponId], chosenWeapons: { RANGED: equipped.weaponId },
    }
    const turn = turnReducer(createInitialTurnState(), { type: 'ACTIVATE', opId: 'a1', player: 'a' })
    useMatchStore.setState({ phase: 'play', maplessMode: true, tokens: [token], turn })
  }

  it('仅可冲刺：先转移后不能射击，射击后也不能转移', () => {
    ready('stalker_bolt_rifle_heavy')
    expect(useMatchStore.getState().doAction('a1', 'MOVE').ok).toBe(true)
    expect(useMatchStore.getState().checkAction('a1', 'SHOOT').ok).toBe(false)
    useMatchStore.getState().undoAction()
    expect(useMatchStore.getState().doAction('a1', 'SHOOT').ok).toBe(true)
    expect(useMatchStore.getState().checkAction('a1', 'MOVE').ok).toBe(false)
    expect(useMatchStore.getState().checkAction('a1', 'DASH').ok).toBe(true)
  })

  it('仅可转移：射击后可转移但不可冲刺', () => {
    ready('heavy_bolter_focused', 'legionaries', 'heavy_gunner')
    expect(useMatchStore.getState().doAction('a1', 'SHOOT').ok).toBe(true)
    expect(useMatchStore.getState().checkAction('a1', 'MOVE').ok).toBe(true)
    expect(useMatchStore.getState().checkAction('a1', 'DASH').ok).toBe(false)
  })
})
