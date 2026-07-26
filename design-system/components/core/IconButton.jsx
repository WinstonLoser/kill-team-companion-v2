import React from 'react';

export function IconButton({icon,label,active=false,onClick,size=36}){
  const [hover,setHover]=React.useState(false);
  return React.createElement('button',{
    title:label,'aria-label':label,onClick,
    onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false),
    style:{
      width:size,height:size,display:'inline-flex',alignItems:'center',justifyContent:'center',
      background:active?'var(--accent-primary-muted)':(hover?'var(--bg-surface-raised)':'transparent'),
      border:'1px solid '+(active?'var(--border-accent)':'var(--border-hairline)'),
      borderRadius:'var(--radius-sm)',color:active?'var(--accent-primary)':'var(--text-secondary)',
      cursor:'pointer',transition:'all var(--dur-fast) var(--ease-out)'
    }
  },icon);
}
