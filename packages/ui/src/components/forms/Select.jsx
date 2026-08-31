import React from "react";
/** Native select styled as a field — required for Telegram/VK webviews, where custom dropdowns feel wrong. */
export function Select({label,value,onChange,options=[],hint,disabled=false,style,...rest}){
  return (
    <label style={{display:"flex",flexDirection:"column",gap:"var(--sp-3)",...style}}>
      {label&&<span style={{fontFamily:"var(--font-body)",fontWeight:"var(--fw-semibold)",
        fontSize:"var(--fs-body-sm)",color:"var(--text-heading)"}}>{label}</span>}
      <span style={{position:"relative",display:"block"}}>
        <select value={value} onChange={onChange} disabled={disabled}
          style={{appearance:"none",width:"100%",height:"var(--field-h)",
            padding:"0 40px 0 var(--field-pad-x)",background:"var(--surface-card)",
            border:"1.5px solid var(--border-subtle)",borderRadius:"var(--r-field)",
            fontFamily:"var(--font-body)",fontSize:"var(--fs-body)",color:"var(--text-heading)"}} {...rest}>
          {options.map(o=>{const v=typeof o==="string"?o:o.value;const l=typeof o==="string"?o:o.label;
            return <option key={v} value={v}>{l}</option>;})}
        </select>
        <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",
          pointerEvents:"none",color:"var(--text-muted)",fontSize:12}}>▾</span>
      </span>
      {hint&&<span style={{fontSize:"var(--fs-caption)",color:"var(--text-muted)"}}>{hint}</span>}
    </label>
  );
}
