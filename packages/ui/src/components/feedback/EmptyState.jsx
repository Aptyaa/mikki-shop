import React from "react";
import { MascotBadge } from "../brand/MascotBadge.jsx";

/** Empty cart, no results, no orders — always the mascot plus one way forward. */
export function EmptyState({title,body,action,tone="cream",compact=false,style,...rest}){
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",
      gap:"var(--sp-5)",padding:compact?"var(--sp-8) var(--sp-6)":"var(--sp-10) var(--sp-6)",...style}} {...rest}>
      <MascotBadge size={compact?"md":"lg"} tone={tone}/>
      <div style={{display:"flex",flexDirection:"column",gap:"var(--sp-3)",maxWidth:280}}>
        <h3 style={{fontFamily:"var(--font-display)",fontWeight:"var(--fw-extrabold)",
          fontSize:"var(--fs-h2)",color:"var(--text-heading)",margin:0}}>{title}</h3>
        {body&&<p style={{margin:0,fontSize:"var(--fs-body-sm)",color:"var(--text-muted)"}}>{body}</p>}
      </div>
      {action}
    </div>
  );
}
