import React from "react";
import { PawSpinner } from "../feedback/PawSpinner.jsx";

const btnBase={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:"var(--sp-3)",
  fontFamily:"var(--font-display)",fontWeight:"var(--fw-bold)",letterSpacing:"-0.005em",
  border:"2px solid transparent",borderRadius:"var(--r-button)",cursor:"pointer",
  textDecoration:"none",whiteSpace:"nowrap",userSelect:"none",
  transition:"background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-wag), box-shadow var(--dur-fast) var(--ease-out)"};

const SIZES={
  lg:{height:"var(--btn-h-lg)",padding:"0 var(--sp-7)",fontSize:"17px"},
  md:{height:"var(--btn-h-md)",padding:"0 var(--btn-pad-x)",fontSize:"15px"},
  sm:{height:"var(--btn-h-sm)",padding:"0 var(--btn-pad-x-sm)",fontSize:"13px"}
};

const VARIANTS={
  primary:{background:"var(--action-primary)",color:"var(--text-on-primary)",boxShadow:"var(--sh-2)"},
  secondary:{background:"var(--action-secondary)",color:"var(--text-inverse)"},
  outline:{background:"transparent",color:"var(--text-heading)",borderColor:"var(--border-strong)"},
  ghost:{background:"transparent",color:"var(--text-link)"},
  soft:{background:"var(--surface-tint)",color:"var(--text-link)"}
};
const HOVER={
  primary:{background:"var(--action-primary-hover)"},
  secondary:{background:"var(--action-secondary-hover)"},
  outline:{borderColor:"var(--action-primary)",color:"var(--action-primary)"},
  ghost:{background:"var(--action-ghost-hover)"},
  soft:{background:"var(--surface-sunken)"}
};

/** Primary action control. Always a pill in this brand. */
export function Button({variant="primary",size="md",block=false,disabled=false,loading=false,
  iconLeft=null,iconRight=null,as="button",href,onClick,children,style,...rest}){
  const [h,setH]=React.useState(false);
  const [p,setP]=React.useState(false);
  const Tag=as==="a"?"a":"button";
  const s={...btnBase,...SIZES[size],...VARIANTS[variant],
    ...(h&&!disabled?HOVER[variant]:null),
    width:block?"100%":"auto",
    transform:p&&!disabled?"scale(var(--press-scale))":"scale(1)",
    ...(disabled||loading?{background:variant==="ghost"||variant==="outline"?"transparent":"var(--action-disabled)",
      color:"var(--text-muted)",borderColor:variant==="outline"?"var(--border-subtle)":"transparent",
      boxShadow:"none",cursor:"not-allowed"}:null),
    ...style};
  return (
    <Tag {...(Tag==="a"?{href}:{type:"button",disabled:disabled||loading})}
      onClick={disabled||loading?undefined:onClick}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>{setH(false);setP(false);}}
      onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)}
      onTouchStart={()=>setP(true)} onTouchEnd={()=>setP(false)}
      style={s} {...rest}>
      {loading?<PawSpinner size={size==="sm"?15:18}/>:iconLeft}
      {children}
      {iconRight}
    </Tag>
  );
}
