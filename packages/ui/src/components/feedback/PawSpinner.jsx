import React from "react";

/** The brand's loader: a paw print turning in place. Replaces the generic ring spinner
 *  everywhere — Button loading, MainButton progress, page-level waits. */
export function PawSpinner({size=20,color="currentColor",speed="1.1s",style,...rest}){
  const ref=React.useRef(null);
  React.useEffect(()=>{
    const el=ref.current;
    if(el&&window.lucide&&window.lucide.createIcons){
      el.innerHTML="";
      const i=document.createElement("i");
      i.setAttribute("data-lucide","paw-print");
      el.appendChild(i);
      window.lucide.createIcons({nameAttr:"data-lucide",
        attrs:{width:size,height:size,"stroke-width":2.25},root:el});
    }
  },[size]);
  return (
    <span role="status" aria-label="Загрузка" style={{display:"inline-flex",width:size,height:size,
      color,flexShrink:0,animation:"ms-paw-turn "+speed+" steps(8, end) infinite",...style}} {...rest}>
      <span ref={ref} style={{display:"inline-flex"}}/>
    </span>
  );
}
