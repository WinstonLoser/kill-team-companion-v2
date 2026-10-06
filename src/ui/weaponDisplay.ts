import type { FactionPack } from '../rules'

/** 武器规则英文 → 中文（展示用，UI 共享）。 */
export const WEAPON_RULE_ZH: Record<string, string> = {
  PISTOL: '手枪', TORRENT: '洪流', PIERCING1: '穿刺1', PIERCING: '穿刺',
  CONCEAL: '集中', OVERHEAT: '过热', LETHAL5: '致命5+', HEAVY: '重型',
  BLAST1: '爆炸1"', BLAST2: '爆炸2"', DEVASTATING: '严重', DEVASTATING3: '毁灭3',
  SILENT: '安静', BRUTAL: '残暴', STUN: '震荡', CONCUSSIVE: '眩晕',
  RAPID_FIRE: '撕裂', TOXIN: '毒素', VIRULENT: '剧毒', RELENTLESS: '无休',
  SEEKING_LIGHT: '追踪轻型', BALANCED: '平衡', HIT: '重击', PSYCHIC: '灵能',
}

const PROFILE_RULE_ZH: Record<string, string> = {
  'Piercing': '穿刺', 'Piercing Crits': '关键穿刺', 'Lethal': '致命',
  'Torrent': '洪流', 'Blast': '爆炸', 'Devastating': '毁灭',
  'Brutal': '残暴', 'Hot': '过热', 'Silent': '安静', 'Saturate': '集中',
  'Seek Light': '追踪轻型', 'Shock': '震荡', 'Stun': '眩晕',
  'Severe': '严重', 'Rending': '撕裂', 'Ceaseless': '无休',
  'Balanced': '平衡', 'Punishing': '重击', 'Psychic': '灵能',
  'Poison': '毒素', 'Toxic': '剧毒', 'Shield': '盾牌',
  'Siphon Life': '吸魂', 'Immolate Sanity': '焚却理智',
}

export function ruleZh(rule: string): string {
  if (WEAPON_RULE_ZH[rule]) return WEAPON_RULE_ZH[rule]
  if (/^Heavy/i.test(rule)) {
    if (/Dash only/i.test(rule)) return '重型（仅可冲刺）'
    if (/Reposition only/i.test(rule)) return '重型（仅可转移）'
    return '重型'
  }
  const areaDevastating = rule.match(/^(\d+)"\s+Devastating\s+(\d+)$/i)
  if (areaDevastating) return `${areaDevastating[1]}″ 毁灭 ${areaDevastating[2]}`
  const match = rule.match(/^(.+?)(?:\s+(\d+(?:\+|")))?$/)
  const name = Object.keys(PROFILE_RULE_ZH).find(key => key.toLowerCase() === match?.[1]?.toLowerCase())
  return name ? `${PROFILE_RULE_ZH[name]}${match?.[2] ? ` ${match[2]!.replace('"', '″')}` : ''}` : rule
}

/** 仅列出当前战斗结算未完整自动处理的武器规则，避免把卡面展示误当成已裁定。 */
export function playerRulingRules(rules: string[]): string[] {
  return rules.filter(rule => {
    if (/^(Piercing(?: Crits)?|Lethal)\s+\d+/i.test(rule)) return false
    if (/^(Severe|Rending|Saturate|Silent|Poison|Toxic)$/i.test(rule)) return false
    if (/^Heavy(?:\s|$)/i.test(rule)) return false
    if (/^Devastating\s+\d+/i.test(rule)) return false
    return true
  }).map(ruleZh)
}

/** 武器一行式属性：4攻3+ 3/4 12" 平衡/重型。 */
export function fmtWeapon(w: FactionPack['weapons'][0]): string {
  const p = w.profile
  return `${p.attacks}攻${p.hit}+ ${p.normalDamage}/${p.criticalDamage}${p.range != null ? ` ${p.range}"` : ''}${p.weaponRules.length ? ` ${p.weaponRules.map(ruleZh).join('/')}` : ''}`
}
