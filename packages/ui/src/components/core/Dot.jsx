import React from "react";

/** A 5px yellow dot. The brand's quiet signal: it marks a line worth reading —
 *  low stock, a new arrival, a discount — without spending a colour on a badge. */
export function Dot({tone="butter",size=5,style,...rest}){
  const bg={butter:"var(--rating-star)",ink:"var(--text-heading)",
    muted:"var(--border-strong)"}[tone];
  return <span aria-hidden="true" style={{display:"inline-block",width:size,height:size,
    borderRadius:"var(--r-disc)",background:bg,flexShrink:0,verticalAlign:"1px",
    marginRight:"var(--sp-2)",...style}} {...rest}/>;
}
