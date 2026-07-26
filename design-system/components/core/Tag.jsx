import React from 'react';

export function Tag({children,onRemove}){
  return React.createElement('span',{style:{
    fontFamily:'var(--font-body)',fontSize:'var(--text-body-sm)',color:'var(--text-secondary)',
    background:'var(--bg-surface)',border:'1px solid var(--border-hairline)',borderRadius:'var(--radius-pill)',
    padding:'4px 8px 4px 12px',display:'inline-flex',alignItems:'center',gap:'6px'
  }},children,onRemove&&React.createElement('button',{onClick:onRemove,'aria-label':'Remove',style:{
    background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'14px',lineHeight:1,padding:0
  }},'×'));
}
