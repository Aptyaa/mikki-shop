import React from "react";
const fmt=(n)=>new Intl.NumberFormat("ru-RU").format(n)+" ₽";

/** Formatted RUB price. Set in the body face, not the display face — in a printed
 *  layout a price is information, not a headline. */
export function PriceBlock({price,was,size="md",align="left",stacked=false,style,...rest}){
  const fs=size==="lg"?"var(--fs-h3)":size==="sm"?"var(--fs-body-sm)":"var(--fs-body)";
  return (
    <span style={{display:"inline-flex",flexDirection:stacked?"column":"row",
      alignItems:stacked?(align==="right"?"flex-end":"flex-start"):"baseline",
      gap:stacked?"var(--sp-1)":"var(--sp-3)",
      justifyContent:align==="right"?"flex-end":"flex-start",...style}} {...rest}>
      <span style={{fontFamily:"var(--font-body)",fontWeight:"var(--fw-semibold)",fontSize:fs,
        lineHeight:1.2,color:was?"var(--text-price-sale)":"var(--text-price)",
        letterSpacing:"0.01em",whiteSpace:"nowrap"}}>{fmt(price)}</span>
      {was!=null&&<span style={{fontFamily:"var(--font-body)",fontWeight:"var(--fw-regular)",
        fontSize:"var(--fs-caption)",color:"var(--text-muted)",
        textDecoration:"line-through",whiteSpace:"nowrap"}}>{fmt(was)}</span>}
    </span>
  );
}
