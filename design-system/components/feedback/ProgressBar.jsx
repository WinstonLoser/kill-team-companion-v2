import React from 'react';

export function ProgressBar({value,max=100,tone='accent',label}){
  const pct=Math.max(0,Math.min(100,(value/max)*100));
  const colors={accent:'var(--accent-primary)',danger:'var(--status-danger)',success:'var(--status-success)'};
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'4px'}},
    label&&React.createElement('div',{style:{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-label)',fontSize:'11px',letterSpacing:'var(--ls-label)',textTransform:'uppercase',color:'var(--text-secondary)'}},
      React.createElement('span',null,label),React.createElement('span',null,value+'/'+max)),
    React.createElement('div',{style:{height:8,background:'var(--bg-void)',border:'1px solid var(--border-hairline)'}},
      React.createElement('div',{style:{height:'100%',width:pct+'%',background:colors[tone]||colors.accent,transition:'width var(--dur-base) var(--ease-out)'}})
    )
  );
}
