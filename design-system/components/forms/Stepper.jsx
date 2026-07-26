import React from 'react';

export function Stepper({label,value,min=0,max=99,onChange}){
  const dec=()=>onChange&&onChange(Math.max(min,value-1));
  const inc=()=>onChange&&onChange(Math.min(max,value+1));
  const btn={width:30,height:30,background:'var(--bg-surface-raised)',border:'1px solid var(--border-default)',color:'var(--text-primary)',fontFamily:'var(--font-label)',fontSize:16,cursor:'pointer',borderRadius:'var(--radius-sm)'};
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'6px'}},
    label&&React.createElement('span',{style:{fontFamily:'var(--font-label)',fontSize:'12px',letterSpacing:'var(--ls-label)',textTransform:'uppercase',color:'var(--text-secondary)'}},label),
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'8px'}},
      React.createElement('button',{style:btn,onClick:dec},'−'),
      React.createElement('span',{style:{fontFamily:'var(--font-display)',fontSize:'20px',color:'var(--text-primary)',minWidth:28,textAlign:'center'}},value),
      React.createElement('button',{style:btn,onClick:inc},'+')
    )
  );
}
