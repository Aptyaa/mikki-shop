import React from "react";
/** On/off toggle for settings rows. */
export function Switch({checked=false,onChange,label,disabled=false,style,...rest}){
  return (
    <label style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"var(--sp-5)",
      minHeight:"var(--tap-min)",cursor:disabled?"not-allowed":"pointer",...style}}>
      {label&&<span style={{fontSize:"var(--fs-body)",color:"var(--text-body)"}}>{label}</span>}
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
        style={{position:"absolute",opacity:0,width:1,height:1}} {...rest}/>
      <span style={{width:48,height:28,flexShrink:0,borderRadius:"var(--r-pill)",padding:3,
        background:checked?"var(--action-primary)":"var(--border-strong)",
        opacity:disabled?.5:1,transition:"background var(--dur-base) var(--ease-out)"}}>
        <span style={{display:"block",width:22,height:22,borderRadius:"50%",background:"#fff",
          boxShadow:"var(--sh-1)",transform:"translateX("+(checked?20:0)+"px)",
          transition:"transform var(--dur-base) var(--ease-wag)"}}/>
      </span>
    </label>
  );
}
