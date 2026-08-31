import React from "react";
/** Loading placeholder — shimmer in cream, never grey. */
export function Skeleton({width="100%",height=16,radius="var(--r-sm)",style,...rest}){
  return <span style={{display:"block",width,height,borderRadius:radius,
    background:"linear-gradient(90deg,var(--surface-sunken) 25%,var(--bg-page) 50%,var(--surface-sunken) 75%)",
    backgroundSize:"200% 100%",animation:"ms-shimmer 1.4s linear infinite",...style}} {...rest}/>;
}
