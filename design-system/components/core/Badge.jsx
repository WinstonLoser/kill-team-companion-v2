import React from 'react';

const tones={
  neutral:{background:'var(--bg-surface-raised)',color:'var(--text-secondary)',border:'var(--border-default)'},
  accent:{background:'var(--accent-primary-muted)',color:'var(--accent-primary)',border:'var(--accent-primary)'},
  danger:{background:'rgba(143,31,31,0.18)',color:'var(--kc-blood-3)',border:'var(--status-danger)'},
  success:{background:'rgba(74,92,52,0.22)',color:'var(--kc-olive-3)',border:'var(--status-success)'},
  warning:{background:'rgba(184,134,46,0.2)',color:'var(--kc-amber-3)',border:'var(--status-warning)'},
};

export function Badge({tone='neutral',children}){
  const t=tones[tone]||tones.neutral;
  return React.createElement('span',{style:{
    fontFamily:'var(--font-label)',fontSize:'11px',fontWeight:'var(--fw-semibold)',
    letterSpacing:'var(--ls-eyebrow)',textTransform:'uppercase',
    padding:'3px 9px',borderRadius:'var(--radius-sm)',border:'1px solid '+t.border,
    background:t.background,color:t.color,display:'inline-block',lineHeight:1
  }},children);
}
