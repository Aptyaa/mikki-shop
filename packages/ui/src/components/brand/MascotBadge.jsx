import React from "react";
import MARK_PNG from "../../assets/mascot-mark.png";

const badge={display:"inline-grid",placeItems:"center",borderRadius:"var(--r-pill)",overflow:"hidden",flexShrink:0};
const SIZES={sm:40,md:64,lg:96,xl:140};

/** The mascot in a coloured disc — empty states, avatars, decorative moments. */
export function MascotBadge({size="md",tone="cream",ring=false,style,...rest}){
  const px=SIZES[size]||SIZES.md;
  const bg={cream:"var(--disc-cream)",butter:"var(--disc-butter)",forest:"var(--disc-forest)",berry:"var(--disc-berry)"}[tone]||"var(--disc-cream)";
  return (
    <span style={{...badge,width:px,height:px,background:bg,
      boxShadow:ring?"0 0 0 3px var(--surface-card), 0 0 0 6px "+bg:"none",...style}} {...rest}>
      <img src={MARK_PNG} alt="" width={Math.round(px*0.86)} height={Math.round(px*0.86)} style={{objectFit:"contain"}}/>
    </span>
  );
}
