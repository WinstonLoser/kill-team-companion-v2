import { type Locale } from '../state/localeStore'

const dict: Record<string, string> = {
  // Weapon Rules
  "Brutal": "残暴",
  "Severe": "严重",
  "Shock": "震荡",
  "Stun": "眩晕",
  "Saturate": "饱和",
  "Poison": "毒素",
  "Toxic": "剧毒",
  "Rending": "撕裂",
  "Ceaseless": "无休",
  "Punishing": "惩戒",
  "Siphon Life": "生命虹吸",
  "PSYCHIC": "灵能",
  "MELEE": "近战",
  "BOLT": "爆矢",
  "Silent": "无声",
  "Seek Light": "寻光",
  
  // Keywords
  "ANGEL OF DEATH": "死亡天使",
  "IMPERIUM": "帝国",
  "ADEPTUS ASTARTES": "阿斯塔特修会",
  "LEADER": "领袖",
  "SPACE MARINE CAPTAIN": "星际战士连长",
  "ASSAULT INTERCESSOR": "突击仲裁者",
  "SERGEANT": "军士",
  "INTERCESSOR": "仲裁者",
  "GRENADIER": "掷弹兵",
  "WARRIOR": "战士",
  "HEAVY INTERCESSOR": "重装仲裁者",
  "GUNNER": "枪手",
  "ELIMINATOR": "清除者",
  "SNIPER": "狙击手",
  "LEGIONARY": "军团",
  "CHAOS": "混沌",
  "HERETIC ASTARTES": "异端阿斯塔特",
  "CHOSEN": "神选者",
  "ASPIRING CHAMPION": "寻猎勇士",
  "ANOINTED": "受选者",
  "BALEFIRE ACOLYTE": "邪火使徒",
  "BUTCHER": "屠夫",
  "HEAVY GUNNER": "重炮手",
  "ICON BEARER": "持徽手",
  "SHRIVETALON": "隐爪",
  "PLAGUE MARINE": "瘟疫战士",
  "CHAMPION": "勇士",
  "MALIGNANT PLAGUECASTER": "恶瘟投放者"
}

/**
 * Parses bilingual strings formatted like "English text / 中文文本".
 * @param text The input string which might contain a bilingual delimiter.
 * @param locale The current active locale.
 * @returns The translated string.
 */
export function t(text: string, locale: Locale): string {
  if (!text) return text;
  
  if (locale === 'zh') {
    // Exact match for predefined keywords/rules
    if (dict[text]) return dict[text];
    
    // Pattern matching for parameterized rules
    if (text.startsWith("Lethal ")) return text.replace("Lethal ", "致命 ");
    if (text.startsWith("Piercing Crits ")) return text.replace("Piercing Crits ", "穿甲暴击 ");
    if (text.startsWith("Piercing ")) return text.replace("Piercing ", "穿甲 ");
    if (text.startsWith("Torrent ")) return text.replace("Torrent ", "倾泻 ");
    if (text.startsWith("Blast ")) return text.replace("Blast ", "爆炸 ");
    if (text.startsWith("Devastating ")) return text.replace("Devastating ", "毁灭 ");
    if (text.startsWith("Accurate ")) return text.replace("Accurate ", "精准 ");
    if (text.includes("Heavy (Dash only)")) return text.replace("Heavy (Dash only)", "重型 (仅冲刺)");
    if (text.includes("Heavy (Reposition only)")) return text.replace("Heavy (Reposition only)", "重型 (仅重新部署)");
    if (text.includes("Hot")) return text.replace("Hot", "过热");
    if (text.includes('1" Devastating 1')) return '1" 毁灭 1';
  }

  const parts = text.split(' / ');
  if (parts.length < 2) return text; // Not bilingual format
  
  if (locale === 'en') {
    return parts[0].trim();
  } else {
    return parts[parts.length - 1].trim();
  }
}
