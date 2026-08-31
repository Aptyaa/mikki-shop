import React from "react";
/** Title row above a content block, with an optional trailing link. */
export function SectionHeader({title,subtitle,action,onAction,style,...rest}){
  return (
    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:"var(--sp-4)",
      marginBottom:"var(--sp-5)",...style}} {...rest}>
      <div style={{display:"flex",flexDirection:"column",gap:2,minWidth:0}}>
        <h2 style={{fontFamily:"var(--font-display)",fontWeight:"var(--fw-extrabold)",
          fontSize:"var(--fs-h2)",lineHeight:"var(--lh-h2)",letterSpacing:"var(--ls-h2)",
          color:"var(--text-heading)",margin:0}}>{title}</h2>
        {subtitle&&<span style={{fontSize:"var(--fs-body-sm)",color:"var(--text-muted)"}}>{subtitle}</span>}
      </div>
      {action&&<button type="button" onClick={onAction}
        style={{border:"none",background:"none",cursor:"pointer",padding:"var(--sp-2) 0",
          fontFamily:"var(--font-body)",fontWeight:"var(--fw-semibold)",fontSize:"var(--fs-body-sm)",
          color:"var(--text-link)",whiteSpace:"nowrap"}}>{action}</button>}
    </div>
  );
}
