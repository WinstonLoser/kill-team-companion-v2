import { Locale } from '../state/localeStore';

export const getWeaponRuleDescription = (ruleString: string, locale: Locale): string => {
  // Strip numbers and measurements for lookup, e.g. "Piercing 1" -> "Piercing", "Torrent 1\"" -> "Torrent", "Lethal 5+" -> "Lethal"
  let baseRule = ruleString.replace(/\s*\d+\+?\"?.*$/, '').trim();
  
  // Specific fallbacks for exceptions
  if (ruleString.includes('Heavy')) {
     baseRule = 'Heavy';
  } else if (ruleString.includes('Devastating')) {
     baseRule = 'Devastating';
  } else if (ruleString.includes('Blast')) {
     baseRule = 'Blast';
  }

  const descEN = ruleDescriptionsEN[baseRule] || "This rule does not have a description yet.";
  const descZH = ruleDescriptionsZH[baseRule] || "此规则暂无说明。";

  return locale === 'zh' ? descZH : descEN;
}

const ruleDescriptionsEN: Record<string, string> = {
  "Piercing": "In the Roll Attack Dice step, if you retain any critical hits, the target's Defence dice suffer the Piercing effect (discarding successful saves).",
  "Piercing Crits": "In the Roll Attack Dice step, if you retain any critical hits, the target's Defence dice suffer the Piercing effect, but only applies to critical hits.",
  "Lethal": "In the Roll Attack Dice step, if a die result equals or beats the Lethal value, it is a critical hit.",
  "Torrent": "Each time this operative shoots, if it makes a shooting attack with this weapon, it can make a shooting attack with this weapon against each other valid target within the Torrent distance.",
  "Blast": "Each time this operative shoots, if it makes a shooting attack with this weapon, it can make a shooting attack with this weapon against each other valid target within the Blast distance.",
  "Heavy": "This operative cannot perform a Dash action in the same Turning Point as it makes a shooting attack with this weapon.",
  "Brutal": "In the Roll Attack Dice step, your opponent can only retain critical hits as successful normal saves.",
  "Devastating": "Each time you retain a critical hit with this weapon, inflict the Devastating damage on the target.",
  "Accurate": "You can retain a number of attack dice as successful normal hits without rolling them.",
  "Hot": "If you retain more failed hits than successful hits, this operative suffers 3 mortal wounds.",
  "Silent": "This operative can make a shooting attack with this weapon while it has a Conceal order.",
  "Saturate": "Your opponent cannot retain cover saves.",
  "Seek Light": "This weapon targets enemies in cover more effectively.",
  "Shock": "In the Roll Attack Dice step, the target loses one normal hit for each critical hit you retain.",
  "Stun": "The target subtracts 1 from its APL."
};

const ruleDescriptionsZH: Record<string, string> = {
  "Piercing": "在投掷攻击骰步骤中，如果你保留了任何暴击命中，目标的防御骰将受到穿甲效果影响（废弃其成功的防御骰）。",
  "Piercing Crits": "在投掷攻击骰步骤中，如果你保留了暴击命中，目标的防御骰将受到穿甲效果影响，但仅限于暴击命中生效。",
  "Lethal": "在投掷攻击骰步骤中，如果骰子结果大于或等于该致命数值，即视为暴击命中。",
  "Torrent": "每次该特工射击时，如果使用此武器进行射击攻击，它可以对倾泻距离内的每一个其他合法目标使用此武器进行一次射击攻击。",
  "Blast": "每次该特工射击时，如果使用此武器进行射击攻击，它可以对爆炸距离内的每一个其他合法目标使用此武器进行一次射击攻击。",
  "Heavy": "该特工在使用此武器进行射击攻击的同一回合内，不能执行冲刺（Dash/Reposition）等移动行动。",
  "Brutal": "在投掷攻击骰步骤中，你的对手只能将暴击命中保留为成功的普通豁免。",
  "Devastating": "每次你使用此武器保留一个暴击命中时，都会立刻对目标造成该毁灭数值的致命损伤。",
  "Accurate": "你可以直接保留一定数量的攻击骰作为成功的普通命中，而无需投掷。",
  "Hot": "如果你保留的失败命中多于成功命中，该特工将承受 3 点致命损伤（Mortal Wounds）。",
  "Silent": "该特工可以在具有隐蔽（Conceal）指令的状态下使用此武器进行射击攻击。",
  "Saturate": "你的对手不能保留掩体豁免（Cover Saves）。",
  "Seek Light": "此武器能更有效地打击处于掩体中的敌人。",
  "Shock": "在投掷攻击骰步骤中，你每保留一个暴击命中，目标就会失去一个普通命中。",
  "Stun": "目标的 APL 减 1。"
};
