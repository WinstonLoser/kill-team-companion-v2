import React from 'react';

export function TopBar({title,eyebrow,actions}){
  return React.createElement('header',{style:{
    display:'flex',alignItems:'center',justifyContent:'space-between',
    padding:'14px 20px',background:'var(--bg-chrome)',borderBottom:'2px solid var(--border-accent)'
  }},
    React.createElement('div',null,
      eyebrow&&React.createElement('div',{style:{fontFamily:'var(--font-label)',fontSize:'11px',letterSpacing:'var(--ls-eyebrow)',textTransform:'uppercase',color:'var(--accent-primary)'}},eyebrow),
      React.createElement('div',{style:{fontFamily:'var(--font-display)',fontWeight:'var(--fw-display-black)',fontSize:'22px',letterSpacing:'var(--ls-display)',color:'var(--text-on-chrome)',textTransform:'uppercase'}},title)
    ),
    React.createElement('div',{style:{display:'flex',gap:'8px'}},actions)
  );
}
