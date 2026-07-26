import React from 'react';

const base={fontFamily:'var(--font-label)',fontWeight:'var(--fw-semibold)',letterSpacing:'var(--ls-label)',textTransform:'uppercase',border:'1px solid transparent',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'8px',transition:'background var(--dur-fast) var(--ease-out),border-color var(--dur-fast) var(--ease-out),transform var(--dur-fast) var(--ease-out)',borderRadius:'var(--radius-sm)'};

const sizes={
  sm:{fontSize:'12px',padding:'6px 14px'},
  md:{fontSize:'14px',padding:'10px 20px'},
  lg:{fontSize:'16px',padding:'14px 28px'},
};

const variants={
  primary:{background:'var(--accent-primary)',color:'var(--text-on-accent)',borderColor:'var(--accent-primary)'},
  secondary:{background:'transparent',color:'var(--text-primary)',borderColor:'var(--border-strong)'},
  ghost:{background:'transparent',color:'var(--text-secondary)',borderColor:'transparent'},
  danger:{background:'var(--status-danger)',color:'var(--text-on-accent)',borderColor:'var(--status-danger)'},
};

const hoverBg={primary:'var(--accent-primary-hover)',secondary:'var(--bg-surface-raised)',ghost:'var(--bg-surface)',danger:'var(--status-danger-hover)'};

export function Button({variant='primary',size='md',disabled=false,icon=null,children,onClick,style}){
  const [hover,setHover]=React.useState(false);
  const [active,setActive]=React.useState(false);
  const v=variants[variant]||variants.primary;
  const s=sizes[size]||sizes.md;
  const styles={...base,...s,...v,
    ...(hover&&!disabled?{background:hoverBg[variant],borderColor:variant==='secondary'?'var(--border-accent)':v.borderColor}:{}),
    ...(active&&!disabled?{transform:'scale(0.97)'}:{}),
    ...(disabled?{opacity:0.4,cursor:'not-allowed'}:{}),
    ...style};
  return React.createElement('button',{style:styles,disabled,onClick,
    onMouseEnter:()=>setHover(true),onMouseLeave:()=>{setHover(false);setActive(false)},
    onMouseDown:()=>setActive(true),onMouseUp:()=>setActive(false)},
    icon,children);
}
