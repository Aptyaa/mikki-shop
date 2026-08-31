import React from "react";
import { Badge } from "../core/Badge";

/** Bottom navigation. Sits ABOVE the reserved Telegram MainButton strip. */
export function TabBar({items=[],value,onChange,reserveMainButton=true,style,...rest}){
  return (
    <nav style={{position:"sticky",bottom:0,display:"flex",background:"var(--bg-elevated)",
      boxShadow:"var(--sh-bar)",paddingTop:"var(--sp-2)",
      paddingBottom:reserveMainButton
        ? "calc(var(--sp-2) + var(--tg-mainbutton-h) + var(--safe-bottom))"
        : "calc(var(--sp-2) + var(--safe-bottom))",
      zIndex:30,...style}} {...rest}>
      {items.map(it=>{
        const on=value===it.key;
        return (
          <button key={it.key} type="button" onClick={()=>onChange&&onChange(it.key)}
            style={{flex:1,minHeight:"var(--tap-min)",border:"none",background:"none",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"var(--sp-2) 0",
              color:on?"var(--nav-active)":"var(--text-muted)",
              transition:"color var(--dur-fast) var(--ease-out)"}}>
            <span style={{position:"relative",display:"flex"}}>{it.icon}
              {it.badge?<Badge count={it.badge} style={{position:"absolute",top:-5,right:-9}}/>:null}</span>
            <span style={{fontSize:"var(--fs-micro)",fontWeight:on?"var(--fw-semibold)":"var(--fw-regular)"}}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
