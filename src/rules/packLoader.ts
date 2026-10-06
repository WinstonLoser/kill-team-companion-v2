import Ajv, { type ErrorObject } from 'ajv'
import schema from './schema/faction-pack.schema.json'
import { SUPPORTED_RULESET_VERSIONS } from './version'
import type { FactionPack } from './types'

export interface PackValidationIssue {
  path: string
  message: string
}

export class PackValidationError extends Error {
  issues: PackValidationIssue[]
  constructor(issues: PackValidationIssue[]) {
    super(`pack validation failed: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`)
    this.name = 'PackValidationError'
    this.issues = issues
  }
}

export class RulesetVersionMismatchError extends Error {
  packVersion: string
  constructor(packVersion: string) {
    super(
      `rulesetVersion mismatch: pack is '${packVersion}', engine supports ${SUPPORTED_RULESET_VERSIONS.join(', ')}`,
    )
    this.name = 'RulesetVersionMismatchError'
    this.packVersion = packVersion
  }
}

const ajv = new Ajv({ allErrors: true })
const validate = ajv.compile(schema)

function toIssues(errors: ErrorObject[] | null | undefined): PackValidationIssue[] {
  if (!errors) return []
  return errors.map((e) => {
    const allowed = (e.params as { allowedValues?: string[] } | undefined)?.allowedValues
    const message = allowed?.length ? `${e.message ?? 'invalid'} (允许: ${allowed.join('/')})` : e.message ?? 'invalid'
    return { path: e.instancePath || '/', message }
  })
}

/** 加载并校验 faction pack。结构非法或版本不符 → 抛错，绝不静默降级（NFR-5）。 */
export function loadPack(raw: unknown): FactionPack {
  // 1. 结构校验（Ajv）
  if (!validate(raw)) {
    throw new PackValidationError(toIssues(validate.errors))
  }
  const pack = raw as unknown as FactionPack

  // 2. effect 四问二次断言（即便 schema 漏标也兜底拒绝）
  const issues: PackValidationIssue[] = []
  pack.effects.forEach((e, i) => {
    const base = `/effects/${i}`
    if (!e.trigger?.point) issues.push({ path: `${base}/trigger/point`, message: 'missing' })
    if (!e.pipelineStep) issues.push({ path: `${base}/pipelineStep`, message: 'missing' })
    if (!e.modifier?.kind) issues.push({ path: `${base}/modifier/kind`, message: 'missing' })
    if (!e.stacking?.policy) issues.push({ path: `${base}/stacking/policy`, message: 'missing' })
  })
  if (issues.length > 0) throw new PackValidationError(issues)

  // 3. ID 唯一性 + 引用完整性（阶段A护栏：坏包必须在此失败，绝不静默降级）
  const issues2: PackValidationIssue[] = []

  const dupCheck = (ids: (string | undefined)[], label: string) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (id === undefined) continue
      if (seen.has(id)) issues2.push({ path: '/', message: `duplicate ${label}: ${id}` })
      seen.add(id)
    }
  }
  dupCheck(pack.operatives.map((o) => o.operativeId), 'operativeId')
  dupCheck(pack.weapons.map((w) => w.weaponId), 'weaponId')
  dupCheck(pack.effects.map((e) => e.effectId), 'effectId')
  dupCheck((pack.abilities ?? []).map((a) => a.abilityId), 'abilityId')
  dupCheck((pack.factionRules ?? []).map((r) => r.ruleId), 'ruleId')
  dupCheck((pack.stratagems ?? []).map((s) => s.id), 'stratagem id')
  dupCheck((pack.wargear ?? []).map((w) => w.id), 'wargear id')

  const weaponIds = new Set(pack.weapons.map((w) => w.weaponId))
  const abilityIds = new Set((pack.abilities ?? []).map((a) => a.abilityId))
  const ruleIds = new Set((pack.factionRules ?? []).map((r) => r.ruleId))

  pack.operatives.forEach((op, oi) => {
    const base = `/operatives/${oi}`
    op.loadouts.forEach((slot, si) => {
      slot.options.forEach((opt, oi2) => {
        opt.forEach((wid) => {
          if (!weaponIds.has(wid)) issues2.push({ path: `${base}/loadouts/${si}/options/${oi2}`, message: `未解析的武器引用: ${wid}` })
        })
      })
    })
    for (const ref of op.abilityRefs ?? []) {
      if (!abilityIds.has(ref)) issues2.push({ path: `${base}/abilityRefs`, message: `未解析的能力引用: ${ref}` })
    }
    for (const ref of op.factionRuleRefs ?? []) {
      if (!ruleIds.has(ref)) issues2.push({ path: `${base}/factionRuleRefs`, message: `未解析的阵营规则引用: ${ref}` })
    }
  })

  const selector = pack.faction.subFactionSelector
  if (selector) {
    const effectIds = new Set(pack.effects.map((e) => e.effectId))
    for (const opt of selector.options) {
      if (!effectIds.has(opt) && !ruleIds.has(opt)) {
        issues2.push({ path: '/faction/subFactionSelector/options', message: `未解析的选择器选项: ${opt}` })
      }
    }
  }
  if (issues2.length > 0) throw new PackValidationError(issues2)

  // 4. 规则集版本兼容（D-23：仅 kt-lite-1.0）
  if (!(SUPPORTED_RULESET_VERSIONS as readonly string[]).includes(pack.rulesetVersion)) {
    throw new RulesetVersionMismatchError(pack.rulesetVersion)
  }

  return pack
}
