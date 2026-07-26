import React from 'react';

export function TabBar({tabs,active,onChange}){
  return React.createElement('div',{style:{display:'flex',borderBottom:'1px solid var(--border-hairline)',gap:'4px'}},
    tabs.map(t=>{
      const isActive=t.value===active;
      return React.createElement('button',{key:t.value,onClick:()=>onChange&&onChange(t.value),style:{
        background:'none',border:'none',cursor:'pointer',padding:'10px 16px',
        fontFamily:'var(--font-label)',fontSize:13,letterSpacing:'var(--ls-label)',textTransform:'uppercase',
        color:isActive?'var(--accent-primary)':'var(--text-secondary)',
        borderBottom:'2px solid '+(isActive?'var(--accent-primary)':'transparent'),
        marginBottom:'-1px'
      }},t.label);
    })
  );
}
