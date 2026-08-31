import React from "react";

/** In-app header. NOT Telegram's own title bar — this sits inside the webview. */
export function AppBar({title,subtitle,left=null,right=null,transparent=false,center=false,style,...rest}){
  return (
    <header style={{display:"flex",alignItems:"center",gap:"var(--sp-3)",minHeight:56,
      padding:"var(--sp-3) var(--gutter)",
      background:transparent?"transparent":"var(--bg-page)",
      borderBottom:transparent?"none":"1px solid var(--border-subtle)",
      position:"sticky",top:0,zIndex:20,...style}} {...rest}>
      {left}
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",
        alignItems:center?"center":"flex-start",gap:1}}>
        {title&&<span style={{fontFamily:"var(--font-display)",fontWeight:"var(--fw-bold)",
          fontSize:"var(--fs-h3)",color:"var(--text-heading)",whiteSpace:"nowrap",
          overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{title}</span>}
        {subtitle&&<span style={{fontSize:"var(--fs-caption)",color:"var(--text-muted)"}}>{subtitle}</span>}
      </div>
      {right}
    </header>
  );
}
