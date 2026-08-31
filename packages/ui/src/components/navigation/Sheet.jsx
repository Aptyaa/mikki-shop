import React from "react";
/** Bottom sheet — the brand's only modal pattern. */
export function Sheet({open=false,title,onClose,children,footer,style,...rest}){
  if(!open) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:60,display:"flex",flexDirection:"column",
      justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,
        background:"rgba(36,26,18,.44)",backdropFilter:"blur(2px)",
        animation:"ms-pop-in var(--dur-base) var(--ease-out)"}}/>
      <div role="dialog" aria-modal="true" style={{position:"relative",background:"var(--bg-elevated)",
        borderRadius:"var(--r-sheet)",boxShadow:"var(--sh-sheet)",maxHeight:"86vh",
        display:"flex",flexDirection:"column",
        animation:"ms-sheet-up var(--dur-slow) var(--ease-out)",...style}} {...rest}>
        <div style={{display:"grid",placeItems:"center",padding:"var(--sp-3) 0 0"}}>
          <span style={{width:36,height:4,borderRadius:2,background:"var(--border-strong)"}}/>
        </div>
        {title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          gap:"var(--sp-4)",padding:"var(--sp-4) var(--gutter) var(--sp-3)"}}>
          <h2 style={{fontFamily:"var(--font-display)",fontWeight:"var(--fw-extrabold)",
            fontSize:"var(--fs-h2)",color:"var(--text-heading)",margin:0}}>{title}</h2>
          <button type="button" aria-label="Закрыть" onClick={onClose}
            style={{border:"none",background:"var(--surface-sunken)",width:32,height:32,
              borderRadius:"50%",cursor:"pointer",color:"var(--text-body)",fontSize:16,lineHeight:1}}>×</button>
        </div>}
        <div style={{overflowY:"auto",padding:"0 var(--gutter) var(--sp-5)"}}>{children}</div>
        {footer&&<div style={{padding:"var(--sp-4) var(--gutter)",
          paddingBottom:"calc(var(--sp-4) + var(--safe-bottom))",
          borderTop:"1px solid var(--border-subtle)",background:"var(--bg-elevated)"}}>{footer}</div>}
      </div>
    </div>
  );
}
