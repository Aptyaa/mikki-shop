import React from "react";
/** Large selectable tile — delivery methods, payment options, pet sizes. */
export function RadioTile({selected=false,title,subtitle,meta,icon=null,onClick,disabled=false,style,...rest}){
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      style={{display:"flex",alignItems:"center",gap:"var(--sp-4)",width:"100%",textAlign:"left",
        padding:"var(--sp-4) var(--sp-5)",minHeight:64,cursor:disabled?"not-allowed":"pointer",
        background:selected?"var(--surface-tint)":"var(--surface-card)",
        border:"1.5px solid "+(selected?"var(--action-primary)":"var(--border-subtle)"),
        borderRadius:"var(--r-md)",opacity:disabled?.5:1,
        transition:"all var(--dur-fast) var(--ease-out)",...style}} {...rest}>
      {icon&&<span style={{color:selected?"var(--text-link)":"var(--text-muted)",display:"flex"}}>{icon}</span>}
      <span style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
        <span style={{fontFamily:"var(--font-display)",fontWeight:"var(--fw-bold)",
          fontSize:"var(--fs-h3)",color:"var(--text-heading)"}}>{title}</span>
        {subtitle&&<span style={{fontSize:"var(--fs-body-sm)",color:"var(--text-muted)"}}>{subtitle}</span>}
      </span>
      {meta&&<span style={{fontFamily:"var(--font-display)",fontWeight:"var(--fw-bold)",
        fontSize:"var(--fs-body)",color:"var(--text-heading)"}}>{meta}</span>}
      <span style={{width:20,height:20,flexShrink:0,borderRadius:"50%",display:"grid",placeItems:"center",
        border:"2px solid "+(selected?"var(--action-primary)":"var(--border-strong)")}}>
        {selected&&<span style={{width:10,height:10,borderRadius:"50%",background:"var(--action-primary)"}}/>}
      </span>
    </button>
  );
}
