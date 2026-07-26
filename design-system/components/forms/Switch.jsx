import React from 'react';

export function Switch({label,checked,onChange}){
  return React.createElement('label',{style:{display:'inline-flex',alignItems:'center',gap:'10px',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'var(--text-body)',color:'var(--text-primary)'}},
    React.createElement('span',{onClick:()=>onChange&&onChange(!checked),style:{
      width:38,height:20,borderRadius:'var(--radius-pill)',position:'relative',
      background:checked?'var(--accent-primary)':'var(--bg-surface-raised)',
      border:'1px solid '+(checked?'var(--accent-primary)':'var(--border-strong)'),
      transition:'background var(--dur-fast) var(--ease-out)'
    }},React.createElement('span',{style:{
      position:'absolute',top:1,left:checked?19:1,width:16,height:16,borderRadius:'50%',
      background:'var(--kc-bone-3)',transition:'left var(--dur-fast) var(--ease-out)'
    }})),
    label
  );
}
