import React from "react";

const base={display:"inline-flex",alignItems:"center",gap:"var(--sp-2)",height:"var(--tag-h)",
  padding:"0 var(--tag-pad-x)",borderRadius:"var(--r-tag)",
  fontFamily:"var(--font-body)",fontWeight:"var(--fw-semibold)",fontSize:"var(--fs-micro)",
  lineHeight:1,letterSpacing:"var(--ls-micro)",textTransform:"uppercase",whiteSpace:"nowrap"};

/** Square-cut label, stamped onto a photograph like a price ticket. */
export function Tag({tone="neutral",icon=null,children,style,...rest}){
  const TONES={
    paper:{background:"var(--bg-page)",color:"var(--text-heading)"},
    new:{background:"var(--tag-new-bg)",color:"var(--tag-new-fg)"},
    sale:{background:"var(--tag-sale-bg)",color:"var(--tag-sale-fg)"},
    soft:{background:"var(--tag-soft-bg)",color:"var(--tag-soft-fg)"},
    neutral:{background:"var(--bg-page)",color:"var(--text-muted)"},
    outline:{background:"transparent",color:"var(--text-muted)",boxShadow:"inset 0 0 0 1px var(--border-strong)"}
  };
  return <span style={{...base,...TONES[tone],...style}} {...rest}>{icon}{children}</span>;
}
