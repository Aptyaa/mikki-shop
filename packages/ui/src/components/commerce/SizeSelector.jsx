import React from "react";

/** Size picker. Out-of-stock sizes stay visible but struck through. */
export function SizeSelector({sizes=[],value,onChange,unavailable=[],style,...rest}){
  return (
    <div style={{display:"flex",gap:"var(--sp-3)",flexWrap:"wrap",...style}} {...rest}>
      {sizes.map(s=>{
        const off=unavailable.includes(s);
        const on=value===s;
        return (
          <button key={s} type="button" disabled={off} onClick={()=>onChange&&onChange(s)}
            style={{minWidth:52,height:44,padding:"0 var(--sp-4)",borderRadius:"var(--r-sm)",cursor:off?"not-allowed":"pointer",
              fontFamily:"var(--font-display)",fontWeight:"var(--fw-bold)",fontSize:"var(--fs-body)",
              background:on?"var(--surface-inverse)":"var(--surface-card)",
              color:off?"var(--text-muted)":on?"var(--text-inverse)":"var(--text-heading)",
              border:"1.5px solid "+(on?"var(--surface-inverse)":"var(--border-subtle)"),
              textDecoration:off?"line-through":"none",opacity:off?.55:1,
              transition:"all var(--dur-fast) var(--ease-out)"}}>{s}</button>
        );
      })}
    </div>
  );
}
