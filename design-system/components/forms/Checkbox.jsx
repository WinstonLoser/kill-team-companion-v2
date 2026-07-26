import React from 'react';

export function Checkbox({label,checked,onChange}){
  return React.createElement('label',{style:{display:'inline-flex',alignItems:'center',gap:'10px',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'var(--text-body)',color:'var(--text-primary)'}},
    React.createElement('span',{onClick:()=>onChange&&onChange(!checked),style:{
      width:18,height:18,border:'1px solid '+(checked?'var(--accent-primary)':'var(--border-strong)'),
      background:checked?'var(--accent-primary)':'transparent',borderRadius:'2px',
      display:'inline-flex',alignItems:'center',justifyContent:'center',color:'var(--text-on-accent)',fontSize:12,
      transition:'all var(--dur-fast) var(--ease-out)'
    }},checked?'✓':''),
    label
  );
}
