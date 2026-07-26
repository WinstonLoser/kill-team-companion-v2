// Shared demo chrome for component @dsCard files: app-consistent header + dark/light toggle.
window.KCCardShell = function KCCardShell({label,children}){
  const [theme,setTheme]=React.useState('dark');
  const KC=window.KillTeamCompanionDesignSystem_f378e7;
  return React.createElement('div',{'data-theme':theme==='light'?'light':null,style:{background:'var(--bg-app)',minHeight:'100%',display:'flex',flexDirection:'column'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',background:'var(--bg-chrome)',borderBottom:'2px solid var(--border-accent)'}},
      React.createElement('div',{style:{fontFamily:'var(--font-label)',fontSize:'11px',letterSpacing:'var(--ls-eyebrow)',textTransform:'uppercase',color:'var(--accent-primary)'}},label),
      React.createElement('button',{onClick:()=>setTheme(t=>t==='light'?'dark':'light'),style:{
        fontFamily:'var(--font-label)',fontSize:'10px',letterSpacing:'var(--ls-label)',textTransform:'uppercase',
        background:'transparent',color:'var(--text-on-chrome)',border:'1px solid var(--border-strong)',
        borderRadius:'var(--radius-sm)',padding:'5px 10px',cursor:'pointer'
      }},theme==='light'?'Dark':'Light')
    ),
    React.createElement('div',{style:{padding:'20px',flex:1}},children)
  );
};
