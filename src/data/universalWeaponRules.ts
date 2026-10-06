import { Locale } from '../state/localeStore';

export const getWeaponRuleDescription = (ruleString: string, locale: Locale): string => {
  if (/^Heavy/i.test(ruleString)) {
    const allowed = /Dash only/i.test(ruleString) ? (locale === 'zh' ? '冲刺' : 'Dash') : /Reposition only/i.test(ruleString) ? (locale === 'zh' ? '转移' : 'Reposition') : null
    return locale === 'zh'
      ? `使用该武器的同一次激活或反应中${allowed ? `仅可执行${allowed}，不能执行其他移动行动` : '不能执行移动行动'}；移动与射击的先后顺序均受此限制。`
      : `During the same activation or counteraction as this weapon is used, ${allowed ? `only ${allowed} movement is allowed` : 'movement is not allowed'}, before or after shooting.`
  }
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

  const key = Object.keys(ruleDescriptionsEN).find(k => k.toLowerCase() === baseRule.toLowerCase()) ?? baseRule;
  const descEN = ruleDescriptionsEN[key] || "This rule does not have a description yet.";
  const descZH = ruleDescriptionsZH[key] || "此规则暂无说明。";

  return locale === 'zh' ? descZH : descEN;
}

const ruleDescriptionsEN: Record<string, string> = {
  "Piercing": "Reduce the number of Defence dice rolled by the stated value.",
  "Piercing Crits": "If any critical attack success is retained, reduce the number of Defence dice rolled by the stated value.",
  "Lethal": "In the Roll Attack Dice step, if a die result equals or beats the Lethal value, it is a critical hit.",
  "Torrent": "After choosing a primary target, you may shoot any number of other valid targets within the stated distance of it. Resolve each target separately.",
  "Blast": "After shooting the primary target, shoot every secondary target within the stated distance and visible to it. Resolve each target separately.",
  "Brutal": "In melee, the opponent can only parry with critical successes.",
  "Devastating": "Each time you retain a critical hit with this weapon, inflict the Devastating damage on the target.",
  "Accurate": "You can retain a number of attack dice as successful normal hits without rolling them.",
  "Hot": "After using this weapon, roll one D6. If it is lower than the weapon's Hit value, this operative suffers twice the result in damage. Roll once even if the weapon attacked several targets.",
  "Silent": "This operative can make a shooting attack with this weapon while it has a Conceal order.",
  "Saturate": "Your opponent cannot retain cover saves.",
  "Seek Light": "Light terrain cannot prevent a visible operative in cover from being selected as a target; this does not remove its cover save.",
  "Shock": "In melee, the first time you strike with a critical success, discard one unspent normal success from the opponent, or one critical if none remain.",
  "Stun": "If any critical success is retained, the target's APL is reduced by 1 until the end of its next activation.",
  "Severe": "If no critical success is retained, upgrade one normal success to a critical success.",
  "Rending": "If any critical success is retained, upgrade one normal success to a critical success.",
  "Ceaseless": "Choose one dice result and reroll every attack die showing that result.",
  "Balanced": "Reroll one attack die.",
  "Punishing": "If any critical success is retained, retain one failed attack die as a normal success.",
  "Psychic": "This is a psychic weapon; other psychic rules may affect its use.",
  "Poison": "Apply the faction's poison marker rule when this attack deals damage.",
  "Toxic": "Both damage values increase by 1 against an enemy carrying your poison marker.",
  "Shield": "Choosing this weapon changes Save to 4+; each parry with it can discard two unspent successes.",
  "Siphon Life": "When selected, choose a visible friendly Legionary within 6 inches. Damage dealt by this weapon can heal it, subject to the once-per-turning-point limit.",
  "Immolate Sanity": "A damaging critical success places an Immolate Sanity marker on the target, worsening its weapon Hit value by 1 until the specified expiry."
};

const ruleDescriptionsZH: Record<string, string> = {
  "Piercing": "防御方投掷的防御骰数量减少指定数值。",
  "Piercing Crits": "若保留了至少一次关键成功，防御方投掷的防御骰数量减少指定数值。",
  "Lethal": "在投掷攻击骰步骤中，如果骰子结果大于或等于该致命数值，即视为暴击命中。",
  "Torrent": "选定主要目标后，可对其指定距离内任意数量的其他有效目标分别射击。",
  "Blast": "射击主要目标后，须对其指定距离内且对其可见的每个次要目标分别射击。",
  "Brutal": "近战时，对手只能用关键成功格挡。",
  "Devastating": "每次你使用此武器保留一个暴击命中时，都会立刻对目标造成该毁灭数值的致命损伤。",
  "Accurate": "你可以直接保留一定数量的攻击骰作为成功的普通命中，而无需投掷。",
  "Hot": "使用本武器后掷一枚 D6；若结果低于武器命中值，该特工受到骰面结果两倍的伤害。一次行动攻击多个目标也只掷一次。",
  "Silent": "该特工可以在具有隐蔽（Conceal）指令的状态下使用此武器进行射击攻击。",
  "Saturate": "你的对手不能保留掩体豁免（Cover Saves）。",
  "Seek Light": "选择有效目标时，轻型地形不能使可见目标免于被选中；目标仍可保留掩护豁免。",
  "Shock": "近战中首次使用关键成功出击时，舍弃对手一次未结算的普通成功；没有普通成功则舍弃一次关键成功。",
  "Stun": "若保留了关键成功，目标 APL 减 1，持续至其下一次激活结束。",
  "Severe": "若没有保留关键成功，可将一次普通成功升级为关键成功。",
  "Rending": "若保留了关键成功，可将一次普通成功升级为关键成功。",
  "Ceaseless": "选择一个骰面结果，重掷所有显示该结果的攻击骰。",
  "Balanced": "可重掷一枚攻击骰。",
  "Punishing": "若保留了关键成功，可将一枚失败攻击骰保留为普通成功。",
  "Psychic": "灵能武器；使用时仍需遵守相关灵能规则。",
  "Poison": "本次攻击造成伤害后，按阵营毒素规则施加标识。",
  "Toxic": "攻击拥有己方毒素标识的敌方目标时，普通和关键伤害各增加 1。",
  "Shield": "选择此武器时豁免变为 4+；用其格挡时每次可抵挡两个未结算成功。",
  "Siphon Life": "选择本武器时可指定 6″ 内可见的己方军团特工；本武器造成伤害时可治疗它，每转折点限用一次。",
  "Immolate Sanity": "造成伤害的关键成功会给目标放置焚却理智标识，使其武器命中值恶化 1，直至规则指定的结束时点。"
};
