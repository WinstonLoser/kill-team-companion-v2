import React from 'react';

export function Card({title,eyebrow,corner=false,dossier=false,children,footer}){
  const hasHeader=!!(title||eyebrow);
  return React.createElement('div',{className:(corner?'kc-clip-corner-tr ':'')+(dossier?'kc-dossier':''),style:{
    background:dossier?undefined:'var(--bg-surface)',border:dossier?undefined:'1px solid var(--border-hairline)',
    borderTop:'3px solid var(--accent-primary)',borderRadius:'var(--radius-lg) var(--radius-lg) 0 0',
    overflow:'hidden',
    display:'flex',flexDirection:'column'
  }},
    dossier&&React.createElement(React.Fragment,null,
      React.createElement('span',{className:'kc-dossier-corner tl'}),
      React.createElement('span',{className:'kc-dossier-corner tr'}),
      React.createElement('span',{className:'kc-dossier-corner bl'}),
      React.createElement('span',{className:'kc-dossier-corner br'})
    ),
    hasHeader&&React.createElement('div',{style:{background:'var(--bg-chrome)',padding:'14px 20px',display:'flex',flexDirection:'column',gap:'2px',borderRadius:'var(--radius-md) var(--radius-md) 0 0'}},
      eyebrow&&React.createElement('span',{style:{fontFamily:'var(--font-label)',fontSize:'11px',letterSpacing:'var(--ls-eyebrow)',textTransform:'uppercase',color:'var(--accent-primary)'}},eyebrow),
      title&&React.createElement('h3',{style:{fontFamily:'var(--font-display)',fontWeight:'var(--fw-display)',fontSize:'var(--text-title)',color:'var(--text-on-chrome)',margin:0,letterSpacing:'var(--ls-display)'}},title)
    ),
    React.createElement('div',{style:{color:'var(--text-secondary)',fontSize:'var(--text-body)',lineHeight:'var(--lh-body)',padding:'16px 20px',display:'flex',flexDirection:'column',gap:'12px',flex:1}},
      children,
      footer&&React.createElement('div',{style:{borderTop:'1px solid var(--border-hairline)',paddingTop:'12px',display:'flex',gap:'8px'}},footer)
    )
  );
}
