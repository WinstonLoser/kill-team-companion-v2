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

export function ruleZh(rule: string): string {
  return WEAPON_RULE_ZH[rule] ?? rule
}

/** 武器一行式属性：4攻3+ 3/4 12" 平衡/重型。 */
export function fmtWeapon(w: FactionPack['weapons'][0]): string {
  const p = w.profile
  return `${p.attacks}攻${p.hit}+ ${p.normalDamage}/${p.criticalDamage}${p.range != null ? ` ${p.range}"` : ''}${p.weaponRules.length ? ` ${p.weaponRules.map(ruleZh).join('/')}` : ''}`
}
