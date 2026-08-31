import React from "react";
/** Checkbox with label. */
export function Checkbox({checked=false,onChange,label,hint,disabled=false,style,...rest}){
  return (
    <label style={{display:"flex",gap:"var(--sp-4)",alignItems:"flex-start",cursor:disabled?"not-allowed":"pointer",
      minHeight:"var(--tap-min)",padding:"var(--sp-3) 0",...style}}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
        style={{position:"absolute",opacity:0,width:1,height:1}} {...rest}/>
      <span style={{width:24,height:24,flexShrink:0,borderRadius:"var(--r-xs)",
        display:"grid",placeItems:"center",marginTop:1,
        border:"2px solid "+(checked?"var(--action-primary)":"var(--border-strong)"),
        background:checked?"var(--action-primary)":"var(--surface-card)",
        transition:"all var(--dur-fast) var(--ease-out)"}}>
        {checked&&<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-6.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </span>
      <span style={{display:"flex",flexDirection:"column",gap:2}}>
        <span style={{fontSize:"var(--fs-body)",color:"var(--text-body)"}}>{label}</span>
        {hint&&<span style={{fontSize:"var(--fs-caption)",color:"var(--text-muted)"}}>{hint}</span>}
      </span>
    </label>
  );
}
