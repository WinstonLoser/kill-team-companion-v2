import React from 'react';

export function Modal({open,title,onClose,children,footer}){
  if(!open) return null;
  return React.createElement('div',{style:{
    position:'fixed',inset:0,background:'rgba(11,11,12,0.75)',backdropFilter:'blur(2px)',
    display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000
  },onClick:onClose},
    React.createElement('div',{onClick:e=>e.stopPropagation(),style:{
      background:'var(--bg-surface-raised)',border:'1px solid var(--border-strong)',
      borderTop:'3px solid var(--accent-primary)',borderRadius:'var(--radius-lg) var(--radius-lg) 0 0',
      minWidth:360,maxWidth:480,overflow:'hidden'
    }},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--bg-chrome)',padding:'14px 20px',borderRadius:'var(--radius-md) var(--radius-md) 0 0'}},
        React.createElement('h3',{style:{fontFamily:'var(--font-display)',fontWeight:'var(--fw-display)',fontSize:'var(--text-title)',color:'var(--text-on-chrome)',margin:0,letterSpacing:'var(--ls-display)'}},title),
        React.createElement('button',{onClick:onClose,style:{background:'none',border:'none',color:'var(--text-on-chrome)',fontSize:20,cursor:'pointer',lineHeight:1}},'×')
      ),
      React.createElement('div',{style:{color:'var(--text-secondary)',fontSize:'var(--text-body)',lineHeight:'var(--lh-body)',padding:'20px'}},
        children,
        footer&&React.createElement('div',{style:{marginTop:20,display:'flex',gap:8,justifyContent:'flex-end'}},footer)
      )
    )
  );
}
