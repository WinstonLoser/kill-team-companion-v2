// 规则集版本（D-23：v1 仅 KT Lite 单一规则集）
export const SUPPORTED_RULESET_VERSIONS = ['kt-lite-1.0'] as const
export type SupportedRulesetVersion = (typeof SUPPORTED_RULESET_VERSIONS)[number]
