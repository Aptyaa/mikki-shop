import React from "react";

const base={display:"inline-flex",alignItems:"center",gap:"var(--sp-2)",height:36,padding:"0 var(--sp-5)",
  borderRadius:"var(--r-pill)",fontFamily:"var(--font-body)",fontWeight:"var(--fw-semibold)",
  fontSize:"var(--fs-body-sm)",cursor:"pointer",border:"1px solid var(--border-subtle)",
  background:"var(--surface-card)",color:"var(--text-body)",whiteSpace:"nowrap",
  transition:"all var(--dur-fast) var(--ease-out)"};

/** Filter / category selector pill. */
export function Chip({selected=false,icon=null,count,onClick,children,style,...rest}){
  return <button type="button" onClick={onClick} aria-pressed={selected}
    style={{...base,...(selected?{background:"var(--surface-inverse)",color:"var(--text-inverse)",borderColor:"var(--surface-inverse)"}:null),...style}} {...rest}>
    {icon}{children}
    {count!=null&&<span style={{opacity:.6,fontWeight:"var(--fw-regular)"}}>{count}</span>}
  </button>;
}
