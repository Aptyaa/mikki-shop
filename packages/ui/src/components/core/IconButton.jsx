import React from "react";

const base={display:"inline-grid",placeItems:"center",borderRadius:"var(--r-pill)",border:"none",
  cursor:"pointer",flexShrink:0,
  transition:"background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-wag)"};
const SIZES={sm:34,md:44,lg:52};
const VARIANTS={
  plain:{background:"transparent",color:"var(--text-heading)"},
  filled:{background:"var(--surface-card)",color:"var(--text-heading)",boxShadow:"var(--sh-2)"},
  primary:{background:"var(--action-primary)",color:"var(--text-on-primary)"},
  sunken:{background:"var(--surface-sunken)",color:"var(--text-heading)"}
};

/** Square-tap, round-look control for chrome: back, favourite, share, close. */
export function IconButton({variant="plain",size="md",active=false,label,children,onClick,style,...rest}){
  const [p,setP]=React.useState(false);
  const px=SIZES[size]||SIZES.md;
  return (
    <button type="button" aria-label={label} aria-pressed={active||undefined} onClick={onClick}
      onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)} onMouseLeave={()=>setP(false)}
      onTouchStart={()=>setP(true)} onTouchEnd={()=>setP(false)}
      style={{...base,width:px,height:px,...VARIANTS[variant],
        ...(active?{color:"var(--accent-fav)"}:null),
        transform:p?"scale(var(--press-scale))":"scale(1)",...style}} {...rest}>
      {children}
    </button>
  );
}
