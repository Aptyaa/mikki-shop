import React from "react";

const base={borderRadius:"var(--r-card)",
  transition:"background var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)"};

/** Content surface. Flat by default — a shadow means "floating", not "this is a card". */
export function Card({pad="md",tone="card",interactive=false,elevated=false,onClick,children,style,...rest}){
  const [h,setH]=React.useState(false);
  const padding={none:0,sm:"var(--sp-4)",md:"var(--card-pad)",lg:"var(--card-pad-lg)"}[pad];
  const tones={
    card:{background:"var(--surface-card)",border:"1px solid var(--border-subtle)"},
    plain:{background:"transparent",border:"1px solid transparent"},
    sunken:{background:"var(--surface-sunken)",border:"1px solid transparent"},
    tint:{background:"var(--surface-tint)",border:"1px solid var(--border-tint)"},
    inverse:{background:"var(--surface-inverse)",border:"1px solid transparent",color:"var(--text-inverse)"}
  }[tone];
  return <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{...base,padding,...tones,
      boxShadow:elevated?"var(--sh-3)":"none",
      ...(interactive?{cursor:"pointer"}:null),
      ...(interactive&&h?{background:tone==="card"?"var(--bg-elevated)":undefined,
        borderColor:"var(--border-strong)"}:null),...style}} {...rest}>{children}</div>;
}
