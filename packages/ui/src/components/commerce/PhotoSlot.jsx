import React from "react";

/** Product photograph, or a paper-coloured placeholder plate when no photo exists yet. */
export function PhotoSlot({src,alt="",ratio="4 / 5",radius="var(--r-image)",label="фото",style,...rest}){
  if(src) return <img src={src} alt={alt} style={{width:"100%",aspectRatio:ratio,objectFit:"cover",
    borderRadius:radius,background:"var(--surface-sunken)",...style}} {...rest}/>;
  return (
    <div role="img" aria-label={label||alt} style={{width:"100%",aspectRatio:ratio,borderRadius:radius,
      background:"var(--surface-sunken)",display:"grid",placeItems:"center",overflow:"hidden",...style}} {...rest}>
      {label&&<span style={{fontFamily:"var(--font-body)",fontSize:"var(--fs-micro)",
        letterSpacing:"var(--ls-micro)",textTransform:"uppercase",color:"var(--text-muted)"}}>{label}</span>}
    </div>
  );
}
