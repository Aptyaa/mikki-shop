import React from "react";
const btn={width:36,height:36,borderRadius:"var(--r-pill)",border:"none",cursor:"pointer",
  background:"var(--surface-sunken)",color:"var(--text-heading)",fontSize:18,lineHeight:1,
  display:"grid",placeItems:"center",fontFamily:"var(--font-display)",fontWeight:"var(--fw-bold)"};

/** −/count/+ control for cart lines. */
export function QuantityStepper({value=1,min=1,max=99,onChange,size="md",style,...rest}){
  const scale=size==="sm"?.85:1;
  const set=(v)=>onChange&&onChange(Math.min(max,Math.max(min,v)));
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:"var(--sp-3)",...style}} {...rest}>
      <button type="button" aria-label="Меньше" onClick={()=>set(value-1)} disabled={value<=min}
        style={{...btn,width:36*scale,height:36*scale,opacity:value<=min?.4:1}}>−</button>
      <span style={{minWidth:24,textAlign:"center",fontFamily:"var(--font-display)",
        fontWeight:"var(--fw-bold)",fontSize:"var(--fs-body)",color:"var(--text-heading)"}}>{value}</span>
      <button type="button" aria-label="Больше" onClick={()=>set(value+1)} disabled={value>=max}
        style={{...btn,width:36*scale,height:36*scale,opacity:value>=max?.4:1}}>+</button>
    </div>
  );
}
