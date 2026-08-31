import React from "react";
/** Inline informational strip — delivery notes, stock warnings, care reminders. */
export function Notice({tone="info",title,children,icon=null,style,...rest}){
  const t={info:{bg:"var(--info-100)",fg:"var(--info-500)"},
    success:{bg:"var(--success-100)",fg:"var(--success-500)"},
    warning:{bg:"var(--warning-100)",fg:"#8A6300"},
    danger:{bg:"var(--danger-100)",fg:"var(--danger-500)"},
    brand:{bg:"var(--surface-tint)",fg:"var(--text-link)"}}[tone];
  return (
    <div style={{display:"flex",gap:"var(--sp-4)",padding:"var(--sp-4) var(--sp-5)",
      background:t.bg,borderRadius:"var(--r-md)",...style}} {...rest}>
      {icon&&<span style={{color:t.fg,flexShrink:0,display:"flex"}}>{icon}</span>}
      <div style={{display:"flex",flexDirection:"column",gap:2,minWidth:0}}>
        {title&&<span style={{fontWeight:"var(--fw-semibold)",fontSize:"var(--fs-body-sm)",color:t.fg}}>{title}</span>}
        {children&&<span style={{fontSize:"var(--fs-body-sm)",color:"var(--text-body)",lineHeight:1.45}}>{children}</span>}
      </div>
    </div>
  );
}
