import { useState, useMemo } from 'react'
import { sandboxAbilityResolver } from '../../state/AbilityResolver'
import type { FactionPack, Stratagem, Operative } from '../../rules/types'
import { loadPack } from '../..'
import angelsPack from '../../data/packs/angels_of_death.v1.json'
import legionariesPack from '../../data/packs/legionaries.v1.json'
import plaguePack from '../../data/packs/plague_marines.v1.json'
import chaosCultPack from '../../data/packs/chaos_cult.v1.json'

import { CombatResolver, type CombatAction } from '../components/Combat/CombatResolver'
import { ActionBar } from '../match/ActionBar'
import type { ActionType, Order } from '../../state/turnStateMachine'

const TESTLAB_PACKS = [
  { id: 'angels_of_death', name: '死亡天使', pack: loadPack(angelsPack as any) },
  { id: 'legionaries', name: '军团兵', pack: loadPack(legionariesPack as any) },
  { id: 'plague_marines', name: '瘟疫战士', pack: loadPack(plaguePack as any) },
  { id: 'chaos_cult', name: '混沌教派', pack: loadPack(chaosCultPack as any) },
]

export function AbilityLab() {
  const [logs, setLogs] = useState<string[]>([...sandboxAbilityResolver.getLogs()])
  const [refresh, setRefresh] = useState(0)

  // Attacker state
  const [atkFactionId, setAtkFactionId] = useState<string>('angels_of_death')
  const [atkOpId, setAtkOpId] = useState<string>('')
  
  // Defender state
  const [defFactionId, setDefFactionId] = useState<string>('legionaries')
  const [defOpId, setDefOpId] = useState<string>('')

  // Mock Combat State
  const [showCombat, setShowCombat] = useState(false)
  const [rollMode, setRollMode] = useState<'AUTO' | 'MANUAL'>('AUTO')
  const [combatKind, setCombatKind] = useState<'SHOOT' | 'FIGHT'>('SHOOT')

  // Activation State
  const [activated, setActivated] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [apUsed, setApUsed] = useState(0)
  const [pendingMove, setPendingMove] = useState<ActionType | null>(null)
  const [pendingAttack, setPendingAttack] = useState<'SHOOT' | 'FIGHT' | null>(null)

  const atkPackWrapper = TESTLAB_PACKS.find(p => p.id === atkFactionId)
  const atkPack = atkPackWrapper?.pack
  const defPackWrapper = TESTLAB_PACKS.find(p => p.id === defFactionId)
  const defPack = defPackWrapper?.pack

  const atkOp = atkPack?.operatives.find(o => o.operativeId === atkOpId) || atkPack?.operatives[0]
  const defOp = defPack?.operatives.find(o => o.operativeId === defOpId) || defPack?.operatives[0]

  // Currently viewing ploys for... (assume attacker for the central command)
  const activeStratagems = atkPack?.stratagems || []

  const update = () => {
    setLogs([...sandboxAbilityResolver.getLogs()])
    setRefresh(r => r + 1)
  }

  const cp = sandboxAbilityResolver.getCP()
  const activePloys = sandboxAbilityResolver.getActivePloys()

  const handleActivatePloy = (ploy: Stratagem) => {
    sandboxAbilityResolver.activatePloy(ploy)
    update()
  }

  const handleActionActivated = (action: CombatAction) => {
    // If it's a FACTION ploy, deduct CP
    if (action.sourceType === 'FACTION') {
      sandboxAbilityResolver.activatePloy({ ...action, phase: 'ENGAGEMENT', useLimit: {} } as any)
    } else {
      // If OPERATIVE ability, deduct 0 CP and log
      sandboxAbilityResolver.useAbility(atkOp?.name || 'Unknown', action.name, 0)
    }
    update()
  }

  const buildCombatActions = (pack: FactionPack | undefined, op: Operative | undefined): CombatAction[] => {
    const actions: CombatAction[] = []
    
    // 1. Add Engagement Stratagems (FACTION)
    const ploys = pack?.stratagems?.filter(p => p.phase === 'ENGAGEMENT') || []
    ploys.forEach(p => {
      actions.push({ id: p.id, name: p.name, cp: p.cp, description: p.description ?? '', sourceType: 'FACTION' })
    })

    // 2. Add Operative Abilities (OPERATIVE)
    op?.abilities?.forEach(effectId => {
      const effect = pack?.effects?.find(a => a.effectId === effectId)
      if (effect) {
        actions.push({ id: effect.effectId, name: effect.label, cp: 0, description: effect.effectId, sourceType: 'OPERATIVE' })
      }
    })

    return actions
  }

  const handleUseAbility = (abilityName: string, ap: number) => {
    sandboxAbilityResolver.useAbility(atkOp?.name || 'Unknown', abilityName, ap)
    update()
  }

  const handleMockCombat = (kind: 'SHOOT' | 'FIGHT') => {
    setCombatKind(kind)
    sandboxAbilityResolver.onBeforeShoot(atkOp?.name || 'Alpha', defOp?.name || 'Beta')
    setShowCombat(true)
    update()
  }

  // ActionBar Handlers
  const handleActivate = () => {
    setActivated(true)
    setApUsed(0)
    setOrder('ENGAGED')
    setPendingMove(null)
    setPendingAttack(null)
  }

  const handleEndActivation = () => {
    setActivated(false)
    setOrder(null)
    setApUsed(0)
  }

  const handlePickMove = (a: ActionType) => {
    const cost = a === 'FALL_BACK' ? 2 : 1
    if (apUsed + cost > (atkOp?.stats.apl || 2)) return
    
    // Simulate consuming AP immediately for test lab purposes
    setApUsed(prev => prev + cost)
    sandboxAbilityResolver.useAbility(atkOp?.name || 'Unknown', a, cost)
    update()
  }

  const handlePickAttack = (k: 'SHOOT' | 'FIGHT') => {
    const cost = 1
    if (apUsed + cost > (atkOp?.stats.apl || 2)) return
    
    setApUsed(prev => prev + cost)
    sandboxAbilityResolver.useAbility(atkOp?.name || 'Unknown', k, cost)
    update()
    handleMockCombat(k)
  }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', overflowY: 'auto' }}>
      <h2>技能与计谋实验室 (Ability Sandbox)</h2>

      {/* Top Selectors */}
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, background: 'rgba(30,64,175,0.2)', padding: '12px', borderRadius: '8px' }}>
          <h4>攻击方选择</h4>
          <select value={atkFactionId} onChange={(e) => setAtkFactionId(e.target.value)} style={{ width: '100%', marginBottom: '8px', padding: '6px' }}>
            {TESTLAB_PACKS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={atkOpId || atkPack?.operatives[0]?.operativeId || ''} onChange={(e) => setAtkOpId(e.target.value)} style={{ width: '100%', padding: '6px' }}>
            {atkPack?.operatives.map(o => <option key={o.operativeId} value={o.operativeId}>{o.name}</option>)}
          </select>
        </div>
        
        <div style={{ flex: 1, background: 'rgba(185,28,28,0.2)', padding: '12px', borderRadius: '8px' }}>
          <h4>防守方选择</h4>
          <select value={defFactionId} onChange={(e) => setDefFactionId(e.target.value)} style={{ width: '100%', marginBottom: '8px', padding: '6px' }}>
            {TESTLAB_PACKS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={defOpId || defPack?.operatives[0]?.operativeId || ''} onChange={(e) => setDefOpId(e.target.value)} style={{ width: '100%', padding: '6px' }}>
            {defPack?.operatives.map(o => <option key={o.operativeId} value={o.operativeId}>{o.name}</option>)}
          </select>
        </div>
      </div>

      {/* Central Command Area Mock */}
      <div style={{ background: '#1e1e2f', border: `1px solid ${atkPack?.faction.theme?.ui?.textHighlight || '#4ade80'}`, borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: atkPack?.faction.theme?.ui?.textHighlight || '#4ade80' }}>
            指挥官计谋控制台 ({atkPack?.faction.name})
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => { sandboxAbilityResolver.setCP(cp - 1); update() }} style={{ background: '#444', color: '#fff', padding: '4px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>-</button>
            <div style={{ background: 'rgba(74, 222, 128, 0.2)', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', color: '#4ade80', border: '1px solid #4ade80' }}>
              CP: {cp}
            </div>
            <button onClick={() => { sandboxAbilityResolver.setCP(cp + 1); update() }} style={{ background: '#444', color: '#fff', padding: '4px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+</button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {activeStratagems.length === 0 && <span style={{ color: '#aaa' }}>该阵营暂无计谋数据。</span>}
          {activeStratagems.map(p => (
            <button 
              key={p.id}
              onClick={() => handleActivatePloy(p)}
              disabled={cp < p.cp || activePloys.some(active => active.id === p.id)}
              style={{
                background: p.phase === 'STRATEGY' ? '#3b82f6' : '#ef4444',
                color: '#fff', padding: '12px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                opacity: (cp < p.cp || activePloys.some(active => active.id === p.id)) ? 0.5 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '300px'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>[{p.phase === 'STRATEGY' ? '战略' : '交战'}] {p.name} ({p.cp} CP)</div>
              <div style={{ fontSize: '0.8rem', textAlign: 'left', opacity: 0.9 }}>{p.description}</div>
            </button>
          ))}
        </div>

        {activePloys.length > 0 && (
          <div style={{ marginTop: '16px', color: '#fbbf24', fontSize: '0.9rem' }}>
            <strong>当前已激活: </strong>
            {activePloys.map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Mock Action Bar */}
        <div style={{ flex: 1, background: '#222', borderRadius: '12px', padding: '20px', border: '1px solid #555', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ marginTop: 0, color: '#fff' }}>角色命令与激活 - {atkOp?.name}</h3>
            {!activated ? (
              <button onClick={handleActivate} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                激活该特工
              </button>
            ) : null}
          </div>

          <div style={{ marginTop: '16px' }}>
            <ActionBar
              active="a"
              activated={activated}
              order={order}
              apl={atkOp?.stats.apl || 2}
              apUsed={apUsed}
              canDo={{ MOVE: true, DASH: true, FALL_BACK: true, CHARGE: true, SHOOT: true, FIGHT: true, PASS: true }}
              pendingMove={pendingMove}
              pendingAttack={pendingAttack}
              hasLastShot={false}
              canUndoAction={false}
              onActivate={handleActivate}
              onSelectOrder={setOrder}
              onPickMove={handlePickMove}
              onPickAttack={handlePickAttack}
              onUndoAction={() => {}}
              onEndActivation={handleEndActivation}
              onEndTP={() => {}}
              onUndo={() => {}}
              themeColor={`rgb(${atkPack?.faction.theme?.ui?.primaryRgb || '255, 90, 0'})`}
            />
          </div>
          
          <h4 style={{ color: '#ccc', marginTop: '24px' }}>特工主动技能 (消耗 AP)</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
            {atkOp?.abilities?.length === 0 && <span style={{ color: '#aaa' }}>该特工没有特殊技能。</span>}
            {atkOp?.abilities?.map(effectId => {
              const effect = atkPack?.effects?.find(a => a.effectId === effectId)
              return (
                <button 
                  key={effectId} 
                  className="test-btn secondary"
                  onClick={() => {
                    const cost = 1 // Simplified cost for testing
                    handleUseAbility(effect?.label || effectId, cost)
                  }}
                  title={effect?.effectId}
                >
                  {effect?.label || effectId} (测试扣除1AP)
                </button>
              )
            })}
          </div>

          <hr style={{ borderColor: '#444', margin: '20px 0', width: '100%' }} />

          <h3 style={{ marginTop: 0, color: '#fff' }}>战斗环境设置 (Combat Resolver)</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#ccc' }}>掷骰模式:</span>
            <select 
              value={rollMode} 
              onChange={(e) => setRollMode(e.target.value as 'AUTO' | 'MANUAL')}
              style={{ padding: '6px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' }}
            >
              <option value="AUTO">自动生成 (AUTO)</option>
              <option value="MANUAL">物理投掷 (MANUAL)</option>
            </select>
          </div>
          <p style={{ color: '#aaa', fontSize: '0.9rem' }}>
            请在上方“角色命令”中点击【射击】或【近战】以唤起骰子结算界面。
          </p>
        </div>

        {/* Console Logs */}
        <div style={{ width: '400px', background: '#0f172a', borderRadius: '12px', padding: '16px', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#94a3b8' }}>引擎拦截日志</h3>
          <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#38bdf8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>
                &gt; {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCombat && (
        <div className="overlay-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', background: '#111', padding: '0', borderRadius: '12px', border: '1px solid #333', boxShadow: '0 10px 40px rgba(0,0,0,0.8)', width: '95vw', maxWidth: '1000px', height: '95vh', maxHeight: '900px', display: 'flex', flexDirection: 'column' }}>
            <CombatResolver
              mode={combatKind}
              attackerName={atkOp?.name || 'Attacker'}
              attackerPortrait={{
                name: atkOp?.name || 'Attacker',
                maxWounds: atkOp?.stats.wounds || 10,
                currentWounds: atkOp?.stats.wounds || 10,
                statuses: [],
                themeColor: `rgb(${atkPack?.faction.theme?.ui?.primaryRgb || '255, 90, 0'})`,
                themeColorRgb: atkPack?.faction.theme?.ui?.primaryRgb || '255, 90, 0',
                avatarUrl: '',
                scale: 2
              }}
              attackerCount={4}
              attackerContext={{ hitTarget: 3, critTarget: 6 }}
              attackerTheme={atkPack?.faction.theme?.dice || { baseColor: '#1e1e1e', pipColor: '#e0e0e0' }}
              attackerDamage={{ normal: 3, critical: 4 }}
              defenderName={defOp?.name || 'Defender'}
              defenderPortrait={{
                name: defOp?.name || 'Defender',
                maxWounds: defOp?.stats.wounds || 10,
                currentWounds: defOp?.stats.wounds || 10,
                statuses: [],
                themeColor: `rgb(${defPack?.faction.theme?.ui?.primaryRgb || '92, 255, 140'})`,
                themeColorRgb: defPack?.faction.theme?.ui?.primaryRgb || '92, 255, 140',
                avatarUrl: '',
                scale: 2
              }}
              defenderCount={3}
              defenderContext={{ hitTarget: defOp?.stats.save || 3, critTarget: 6 }}
              defenderTheme={defPack?.faction.theme?.dice || { baseColor: '#444', pipColor: '#fff' }}
              defenderDamage={{ normal: 0, critical: 0 }}
              defenderModifiers={["测试环境干预：无掩体", "测试环境干预：无特殊光环"]}
              attackerActions={buildCombatActions(atkPack, atkOp)}
              defenderActions={buildCombatActions(defPack, defOp)}
              onActionActivated={handleActionActivated}
              rollMode={rollMode}
              onComplete={(result) => {
                const totalDmg = result.damageDealt?.normal || 0
                sandboxAbilityResolver.onDamageDealt(defOp?.name || 'Defender', totalDmg)
                setShowCombat(false)
                update()
              }}
              onCancel={() => {
                setShowCombat(false)
                update()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
