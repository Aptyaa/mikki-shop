import React from "react";

const wrap={display:"flex",flexDirection:"column",gap:"var(--sp-3)"};
const lbl={fontFamily:"var(--font-body)",fontWeight:"var(--fw-semibold)",fontSize:"var(--fs-body-sm)",color:"var(--text-heading)"};
const fieldBase={display:"flex",alignItems:"center",gap:"var(--sp-3)",height:"var(--field-h)",
  padding:"0 var(--field-pad-x)",background:"var(--surface-card)",
  border:"1.5px solid var(--border-subtle)",borderRadius:"var(--r-field)",
  transition:"border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"};
const inputBase={flex:1,minWidth:0,border:"none",outline:"none",background:"transparent",
  fontFamily:"var(--font-body)",fontSize:"var(--fs-body)",color:"var(--text-heading)"};

/** Single-line text field with label, helper text and error state. */
export function Input({label,placeholder,value,onChange,type="text",error,hint,
  iconLeft=null,iconRight=null,disabled=false,multiline=false,rows=3,style,...rest}){
  const [f,setF]=React.useState(false);
  const Ctrl=multiline?"textarea":"input";
  return (
    <label style={{...wrap,...style}}>
      {label&&<span style={lbl}>{label}</span>}
      <span style={{...fieldBase,
        height:multiline?"auto":"var(--field-h)",padding:multiline?"var(--sp-4) var(--field-pad-x)":"0 var(--field-pad-x)",
        alignItems:multiline?"flex-start":"center",
        ...(f?{borderColor:"var(--border-focus)",boxShadow:"var(--sh-focus)"}:null),
        ...(error?{borderColor:"var(--danger-500)"}:null),
        ...(disabled?{background:"var(--surface-sunken)",color:"var(--text-muted)"}:null)}}>
        {iconLeft}
        <Ctrl {...(multiline?{rows}:{type})} value={value} placeholder={placeholder} disabled={disabled}
          onChange={onChange} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
          style={{...inputBase,resize:multiline?"vertical":undefined,lineHeight:multiline?"1.5":undefined}} {...rest}/>
        {iconRight}
      </span>
      {(error||hint)&&<span style={{fontSize:"var(--fs-caption)",
        color:error?"var(--danger-500)":"var(--text-muted)"}}>{error||hint}</span>}
    </label>
  );
}
