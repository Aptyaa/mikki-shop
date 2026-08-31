import React from "react";

const base={display:"inline-grid",placeItems:"center",fontFamily:"var(--font-body)",
  fontWeight:"var(--fw-bold)",fontSize:"var(--fs-micro)",lineHeight:1,
  borderRadius:"var(--r-pill)"};

// Each tone is an alias PAIR that flips together across palettes and themes.
// A literal #fff here would fail AA on berry (2.73) and apricot (2.81) at 11px.
const TONES={
  berry:{background:"var(--tag-sale-bg)",color:"var(--tag-sale-fg)"},
  apricot:{background:"var(--action-primary)",color:"var(--text-on-primary)"},
  forest:{background:"var(--surface-inverse)",color:"var(--text-inverse)"}
};

/** Count bubble for cart and notifications. */
export function Badge({count=0,max=99,dot=false,tone="berry",style,...rest}){
  const t=TONES[tone]||TONES.berry;
  if(dot) return <span style={{...base,background:t.background,width:9,height:9,...style}} {...rest}/>;
  if(!count) return null;
  return <span style={{...base,...t,minWidth:19,height:19,padding:"0 5px",
    boxShadow:"0 0 0 2px var(--surface-card)",...style}} {...rest}>{count>max?max+"+":count}</span>;
}
