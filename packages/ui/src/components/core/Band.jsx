import React from "react";

/** A full-bleed strip of colour, cut edge to edge. The brand's main use of yellow.
 *  Bands carry the wordmark, a promise, or a delivery line — never body copy. */
export function Band({tone="butter",bleed=true,align="between",children,style,...rest}){
  const tones={
    butter:{background:"var(--action-primary)",color:"var(--text-on-primary)"},
    ink:{background:"var(--surface-inverse)",color:"var(--text-inverse)"},
    paper:{background:"var(--surface-sunken)",color:"var(--text-heading)"},
    tint:{background:"var(--surface-tint)",color:"var(--text-heading)"}
  }[tone];
  return (
    <div style={{...tones,
      display:"flex",alignItems:"center",gap:"var(--sp-5)",
      justifyContent:align==="between"?"space-between":align,
      padding:"var(--sp-4) var(--gutter)",
      marginLeft:bleed?"calc(var(--gutter) * -1)":0,
      marginRight:bleed?"calc(var(--gutter) * -1)":0,
      fontFamily:"var(--font-body)",fontWeight:"var(--fw-semibold)",fontSize:"var(--fs-body-sm)",
      ...style}} {...rest}>{children}</div>
  );
}
