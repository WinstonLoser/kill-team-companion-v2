import { useEffect, useState } from 'react'
import { useAnimationStore, type AnimationRequest } from '../../../state/animationStore'
import './AnimationEngine.css'

export function AnimationEngine() {
  const activeAnimation = useAnimationStore(s => s.activeAnimation)
  const finishCurrent = useAnimationStore(s => s.finishCurrent)

  if (!activeAnimation) return null

  return (
    <div className="animation-engine-overlay">
      <AnimationNode 
        key={activeAnimation.id}
        anim={activeAnimation} 
        onFinish={finishCurrent} 
      />
    </div>
  )
}

function AnimationNode({ anim, onFinish }: { anim: AnimationRequest, onFinish: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'active' | 'exit'>('enter')

  useEffect(() => {
    // Determine total duration
    const defaultDuration = anim.type === 'DEATH' ? 2500 : 1500
    const duration = anim.durationMs || defaultDuration

    // Enter -> Active transition
    const enterTimer = setTimeout(() => {
      setPhase('active')
    }, 100)

    // Active -> Exit transition
    const exitTimer = setTimeout(() => {
      setPhase('exit')
    }, duration - 300) // 300ms for exit animation

    // Finish
    const finishTimer = setTimeout(() => {
      onFinish()
    }, duration)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(exitTimer)
      clearTimeout(finishTimer)
    }
  }, [anim.id])

  const typeClass = `anim-type-${anim.type.toLowerCase()}`
  const themeColor = anim.themeColorRgb ? `rgb(${anim.themeColorRgb})` : '#555'

  return (
    <div className={`anim-node ${phase} ${typeClass}`}>
      <div 
        className="anim-portrait"
        style={{ 
          backgroundImage: anim.avatarUrl ? `url(${anim.avatarUrl})` : 'none',
          borderColor: anim.type === 'DAMAGE' || anim.type === 'DEATH' ? '#ff3333' : themeColor,
          boxShadow: `0 0 40px ${anim.type === 'DAMAGE' || anim.type === 'DEATH' ? 'rgba(255, 50, 50, 0.6)' : themeColor.replace('rgb', 'rgba').replace(')', ', 0.6)')}`
        }}
      >
        {anim.type === 'DEATH' && <div className="anim-slash"></div>}
      </div>

      {anim.maxWounds !== undefined && anim.prevWounds !== undefined && anim.currentWounds !== undefined && (
        <HealthBar max={anim.maxWounds} prev={anim.prevWounds} current={anim.currentWounds} />
      )}

      {anim.text && anim.type !== 'DEATH' && (
        <div 
          className="anim-text"
          style={{ color: anim.type === 'HEAL' ? '#4ade80' : (anim.type === 'DAMAGE' ? '#ff5c5c' : '#fff') }}
        >
          {anim.text}
        </div>
      )}
    </div>
  )
}

function HealthBar({ max, prev, current }: { max: number, prev: number, current: number }) {
  const [w, setW] = useState(prev)

  useEffect(() => {
    const t = setTimeout(() => {
      setW(current)
    }, 100)
    return () => clearTimeout(t)
  }, [prev, current])

  const wPct = Math.max(0, Math.min(100, (w / max) * 100))
  
  return (
    <div style={{ width: '200px', height: '16px', background: '#333', border: '2px solid #555', borderRadius: '8px', marginTop: '24px', overflow: 'hidden', position: 'relative' }}>
       <div style={{ 
         width: `${wPct}%`, 
         height: '100%', 
         background: current < prev ? '#ff3333' : '#4ade80', 
         transition: 'width 0.5s ease-out' 
       }} />
    </div>
  )
}
