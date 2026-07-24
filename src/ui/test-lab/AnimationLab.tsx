import { useState, useEffect } from 'react'
import { useAnimationStore } from '../../state/animationStore'
import { getAvatarUrl } from '../../utils/avatars'
import { loadPack } from '../..'

export function AnimationLab({ packs }: { packs: { id: string; name: string; pack: any }[] }) {
  const [packId, setPackId] = useState<string>(packs[0]?.id ?? '')
  const packInfo = packs.find((p) => p.id === packId)
  const pack = packInfo?.pack
  
  const [selectedOpId, setSelectedOpId] = useState(pack?.operatives[0]?.operativeId)
  const playAnimation = useAnimationStore(s => s.playAnimation)

  useEffect(() => {
    if (pack) {
      setSelectedOpId(pack.operatives[0]?.operativeId ?? '')
    }
  }, [packId, pack])

  const handlePlay = (type: 'DAMAGE' | 'DEATH' | 'HEAL' | 'BUFF', text?: string, wounds?: { max: number, prev: number, current: number }) => {
    if (!pack || !selectedOpId) return
    
    const themeColorRgb = pack.faction.theme?.ui?.primaryRgb || '255, 90, 0'
    const avatarUrl = getAvatarUrl(pack.faction.id, selectedOpId)

    playAnimation({
      type,
      themeColorRgb,
      avatarUrl,
      text,
      maxWounds: wounds?.max,
      prevWounds: wounds?.prev,
      currentWounds: wounds?.current
    })
  }

  const handleComboPlay = () => {
    handlePlay('DAMAGE', '-3', { max: 10, prev: 10, current: 7 })
    handlePlay('HEAL', '+2', { max: 10, prev: 7, current: 9 })
    handlePlay('DEATH', undefined, { max: 10, prev: 9, current: 0 })
  }

  if (!pack) return <div>No pack data</div>

  return (
    <div style={{ padding: '24px', color: '#fff', maxWidth: '800px', margin: '0 auto' }}>
      <h2>动画引擎测试实验室 (Animation Engine Lab)</h2>
      <p style={{ color: '#aaa' }}>在此测试全局动画队列机制。每个事件将按照次序逐一播放。</p>

      <div style={{ background: '#222', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
        <h3>配置测试对象</h3>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label>阵营: </label>
            <select value={packId} onChange={(e) => setPackId(e.target.value)} style={{ padding: '4px 8px', background: '#333', color: '#fff' }}>
              {packs.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>特工: </label>
            <select value={selectedOpId} onChange={(e) => setSelectedOpId(e.target.value)} style={{ padding: '4px 8px', background: '#333', color: '#fff' }}>
              {pack.operatives.map((o: any) => (
                <option key={o.operativeId} value={o.operativeId}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        {selectedOpId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img 
              src={getAvatarUrl(pack.faction.id, selectedOpId)} 
              alt="avatar" 
              style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: `3px solid rgb(${pack.faction.theme?.ui?.primaryRgb || '255,255,255'})` }} 
            />
            <span>当前测试对象预览</span>
          </div>
        )}
      </div>

      <div style={{ background: '#222', padding: '16px', borderRadius: '8px' }}>
        <h3>触发动画 (Trigger Animations)</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => handlePlay('DAMAGE', '-3', { max: 10, prev: 10, current: 7 })} style={{ padding: '8px 16px', background: '#5c1a1a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            受击动画 (DAMAGE)
          </button>
          <button onClick={() => handlePlay('HEAL', '+2', { max: 10, prev: 5, current: 7 })} style={{ padding: '8px 16px', background: '#1a5c2d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            治疗动画 (HEAL)
          </button>
          <button onClick={() => handlePlay('BUFF', 'APL +1')} style={{ padding: '8px 16px', background: '#1a375c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            增益动画 (BUFF)
          </button>
          <button onClick={() => handlePlay('DEATH', undefined, { max: 10, prev: 3, current: 0 })} style={{ padding: '8px 16px', background: '#333', color: '#ff3333', border: '1px solid #ff3333', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            阵亡动画 (DEATH)
          </button>
        </div>

        <div style={{ marginTop: '24px', borderTop: '1px solid #444', paddingTop: '16px' }}>
          <h4>组合测试 (Combo Test)</h4>
          <p style={{ color: '#aaa', fontSize: '0.9rem' }}>连续快速点击将进入队列按顺序播放</p>
          <button onClick={handleComboPlay} style={{ padding: '8px 16px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            连招测试 (Damage -&gt; Heal -&gt; Death)
          </button>
        </div>
      </div>
    </div>
  )
}
