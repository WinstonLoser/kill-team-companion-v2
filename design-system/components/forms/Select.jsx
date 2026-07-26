import React from 'react';

export function Select({label,value,onChange,options=[]}){
  return React.createElement('label',{style:{display:'flex',flexDirection:'column',gap:'6px'}},
    label&&React.createElement('span',{style:{fontFamily:'var(--font-label)',fontSize:'12px',letterSpacing:'var(--ls-label)',textTransform:'uppercase',color:'var(--text-secondary)'}},label),
    React.createElement('select',{value,onChange:e=>onChange&&onChange(e.target.value),
      style:{fontFamily:'var(--font-body)',fontSize:'var(--text-body)',color:'var(--text-primary)',
        background:'var(--bg-void)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-sm)',
        padding:'10px 34px 10px 12px',outline:'none',appearance:'none',
        backgroundImage:'linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%)',
        backgroundPosition:'calc(100% - 18px) calc(50% - 2px),calc(100% - 13px) calc(50% - 2px)',
        backgroundSize:'5px 5px,5px 5px',backgroundRepeat:'no-repeat'}},
      options.map(o=>React.createElement('option',{key:o.value,value:o.value},o.label))
    )
  );
}
