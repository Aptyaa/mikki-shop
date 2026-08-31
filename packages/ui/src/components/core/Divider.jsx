import React from "react";
/** Hairline rule. `inset` aligns with list text; `paws` is the decorative brand break. */
export function Divider({inset=false,tone="subtle",decorative=false,style,...rest}){
  if(decorative) return <div style={{display:"flex",alignItems:"center",gap:"var(--sp-3)",
    color:"var(--border-strong)",padding:"var(--sp-5) 0",...style}} {...rest}>
    <span style={{flex:1,height:1,background:"var(--border-subtle)"}}/>
    <span style={{fontSize:12,letterSpacing:"0.3em",color:"var(--ornament)"}}>• • •</span>
    <span style={{flex:1,height:1,background:"var(--border-subtle)"}}/>
  </div>;
  return <hr style={{border:0,height:1,margin:0,
    marginLeft:inset?"var(--sp-5)":0,
    background:tone==="strong"?"var(--border-strong)":"var(--border-subtle)",...style}} {...rest}/>;
}
