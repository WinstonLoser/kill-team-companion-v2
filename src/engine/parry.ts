// 共用格挡原语（P4 统一：射击 PARRY_ALLOCATE 与近战交替结算共用，DN3）。
// KT 格挡矩阵：1 关键抵 1 关键或 1 普通；2 普通抵 1 关键；1 普通抵 1 普通。

/** 成功池（普通 / 关键）。 */
export interface Pool {
  normal: number
  critical: number
}

export interface ParryAllocation {
  /** 被格挡方剩余（未抵消 → 出击池） */
  survivor: Pool
  /** 格挡方为格挡消耗的骰（不再出击，修 P3 对称双重计数） */
  used: Pool
  /** 子决策日志（每次取消一条），供交替结算留痕 */
  log: string[]
}

/** 逐类相减（消耗后剩余池）。 */
export function subtractPool(a: Pool, b: Pool): Pool {
  return { normal: a.normal - b.normal, critical: a.critical - b.critical }
}

/**
 * 格挡方(parrier)消耗己骰抵消目标方(target)的成功，按矩阵顺序：
 * 关键抵关键 → 2普通抵关键 → 关键抵普通 → 普通抵普通。
 * 返回 target 未抵消剩余（survivor）与 parrier 消耗（used）+ 子决策日志。
 */
export function parryAllocation(parrier: Pool, target: Pool): ParryAllocation {
  let tN = target.normal
  let tC = target.critical
  let pN = parrier.normal
  let pC = parrier.critical
  let uN = 0
  let uC = 0
  const log: string[] = []

  // 1 关键抵关键
  while (tC > 0 && pC >= 1) {
    tC--
    pC--
    uC++
    log.push('关键抵关键')
  }
  // 2 普通抵关键
  while (tC > 0 && pN >= 2) {
    tC--
    pN -= 2
    uN += 2
    log.push('2普通抵关键')
  }
  // 关键抵普通
  while (tN > 0 && pC >= 1) {
    tN--
    pC--
    uC++
    log.push('关键抵普通')
  }
  // 普通抵普通
  while (tN > 0 && pN >= 1) {
    tN--
    pN--
    uN++
    log.push('普通抵普通')
  }

  return { survivor: { normal: tN, critical: tC }, used: { normal: uN, critical: uC }, log }
}
