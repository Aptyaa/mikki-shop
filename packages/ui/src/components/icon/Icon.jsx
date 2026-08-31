import React from "react";

/** Lucide glyph wrapper. Requires the Lucide UMD script on the page (see ICONOGRAPHY in readme.md). */
export function Icon({name,size=20,strokeWidth=2,color="currentColor",style,...rest}){
  const ref=React.useRef(null);
  React.useEffect(()=>{
    const el=ref.current;
    if(el&&window.lucide&&window.lucide.createIcons){
      el.innerHTML="";
      const i=document.createElement("i");
      i.setAttribute("data-lucide",name);
      el.appendChild(i);
      window.lucide.createIcons({nameAttr:"data-lucide",attrs:{width:size,height:size,"stroke-width":strokeWidth},root:el});
    }
  },[name,size,strokeWidth]);
  return <span ref={ref} aria-hidden="true" style={{display:"inline-flex",width:size,height:size,color,flexShrink:0,...style}} {...rest}/>;
}
