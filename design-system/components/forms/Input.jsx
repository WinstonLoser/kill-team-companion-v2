import React from 'react';

const wrap={display:'flex',flexDirection:'column',gap:'6px'};
const labelStyle={fontFamily:'var(--font-label)',fontSize:'12px',letterSpacing:'var(--ls-label)',textTransform:'uppercase',color:'var(--text-secondary)'};
const base={fontFamily:'var(--font-body)',fontSize:'var(--text-body)',color:'var(--text-primary)',background:'var(--bg-void)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-sm)',padding:'10px 12px',outline:'none',transition:'border-color var(--dur-fast) var(--ease-out),box-shadow var(--dur-fast) var(--ease-out)'};

export function Input({label,placeholder,value,onChange,type='text',error}){
  const [focus,setFocus]=React.useState(false);
  return React.createElement('label',{style:wrap},
    label&&React.createElement('span',{style:labelStyle},label),
    React.createElement('input',{type,value,placeholder,onChange:e=>onChange&&onChange(e.target.value),
      onFocus:()=>setFocus(true),onBlur:()=>setFocus(false),
      style:{...base,borderColor:error?'var(--status-danger)':(focus?'var(--border-accent)':'var(--border-default)')}}),
    error&&React.createElement('span',{style:{fontSize:'var(--text-caption)',color:'var(--kc-blood-3)'}},error)
  );
}
