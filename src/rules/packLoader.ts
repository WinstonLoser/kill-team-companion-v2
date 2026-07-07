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

  // 3. 规则集版本兼容（D-23：仅 kt-lite-1.0）
  if (!(SUPPORTED_RULESET_VERSIONS as readonly string[]).includes(pack.rulesetVersion)) {
    throw new RulesetVersionMismatchError(pack.rulesetVersion)
  }

  return pack
}
