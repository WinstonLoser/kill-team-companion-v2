import { useState, useEffect } from 'react'
import { loadPack, type FactionPack, type Effect, type Weapon } from '../..'
import angelsPack from '../../data/packs/angels_of_death.v1.json'
import legionariesPack from '../../data/packs/legionaries.v1.json'
import plaguePack from '../../data/packs/plague_marines.v1.json'
import chaosCultPack from '../../data/packs/chaos_cult.v1.json'

const ALL_PACKS: FactionPack[] = [
  loadPack(angelsPack as any),
  loadPack(legionariesPack as any),
  loadPack(plaguePack as any),
  loadPack(chaosCultPack as any)
]

// 1.17 T3/T4：规则查询（参数化要点，不显示 GW 原文 D-29）。
// 引擎接入 + UI 抽为 RulesSearch，供顶栏规则视图与对局浮层共用（P10 统一）。

export interface RulesQueryCtrl {
  node: { hint: string } | null
  open: (hint: string) => void
  close: () => void
}

export function useRulesQuery(): RulesQueryCtrl {
  const [node, setNode] = useState<{ hint: string } | null>(null)
  return { node, open: (hint) => setNode({ hint }), close: () => setNode(null) }
}

interface EffectHit { kind: 'effect'; e: Effect }
interface WeaponHit { kind: 'weapon'; w: Weapon }
type Hit = EffectHit | WeaponHit

export function searchRules(q: string): Hit[] {
  const k = q.trim().toLowerCase()
  if (!k) return []
  const hits: Hit[] = []
  for (const pack of ALL_PACKS) {
    for (const e of pack.effects) {
      if (`${e.effectId} ${e.label} ${e.modifier.kind} ${e.trigger.point} ${e.pipelineStep} ${e.source}`.toLowerCase().includes(k)) {
        if (!hits.some(h => h.kind === 'effect' && h.e.effectId === e.effectId)) hits.push({ kind: 'effect', e })
      }
    }
    for (const w of pack.weapons) {
      if (`${w.weaponId} ${w.name} ${w.kind} ${w.keywords.join(' ')}`.toLowerCase().includes(k)) {
        if (!hits.some(h => h.kind === 'weapon' && h.w.weaponId === w.weaponId)) hits.push({ kind: 'weapon', w })
      }
    }
  }
  return hits.slice(0, 12)
}

/** 共用搜索 UI（顶栏规则视图内联用；浮层包一层 backdrop）。 */
export function RulesSearch({ initialQuery }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery ?? '')
  useEffect(() => { if (initialQuery !== undefined) setQ(initialQuery) }, [initialQuery])
  const hits = searchRules(q)
  return (
    <>
      <input className="rq-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索 effect / 武器 / 触发步骤 / 关键词…" autoFocus />
      <ul className="rq-list">
        {hits.length === 0 && <li className="muted">无匹配（显示引擎参数化要点，不含 GW 原文 D-29）</li>}
        {hits.map((h) =>
          h.kind === 'effect' ? (
            <li key={h.e.effectId} className="rq-item">
              <strong>{h.e.label}</strong>
              <div className="muted rq-fields">
                effectId: {h.e.effectId} · 触发 {h.e.trigger.point} · 步骤 {h.e.pipelineStep}<br />
                modifier: {h.e.modifier.kind} · 叠加 {h.e.stacking.policy}
                {h.e.stacking.groupKeys?.length ? ` · 组 ${h.e.stacking.groupKeys.join('/')}` : ''}
              </div>
              {h.e.rulesRef && <div className="muted rq-src">来源: KT Lite §{h.e.rulesRef.section}（本地 docs/rules）</div>}
            </li>
          ) : (
            <li key={h.w.weaponId} className="rq-item">
              <strong>{h.w.name}</strong> <span className="muted">({h.w.kind})</span>
              <div className="muted rq-fields">
                攻击 {h.w.profile.attacks} · 命中 {h.w.profile.hit}+ · 普通伤 {h.w.profile.normalDamage} · 关键伤 {h.w.profile.criticalDamage}
                {h.w.profile.range != null ? ` · 射程 ${h.w.profile.range}"` : ''}<br />
                武器规则: {h.w.profile.weaponRules.join(', ') || '无'} · 关键词: {h.w.keywords.join(', ') || '无'}
              </div>
            </li>
          ),
        )}
      </ul>
    </>
  )
}

/** 对局内浮层（非全屏，可一键关）。 */
export function RulesQuery({ ctrl }: { ctrl: RulesQueryCtrl }) {
  if (!ctrl.node) return null
  return (
    <div className="overlay-backdrop" onClick={ctrl.close}>
      <div className="rules-query" onClick={(e) => e.stopPropagation()}>
        <div className="rq-head">
          <strong>规则查询</strong>
          <button className="intercept-close" onClick={ctrl.close}>✕</button>
        </div>
        <RulesSearch initialQuery={ctrl.node.hint} />
      </div>
    </div>
  )
}
